"""FastAPI server with MySQL and expiry features"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
import logging
from pathlib import Path
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import httpx
import random
import string
import asyncio
import time

from database import engine, get_db, Base
from models import TempEmail as TempEmailModel, EmailHistory as EmailHistoryModel

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create database tables
Base.metadata.create_all(bind=engine)

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Email Provider Configuration
MAILTM_BASE_URL = "https://api.mail.tm"
MAILGW_BASE_URL = "https://api.mail.gw"
ONESECMAIL_BASE_URL = "https://www.1secmail.com/api/v1"

# New service base URLs
GUERRILLA_BASE_URL = "https://api.guerrillamail.com/ajax.php"
TEMPMAIL_LOL_BASE_URL = "https://api.tempmail.lol"
DROPMAIL_BASE_URL = "https://dropmail.me/api"

# Available services
AVAILABLE_SERVICES = {
    "mailtm": {"name": "Mail.tm", "base_url": MAILTM_BASE_URL},
    "mailgw": {"name": "Mail.gw", "base_url": MAILGW_BASE_URL},
    "1secmail": {"name": "1secmail", "base_url": ONESECMAIL_BASE_URL},
    "guerrilla": {"name": "Guerrilla Mail", "base_url": GUERRILLA_BASE_URL},
    "tempmail_lol": {"name": "TempMail.lol", "base_url": TEMPMAIL_LOL_BASE_URL},
    "dropmail": {"name": "DropMail", "base_url": DROPMAIL_BASE_URL}
}

# Rate limiting tracking (in-memory)
# In production, use Redis or database
_rate_limit_tracker = {
    "last_create_time": 0,
    "create_count": 0,
    "reset_time": 0
}

# Domain cache to reduce API calls (per service)
_domain_cache = {
    "mailtm": {"domains": [], "cached_at": 0, "ttl": 300},
    "mailgw": {"domains": [], "cached_at": 0, "ttl": 300},
    "1secmail": {"domains": [], "cached_at": 0, "ttl": 300},
    "guerrilla": {"domains": [], "cached_at": 0, "ttl": 300},
    "tempmail_lol": {"domains": [], "cached_at": 0, "ttl": 300},
    "dropmail": {"domains": [], "cached_at": 0, "ttl": 300}
}

# Provider tracking
_provider_stats = {
    "mailtm": {"success": 0, "failures": 0, "last_failure": 0},
    "mailgw": {"success": 0, "failures": 0, "last_failure": 0},
    "1secmail": {"success": 0, "failures": 0, "last_failure": 0},
    "guerrilla": {"success": 0, "failures": 0, "last_failure": 0},
    "tempmail_lol": {"success": 0, "failures": 0, "last_failure": 0},
    "dropmail": {"success": 0, "failures": 0, "last_failure": 0}
}


# Pydantic Models
class TempEmailSchema(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)
    
    id: int
    address: str
    password: str
    token: str
    account_id: str
    created_at: datetime
    expires_at: datetime
    message_count: int = 0


class EmailHistorySchema(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)
    
    id: int
    address: str
    password: str
    token: str
    account_id: str
    created_at: datetime
    expired_at: datetime
    message_count: int = 0


class CreateEmailRequest(BaseModel):
    username: Optional[str] = None
    service: Optional[str] = "mailtm"  # Default to mailtm
    domain: Optional[str] = None  # If None, will use first available domain


class CreateEmailResponse(BaseModel):
    id: int
    address: str
    created_at: datetime
    expires_at: datetime
    provider: str
    service_name: str


class DeleteHistoryRequest(BaseModel):
    ids: Optional[List[int]] = None


# Mail.tm Service Functions
async def get_available_domains():
    """Get available domains from Mail.tm with caching"""
    current_time = time.time()
    
    # Check cache first
    if (_domain_cache["domain"] and 
        current_time - _domain_cache["cached_at"] < _domain_cache["ttl"]):
        logging.info(f"Using cached domain: {_domain_cache['domain']}")
        return _domain_cache["domain"]
    
    # Fetch from API with retry
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        for attempt in range(3):
            try:
                response = await http_client.get(f"{MAILTM_BASE_URL}/domains")
                response.raise_for_status()
                data = response.json()
                domains = data.get("hydra:member", [])
                if domains:
                    domain = domains[0]["domain"]
                    # Update cache
                    _domain_cache["domain"] = domain
                    _domain_cache["cached_at"] = current_time
                    logging.info(f"Cached new domain: {domain}")
                    return domain
                return None
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                    logging.warning(f"Rate limited on domains, waiting {wait_time}s (attempt {attempt + 1}/3)")
                    await asyncio.sleep(wait_time)
                else:
                    logging.error(f"Error getting domains: {e}")
                    return None
            except Exception as e:
                logging.error(f"Error getting domains: {e}")
                return None
        
        # All retries failed
        return None


async def create_mailtm_account(address: str, password: str):
    """Create account on Mail.tm with retry logic"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        for attempt in range(3):
            try:
                response = await http_client.post(
                    f"{MAILTM_BASE_URL}/accounts",
                    json={"address": address, "password": password}
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    wait_time = 2 ** attempt  # Exponential backoff
                    logging.warning(f"Rate limited on account creation, waiting {wait_time}s (attempt {attempt + 1}/3)")
                    
                    if attempt < 2:  # Don't wait on last attempt
                        await asyncio.sleep(wait_time)
                    else:
                        # Last attempt failed
                        raise HTTPException(
                            status_code=429, 
                            detail="Mail.tm API rate limit exceeded. Please wait a few minutes and try again."
                        )
                else:
                    logging.error(f"Error creating account: {e}")
                    raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                logging.error(f"Error creating account: {e}")
                raise HTTPException(status_code=400, detail=str(e))


async def get_mailtm_token(address: str, password: str):
    """Get authentication token from Mail.tm"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.post(
                f"{MAILTM_BASE_URL}/token",
                json={"address": address, "password": password}
            )
            response.raise_for_status()
            return response.json()["token"]
        except Exception as e:
            logging.error(f"Error getting token: {e}")
            raise HTTPException(status_code=400, detail=str(e))


async def get_mailtm_messages(token: str):
    """Get messages from Mail.tm"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(
                f"{MAILTM_BASE_URL}/messages",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            data = response.json()
            return data.get("hydra:member", [])
        except Exception as e:
            logging.error(f"Error getting messages: {e}")
            return []


async def get_mailtm_message_detail(token: str, message_id: str):
    """Get message detail from Mail.tm"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(
                f"{MAILTM_BASE_URL}/messages/{message_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logging.error(f"Error getting message detail: {e}")
            return None


# ============================================================================
# Mail.gw Service Functions (Compatible with Mail.tm API)
# ============================================================================

async def get_mailgw_domains():
    """Get available domains from Mail.gw with caching"""
    current_time = time.time()
    service = "mailgw"
    
    # Check cache first
    if (_domain_cache[service]["domains"] and 
        current_time - _domain_cache[service]["cached_at"] < _domain_cache[service]["ttl"]):
        logging.info(f"Using cached Mail.gw domains")
        return _domain_cache[service]["domains"]
    
    # Fetch from API
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(f"{MAILGW_BASE_URL}/domains")
            response.raise_for_status()
            data = response.json()
            domains = [d["domain"] for d in data.get("hydra:member", [])]
            
            # Update cache
            _domain_cache[service]["domains"] = domains
            _domain_cache[service]["cached_at"] = current_time
            logging.info(f"Cached {len(domains)} Mail.gw domains")
            return domains
        except Exception as e:
            logging.error(f"Error getting Mail.gw domains: {e}")
            return []


async def create_mailgw_account(address: str, password: str):
    """Create account on Mail.gw (API compatible with Mail.tm)"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.post(
                f"{MAILGW_BASE_URL}/accounts",
                json={"address": address, "password": password}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logging.error(f"Error creating Mail.gw account: {e}")
            raise HTTPException(status_code=400, detail=str(e))


async def get_mailgw_token(address: str, password: str):
    """Get authentication token from Mail.gw"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.post(
                f"{MAILGW_BASE_URL}/token",
                json={"address": address, "password": password}
            )
            response.raise_for_status()
            return response.json()["token"]
        except Exception as e:
            logging.error(f"Error getting Mail.gw token: {e}")
            raise HTTPException(status_code=400, detail=str(e))


async def get_mailgw_messages(token: str):
    """Get messages from Mail.gw"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(
                f"{MAILGW_BASE_URL}/messages",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            data = response.json()
            return data.get("hydra:member", [])
        except Exception as e:
            logging.error(f"Error getting Mail.gw messages: {e}")
            return []


async def get_mailgw_message_detail(token: str, message_id: str):
    """Get message detail from Mail.gw"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(
                f"{MAILGW_BASE_URL}/messages/{message_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logging.error(f"Error getting Mail.gw message detail: {e}")
            return None


# ============================================================================
# 1secmail Service Functions
# ============================================================================

async def get_1secmail_domains():
    """Get available domains from 1secmail with caching"""
    current_time = time.time()
    service = "1secmail"
    
    # Check cache first
    if (_domain_cache[service]["domains"] and 
        current_time - _domain_cache[service]["cached_at"] < _domain_cache[service]["ttl"]):
        logging.info(f"Using cached 1secmail domains")
        return _domain_cache[service]["domains"]
    
    # Fetch from API
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(f"{ONESECMAIL_BASE_URL}/?action=getDomainList")
            response.raise_for_status()
            domains = response.json()
            
            # Update cache
            _domain_cache[service]["domains"] = domains
            _domain_cache[service]["cached_at"] = current_time
            logging.info(f"Cached {len(domains)} 1secmail domains")
            return domains
        except Exception as e:
            logging.error(f"Error getting 1secmail domains: {e}")
            return []


async def create_1secmail_account(username: str, domain: str):
    """Create/use email on 1secmail (no actual account creation needed)"""
    # 1secmail doesn't require account creation - emails just exist
    address = f"{username}@{domain}"
    return {
        "address": address,
        "username": username,
        "domain": domain
    }


async def get_1secmail_messages(username: str, domain: str):
    """Get messages from 1secmail"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(
                f"{ONESECMAIL_BASE_URL}/?action=getMessages&login={username}&domain={domain}"
            )
            response.raise_for_status()
            messages = response.json()
            
            # Transform to match Mail.tm format
            transformed = []
            for msg in messages:
                transformed.append({
                    "id": str(msg["id"]),
                    "from": {
                        "address": msg.get("from", ""),
                        "name": msg.get("from", "")
                    },
                    "subject": msg.get("subject", ""),
                    "createdAt": msg.get("date", "")
                })
            
            return transformed
        except Exception as e:
            logging.error(f"Error getting 1secmail messages: {e}")
            return []


async def get_1secmail_message_detail(username: str, domain: str, message_id: str):
    """Get message detail from 1secmail"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(
                f"{ONESECMAIL_BASE_URL}/?action=readMessage&login={username}&domain={domain}&id={message_id}"
            )
            response.raise_for_status()
            msg = response.json()
            
            # Transform to match Mail.tm format
            transformed = {
                "id": str(msg.get("id", message_id)),
                "from": {
                    "address": msg.get("from", ""),
                    "name": msg.get("from", "")
                },
                "to": [{"address": msg.get("to", "")}],
                "subject": msg.get("subject", ""),
                "createdAt": msg.get("date", ""),
                "text": [msg.get("textBody", "")],
                "html": [msg.get("htmlBody", "")]
            }
            
            return transformed
        except Exception as e:
            logging.error(f"Error getting 1secmail message detail: {e}")
            return None


# ============================================================================
# Guerrilla Mail Service Functions
# ============================================================================

async def get_guerrilla_domains():
    """Get available domains from Guerrilla Mail with caching"""
    current_time = time.time()
    service = "guerrilla"
    
    # Check cache first
    if (_domain_cache[service]["domains"] and 
        current_time - _domain_cache[service]["cached_at"] < _domain_cache[service]["ttl"]):
        logging.info(f"Using cached Guerrilla Mail domains")
        return _domain_cache[service]["domains"]
    
    # Fetch from API
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(f"{GUERRILLA_BASE_URL}?f=get_email_address")
            response.raise_for_status()
            data = response.json()
            domains = data.get("email_list", [])
            
            # Update cache
            _domain_cache[service]["domains"] = domains
            _domain_cache[service]["cached_at"] = current_time
            logging.info(f"Cached {len(domains)} Guerrilla Mail domains")
            return domains
        except Exception as e:
            logging.error(f"Error getting Guerrilla Mail domains: {e}")
            return []


async def create_guerrilla_account(username: str = None, domain: str = None):
    """Create/get email on Guerrilla Mail"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            # Get session and email address
            response = await http_client.get(f"{GUERRILLA_BASE_URL}?f=get_email_address")
            response.raise_for_status()
            data = response.json()
            
            sid_token = data.get("sid_token")
            email_addr = data.get("email_addr")
            
            # If username provided, set custom username
            if username and sid_token:
                set_response = await http_client.get(
                    f"{GUERRILLA_BASE_URL}?f=set_email_user&email_user={username}&sid_token={sid_token}"
                )
                set_response.raise_for_status()
                set_data = set_response.json()
                email_addr = set_data.get("email_addr", email_addr)
            
            # Extract username and domain
            parts = email_addr.split("@")
            return {
                "address": email_addr,
                "sid_token": sid_token,
                "username": parts[0] if len(parts) > 0 else username or "",
                "domain": parts[1] if len(parts) > 1 else domain or ""
            }
        except Exception as e:
            logging.error(f"Error creating Guerrilla Mail account: {e}")
            raise


async def get_guerrilla_messages(sid_token: str):
    """Get messages from Guerrilla Mail"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(
                f"{GUERRILLA_BASE_URL}?f=get_email_list&offset=0&sid_token={sid_token}"
            )
            response.raise_for_status()
            data = response.json()
            messages = data.get("list", [])
            
            # Transform to match Mail.tm format
            transformed = []
            for msg in messages:
                transformed.append({
                    "id": str(msg.get("mail_id", "")),
                    "from": {
                        "address": msg.get("mail_from", ""),
                        "name": msg.get("mail_from", "")
                    },
                    "subject": msg.get("mail_subject", ""),
                    "createdAt": msg.get("mail_timestamp", "")
                })
            
            return transformed
        except Exception as e:
            logging.error(f"Error getting Guerrilla Mail messages: {e}")
            return []


async def get_guerrilla_message_detail(sid_token: str, message_id: str):
    """Get message detail from Guerrilla Mail"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(
                f"{GUERRILLA_BASE_URL}?f=fetch_email&email_id={message_id}&sid_token={sid_token}"
            )
            response.raise_for_status()
            msg = response.json()
            
            # Transform to match Mail.tm format
            transformed = {
                "id": str(msg.get("mail_id", message_id)),
                "from": {
                    "address": msg.get("mail_from", ""),
                    "name": msg.get("mail_from", "")
                },
                "to": [{"address": msg.get("mail_recipient", "")}],
                "subject": msg.get("mail_subject", ""),
                "createdAt": msg.get("mail_timestamp", ""),
                "text": [msg.get("mail_body", "")],
                "html": [msg.get("mail_body", "")]
            }
            
            return transformed
        except Exception as e:
            logging.error(f"Error getting Guerrilla Mail message detail: {e}")
            return None


# ============================================================================
# TempMail.lol Service Functions
# ============================================================================

async def get_tempmail_lol_domains():
    """Get available domains from TempMail.lol with caching"""
    current_time = time.time()
    service = "tempmail_lol"
    
    # Check cache first
    if (_domain_cache[service]["domains"] and 
        current_time - _domain_cache[service]["cached_at"] < _domain_cache[service]["ttl"]):
        logging.info(f"Using cached TempMail.lol domains")
        return _domain_cache[service]["domains"]
    
    # Fetch from API
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(f"{TEMPMAIL_LOL_BASE_URL}/v1/domains")
            response.raise_for_status()
            domains = response.json()
            
            # Update cache
            _domain_cache[service]["domains"] = domains
            _domain_cache[service]["cached_at"] = current_time
            logging.info(f"Cached {len(domains)} TempMail.lol domains")
            return domains
        except Exception as e:
            logging.error(f"Error getting TempMail.lol domains: {e}")
            return []


async def create_tempmail_lol_account(username: str = None, domain: str = None):
    """Create email on TempMail.lol"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            # Generate email address
            if not domain:
                domains = await get_tempmail_lol_domains()
                if not domains:
                    raise Exception("No domains available from TempMail.lol")
                domain = domains[0]
            
            if not username:
                username = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
            
            address = f"{username}@{domain}"
            
            # TempMail.lol doesn't require account creation - emails just exist
            return {
                "address": address,
                "username": username,
                "domain": domain,
                "token": address  # Use address as token for this service
            }
        except Exception as e:
            logging.error(f"Error creating TempMail.lol account: {e}")
            raise


async def get_tempmail_lol_messages(address: str):
    """Get messages from TempMail.lol"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(f"{TEMPMAIL_LOL_BASE_URL}/v1/inbox/{address}")
            response.raise_for_status()
            messages = response.json()
            
            # Transform to match Mail.tm format
            transformed = []
            for msg in messages:
                transformed.append({
                    "id": str(msg.get("id", "")),
                    "from": {
                        "address": msg.get("from", ""),
                        "name": msg.get("from", "")
                    },
                    "subject": msg.get("subject", ""),
                    "createdAt": msg.get("date", "")
                })
            
            return transformed
        except Exception as e:
            logging.error(f"Error getting TempMail.lol messages: {e}")
            return []


async def get_tempmail_lol_message_detail(address: str, message_id: str):
    """Get message detail from TempMail.lol"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(f"{TEMPMAIL_LOL_BASE_URL}/v1/message/{message_id}")
            response.raise_for_status()
            msg = response.json()
            
            # Transform to match Mail.tm format
            transformed = {
                "id": str(msg.get("id", message_id)),
                "from": {
                    "address": msg.get("from", ""),
                    "name": msg.get("from", "")
                },
                "to": [{"address": msg.get("to", "")}],
                "subject": msg.get("subject", ""),
                "createdAt": msg.get("date", ""),
                "text": [msg.get("text", "")],
                "html": [msg.get("html", "")]
            }
            
            return transformed
        except Exception as e:
            logging.error(f"Error getting TempMail.lol message detail: {e}")
            return None


# ============================================================================
# DropMail Service Functions
# ============================================================================

async def get_dropmail_domains():
    """Get available domains from DropMail with caching"""
    current_time = time.time()
    service = "dropmail"
    
    # Check cache first
    if (_domain_cache[service]["domains"] and 
        current_time - _domain_cache[service]["cached_at"] < _domain_cache[service]["ttl"]):
        logging.info(f"Using cached DropMail domains")
        return _domain_cache[service]["domains"]
    
    # Fetch from API
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(f"{DROPMAIL_BASE_URL}/graphql/web-test-wgq6m5i?query={{%20availableDomains%20}}")
            response.raise_for_status()
            data = response.json()
            domains = data.get("data", {}).get("availableDomains", [])
            
            # Update cache
            _domain_cache[service]["domains"] = domains
            _domain_cache[service]["cached_at"] = current_time
            logging.info(f"Cached {len(domains)} DropMail domains")
            return domains
        except Exception as e:
            logging.error(f"Error getting DropMail domains: {e}")
            return ["dropmail.me", "10mail.org"]  # Fallback domains


async def create_dropmail_account(username: str = None, domain: str = None):
    """Create email on DropMail"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            # Get available domains if not specified
            if not domain:
                domains = await get_dropmail_domains()
                if not domains:
                    raise Exception("No domains available from DropMail")
                domain = domains[0]
            
            if not username:
                username = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
            
            address = f"{username}@{domain}"
            
            # Create session via GraphQL
            query = """
            mutation {
              introduceSession {
                id
                addresses {
                  address
                }
              }
            }
            """
            
            response = await http_client.post(
                f"{DROPMAIL_BASE_URL}/graphql/web-test-wgq6m5i",
                json={"query": query}
            )
            response.raise_for_status()
            data = response.json()
            
            session_id = data.get("data", {}).get("introduceSession", {}).get("id", "")
            
            # DropMail creates emails automatically
            return {
                "address": address,
                "username": username,
                "domain": domain,
                "session_id": session_id or username  # Use session_id or fallback to username
            }
        except Exception as e:
            logging.error(f"Error creating DropMail account: {e}")
            # Fallback: just return the address without session
            if not domain:
                domain = "dropmail.me"
            if not username:
                username = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
            
            return {
                "address": f"{username}@{domain}",
                "username": username,
                "domain": domain,
                "session_id": username
            }


async def get_dropmail_messages(session_id: str):
    """Get messages from DropMail"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            query = """
            query {
              session {
                mails {
                  id
                  headerFrom
                  headerSubject
                  rawSize
                  downloadUrl
                  createdAt
                }
              }
            }
            """
            
            response = await http_client.post(
                f"{DROPMAIL_BASE_URL}/graphql/{session_id}",
                json={"query": query}
            )
            response.raise_for_status()
            data = response.json()
            messages = data.get("data", {}).get("session", {}).get("mails", [])
            
            # Transform to match Mail.tm format
            transformed = []
            for msg in messages:
                transformed.append({
                    "id": str(msg.get("id", "")),
                    "from": {
                        "address": msg.get("headerFrom", ""),
                        "name": msg.get("headerFrom", "")
                    },
                    "subject": msg.get("headerSubject", ""),
                    "createdAt": msg.get("createdAt", "")
                })
            
            return transformed
        except Exception as e:
            logging.error(f"Error getting DropMail messages: {e}")
            return []


async def get_dropmail_message_detail(session_id: str, message_id: str):
    """Get message detail from DropMail"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            query = f"""
            query {{
              session {{
                mail(id: "{message_id}") {{
                  id
                  headerFrom
                  headerTo
                  headerSubject
                  text
                  html
                  createdAt
                }}
              }}
            }}
            """
            
            response = await http_client.post(
                f"{DROPMAIL_BASE_URL}/graphql/{session_id}",
                json={"query": query}
            )
            response.raise_for_status()
            data = response.json()
            msg = data.get("data", {}).get("session", {}).get("mail", {})
            
            # Transform to match Mail.tm format
            transformed = {
                "id": str(msg.get("id", message_id)),
                "from": {
                    "address": msg.get("headerFrom", ""),
                    "name": msg.get("headerFrom", "")
                },
                "to": [{"address": msg.get("headerTo", "")}],
                "subject": msg.get("headerSubject", ""),
                "createdAt": msg.get("createdAt", ""),
                "text": [msg.get("text", "")],
                "html": [msg.get("html", "")]
            }
            
            return transformed
        except Exception as e:
            logging.error(f"Error getting DropMail message detail: {e}")
            return None




# ============================================================================
# Unified Email Creation - Multi-Service Support
# ============================================================================

async def get_available_domains():
    """Get available domains from Mail.tm (legacy support)"""
    domains = await get_mailtm_domains()
    return domains[0] if domains else None


async def get_mailtm_domains():
    """Get available domains from Mail.tm with caching"""
    current_time = time.time()
    service = "mailtm"
    
    # Check cache first
    if (_domain_cache[service]["domains"] and 
        current_time - _domain_cache[service]["cached_at"] < _domain_cache[service]["ttl"]):
        logging.info(f"Using cached Mail.tm domains")
        return _domain_cache[service]["domains"]
    
    # Fetch from API
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(f"{MAILTM_BASE_URL}/domains")
            response.raise_for_status()
            data = response.json()
            domains = [d["domain"] for d in data.get("hydra:member", [])]
            
            # Update cache
            _domain_cache[service]["domains"] = domains
            _domain_cache[service]["cached_at"] = current_time
            logging.info(f"Cached {len(domains)} Mail.tm domains")
            return domains
        except Exception as e:
            logging.error(f"Error getting Mail.tm domains: {e}")
            return []


async def create_email_with_service(service: str, username: str = None, domain: str = None):
    """
    Create email using specified service with automatic fallback
    """
    # Generate username if not provided
    if not username:
        username = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
    
    password = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    
    # Try primary service
    try:
        if service == "mailtm":
            return await create_mailtm_email(username, domain, password)
        elif service == "mailgw":
            return await create_mailgw_email(username, domain, password)
        elif service == "1secmail":
            return await create_1secmail_email(username, domain)
        elif service == "guerrilla":
            return await create_guerrilla_email(username, domain)
        elif service == "tempmail_lol":
            return await create_tempmail_lol_email(username, domain)
        elif service == "dropmail":
            return await create_dropmail_email(username, domain)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown service: {service}")
    except HTTPException as e:
        # If rate limited or service unavailable, try fallback services
        if e.status_code in [429, 503]:
            logging.warning(f"⚠️ {service} failed ({e.status_code}), trying fallback services...")
            
            # Define fallback order based on failed service
            all_services = ["mailtm", "mailgw", "1secmail", "guerrilla", "tempmail_lol", "dropmail"]
            fallback_services = [s for s in all_services if s != service][:3]  # Try 3 fallbacks
            
            # Try fallback services
            for fallback in fallback_services:
                try:
                    logging.info(f"🔄 Trying fallback: {fallback}")
                    if fallback == "mailtm":
                        return await create_mailtm_email(username, domain, password)
                    elif fallback == "mailgw":
                        return await create_mailgw_email(username, domain, password)
                    elif fallback == "1secmail":
                        return await create_1secmail_email(username, domain)
                    elif fallback == "guerrilla":
                        return await create_guerrilla_email(username, domain)
                    elif fallback == "tempmail_lol":
                        return await create_tempmail_lol_email(username, domain)
                    elif fallback == "dropmail":
                        return await create_dropmail_email(username, domain)
                except Exception as fallback_error:
                    logging.error(f"❌ Fallback {fallback} failed: {fallback_error}")
                    continue
            
            # All services failed
            raise HTTPException(
                status_code=503,
                detail="Tất cả dịch vụ email tạm thời không khả dụng. Vui lòng thử lại sau."
            )
        else:
            # Re-raise other errors
            raise


async def create_mailtm_email(username: str, domain: str = None, password: str = None):
    """Create email on Mail.tm"""
    try:
        logging.info("🔄 Creating email via Mail.tm...")
        
        # Get domain
        if not domain:
            domains = await get_mailtm_domains()
            if not domains:
                raise Exception("No domains available from Mail.tm")
            domain = domains[0]
        
        address = f"{username}@{domain}"
        
        # Create account
        account_data = await create_mailtm_account(address, password)
        
        # Get token
        token = await get_mailtm_token(address, password)
        
        _provider_stats["mailtm"]["success"] += 1
        logging.info(f"✅ Mail.tm email created: {address}")
        
        return {
            "provider": "mailtm",
            "address": address,
            "password": password,
            "token": token,
            "account_id": account_data["id"],
            "username": username,
            "domain": domain
        }
        
    except Exception as e:
        _provider_stats["mailtm"]["failures"] += 1
        _provider_stats["mailtm"]["last_failure"] = time.time()
        logging.error(f"❌ Mail.tm failed: {e}")
        raise HTTPException(status_code=503, detail=f"Mail.tm unavailable: {e}")


async def create_mailgw_email(username: str, domain: str = None, password: str = None):
    """Create email on Mail.gw"""
    try:
        logging.info("🔄 Creating email via Mail.gw...")
        
        # Get domain
        if not domain:
            domains = await get_mailgw_domains()
            if not domains:
                raise Exception("No domains available from Mail.gw")
            domain = domains[0]
        
        address = f"{username}@{domain}"
        
        # Create account
        account_data = await create_mailgw_account(address, password)
        
        # Get token
        token = await get_mailgw_token(address, password)
        
        _provider_stats["mailgw"]["success"] += 1
        logging.info(f"✅ Mail.gw email created: {address}")
        
        return {
            "provider": "mailgw",
            "address": address,
            "password": password,
            "token": token,
            "account_id": account_data["id"],
            "username": username,
            "domain": domain
        }
        
    except Exception as e:
        _provider_stats["mailgw"]["failures"] += 1
        _provider_stats["mailgw"]["last_failure"] = time.time()
        logging.error(f"❌ Mail.gw failed: {e}")
        raise HTTPException(status_code=503, detail=f"Mail.gw unavailable: {e}")


async def create_1secmail_email(username: str, domain: str = None):
    """Create email on 1secmail"""
    try:
        logging.info("🔄 Creating email via 1secmail...")
        
        # Get domain
        if not domain:
            domains = await get_1secmail_domains()
            if not domains:
                raise Exception("No domains available from 1secmail")
            domain = domains[0]
        
        # 1secmail doesn't need account creation
        account_data = await create_1secmail_account(username, domain)
        address = account_data["address"]
        
        _provider_stats["1secmail"]["success"] += 1
        logging.info(f"✅ 1secmail email created: {address}")
        
        return {
            "provider": "1secmail",
            "address": address,
            "password": "",  # 1secmail doesn't use passwords
            "token": "",  # 1secmail doesn't use tokens
            "account_id": username,  # Use username as account_id
            "username": username,
            "domain": domain
        }
        
    except Exception as e:
        _provider_stats["1secmail"]["failures"] += 1
        _provider_stats["1secmail"]["last_failure"] = time.time()
        logging.error(f"❌ 1secmail failed: {e}")
        raise HTTPException(status_code=503, detail=f"1secmail unavailable: {e}")



# API Routes
@api_router.get("/")
async def root():
    return {"message": "TempMail API - Multi-Service Support"}


@api_router.get("/services")
async def get_services():
    """Get list of available email services"""
    return {
        "services": [
            {"id": "mailtm", "name": "Mail.tm", "description": "Free temporary email service"},
            {"id": "mailgw", "name": "Mail.gw", "description": "Free temporary email service (Mail.tm compatible)"},
            {"id": "1secmail", "name": "1secmail", "description": "Fast temporary email service"}
        ]
    }


@api_router.get("/domains")
async def get_domains(service: str = "mailtm"):
    """Get available domains for a specific service"""
    try:
        if service == "mailtm":
            domains = await get_mailtm_domains()
        elif service == "mailgw":
            domains = await get_mailgw_domains()
        elif service == "1secmail":
            domains = await get_1secmail_domains()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown service: {service}")
        
        return {"service": service, "domains": domains}
    except Exception as e:
        logging.error(f"Error getting domains for {service}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/emails/create", response_model=CreateEmailResponse)
async def create_email(request: CreateEmailRequest, db: Session = Depends(get_db)):
    """Create a new temporary email with multi-service support"""
    try:
        # Check local rate limit (max 10 emails per minute for development)
        current_time = time.time()
        MAX_EMAILS_PER_MINUTE = 10
        
        if current_time - _rate_limit_tracker["reset_time"] > 60:
            # Reset counter after 1 minute
            _rate_limit_tracker["create_count"] = 0
            _rate_limit_tracker["reset_time"] = current_time
        
        if _rate_limit_tracker["create_count"] >= MAX_EMAILS_PER_MINUTE:
            wait_seconds = int(60 - (current_time - _rate_limit_tracker["reset_time"]))
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit: Maximum {MAX_EMAILS_PER_MINUTE} emails per minute. Please wait {wait_seconds} seconds."
            )
        
        # Increment counter
        _rate_limit_tracker["create_count"] += 1
        _rate_limit_tracker["last_create_time"] = current_time
        
        # Use service-specific email creation
        service = request.service or "mailtm"
        email_data = await create_email_with_service(
            service=service,
            username=request.username,
            domain=request.domain
        )
        
        # Calculate expiry time (10 minutes from now)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=10)
        
        # Save to database with provider info
        email = TempEmailModel(
            address=email_data["address"],
            password=email_data["password"],
            token=email_data["token"],
            account_id=email_data["account_id"],
            provider=email_data["provider"],
            username=email_data.get("username", ""),
            domain=email_data.get("domain", ""),
            created_at=now,
            expires_at=expires_at,
            message_count=0
        )
        
        db.add(email)
        db.commit()
        db.refresh(email)
        
        return {
            "id": email.id,
            "address": email.address,
            "created_at": email.created_at,
            "expires_at": email.expires_at,
            "provider": email.provider,
            "service_name": AVAILABLE_SERVICES.get(email.provider, {}).get("name", email.provider)
        }
    except Exception as e:
        logging.error(f"Error creating email: {e}")
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/emails", response_model=List[TempEmailSchema])
async def get_emails(db: Session = Depends(get_db)):
    """Get all temporary emails"""
    emails = db.query(TempEmailModel).order_by(TempEmailModel.created_at.desc()).all()
    return [email.to_dict() for email in emails]


@api_router.get("/emails/{email_id}")
async def get_email(email_id: int, db: Session = Depends(get_db)):
    """Get email by ID"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return email.to_dict()


@api_router.get("/emails/{email_id}/messages")
async def get_email_messages(email_id: int, db: Session = Depends(get_db)):
    """Get messages for an email (multi-service support)"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Get messages based on provider
    if email.provider == "mailtm":
        messages = await get_mailtm_messages(email.token)
    elif email.provider == "mailgw":
        messages = await get_mailgw_messages(email.token)
    elif email.provider == "1secmail":
        messages = await get_1secmail_messages(email.username, email.domain)
    else:
        messages = []
    
    # Update message count
    email.message_count = len(messages)
    db.commit()
    
    return {"messages": messages, "count": len(messages)}


@api_router.get("/emails/{email_id}/messages/{message_id}")
async def get_message_detail(email_id: int, message_id: str, db: Session = Depends(get_db)):
    """Get message detail (multi-service support)"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Get message based on provider
    if email.provider == "mailtm":
        message = await get_mailtm_message_detail(email.token, message_id)
    elif email.provider == "mailgw":
        message = await get_mailgw_message_detail(email.token, message_id)
    elif email.provider == "1secmail":
        message = await get_1secmail_message_detail(email.username, email.domain, message_id)
    else:
        message = None
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return message


@api_router.post("/emails/{email_id}/refresh")
async def refresh_messages(email_id: int, db: Session = Depends(get_db)):
    """Refresh messages for an email (multi-service support)"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Get messages based on provider
    if email.provider == "mailtm":
        messages = await get_mailtm_messages(email.token)
    elif email.provider == "mailgw":
        messages = await get_mailgw_messages(email.token)
    elif email.provider == "1secmail":
        messages = await get_1secmail_messages(email.username, email.domain)
    else:
        messages = []
    
    email.message_count = len(messages)
    db.commit()
    
    return {"messages": messages, "count": len(messages)}


@api_router.delete("/emails/{email_id}")
async def delete_email(email_id: int, db: Session = Depends(get_db)):
    """Delete a temporary email"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    db.delete(email)
    db.commit()
    
    return {"status": "deleted"}


@api_router.post("/emails/{email_id}/extend-time")
async def extend_email_time(email_id: int, db: Session = Depends(get_db)):
    """Extend email expiry time by resetting to 10 minutes from now"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Reset expires_at to 10 minutes from now (not add to existing time)
    now = datetime.now(timezone.utc)
    new_expires_at = now + timedelta(minutes=10)
    
    email.expires_at = new_expires_at
    db.commit()
    db.refresh(email)
    
    return {
        "status": "extended",
        "expires_at": new_expires_at.isoformat()
    }


@api_router.get("/emails/history/list", response_model=List[EmailHistorySchema])
async def get_email_history(db: Session = Depends(get_db)):
    """Get all emails in history"""
    history = db.query(EmailHistoryModel).order_by(EmailHistoryModel.expired_at.desc()).all()
    return [email.to_dict() for email in history]


@api_router.get("/emails/history/{email_id}/messages")
async def get_history_email_messages(email_id: int, db: Session = Depends(get_db)):
    """Get messages for a history email"""
    email = db.query(EmailHistoryModel).filter(EmailHistoryModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found in history")
    
    # Get messages from Mail.tm using the stored token
    messages = await get_mailtm_messages(email.token)
    
    return {"messages": messages, "count": len(messages)}


@api_router.get("/emails/history/{email_id}/messages/{message_id}")
async def get_history_message_detail(email_id: int, message_id: str, db: Session = Depends(get_db)):
    """Get message detail for a history email"""
    email = db.query(EmailHistoryModel).filter(EmailHistoryModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found in history")
    
    message = await get_mailtm_message_detail(email.token, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return message


@api_router.delete("/emails/history/delete")
async def delete_history_emails(request: DeleteHistoryRequest, db: Session = Depends(get_db)):
    """Delete history emails. If ids is None or empty, delete all"""
    try:
        if request.ids and len(request.ids) > 0:
            # Delete specific emails by IDs
            result = db.query(EmailHistoryModel).filter(EmailHistoryModel.id.in_(request.ids)).delete(synchronize_session=False)
            db.commit()
            deleted_count = result
        else:
            # Delete all history emails
            result = db.query(EmailHistoryModel).delete(synchronize_session=False)
            db.commit()
            deleted_count = result
        
        return {
            "status": "deleted",
            "count": deleted_count
        }
    except Exception as e:
        logging.error(f"Error deleting history emails: {e}")
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# Startup event to start background tasks
@app.on_event("startup")
async def startup_event():
    """Start background tasks on application startup"""
    from background_tasks import start_background_tasks
    start_background_tasks()
    logging.info("Application started with background tasks (MySQL)")


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
