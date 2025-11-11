"""FastAPI server with MySQL/SQLAlchemy and multiple email providers (mail.tm, 1secmail, mail.gw, guerrilla, tempmail.lol)"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import httpx
import random
import string
import time

from sqlalchemy.orm import Session
from database import get_db, engine, SessionLocal
from models import TempEmail, EmailHistory, SavedEmail, Base

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create tables
Base.metadata.create_all(bind=engine)

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Email Provider URLs
MAILTM_BASE_URL = "https://api.mail.tm"
ONESECMAIL_BASE_URL = "https://www.1secmail.com/api/v1"
MAILGW_BASE_URL = "https://api.mail.gw"
GUERRILLA_BASE_URL = "https://api.guerrillamail.com/ajax.php"

# Rate limiting configuration
PROVIDER_COOLDOWN_SECONDS = 60
RETRY_MAX_ATTEMPTS = 3
RETRY_BASE_DELAY = 1

# Domain cache
_domain_cache = {
    "mailtm": {"domains": [], "expires_at": 0},
    "1secmail": {"domains": [], "expires_at": 0},
    "mailgw": {"domains": [], "expires_at": 0},
    "guerrilla": {"domains": [], "expires_at": 0}
}
DOMAIN_CACHE_TTL = 300  # 5 minutes

# Provider stats
_provider_stats = {
    "mailtm": {"success": 0, "failures": 0, "cooldown_until": 0},
    "1secmail": {"success": 0, "failures": 0, "cooldown_until": 0},
    "mailgw": {"success": 0, "failures": 0, "cooldown_until": 0},
    "guerrilla": {"success": 0, "failures": 0, "cooldown_until": 0},
    "tempmail_lol": {"success": 0, "failures": 0, "cooldown_until": 0}
}

# Browser headers
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.1secmail.com/",
    "Origin": "https://www.1secmail.com"
}

# Pydantic Models
class TempEmailSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: int
    address: str
    password: str
    token: str
    account_id: str
    created_at: str
    expires_at: str
    message_count: int = 0
    provider: str = "mailtm"
    username: Optional[str] = ""
    domain: Optional[str] = ""


class EmailHistorySchema(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: int
    address: str
    password: str
    token: str
    account_id: str
    created_at: str
    expired_at: str
    message_count: int = 0


class CreateEmailRequest(BaseModel):
    username: Optional[str] = None
    service: Optional[str] = "auto"
    domain: Optional[str] = None


class CreateEmailResponse(BaseModel):
    id: int
    address: str
    created_at: str
    expires_at: str
    provider: str
    service_name: str


class DeleteHistoryRequest(BaseModel):
    ids: Optional[List[int]] = None


# Helper functions
def is_provider_in_cooldown(provider: str) -> bool:
    """Check if provider is in cooldown"""
    now = datetime.now(timezone.utc).timestamp()
    stats = _provider_stats.get(provider, {})
    cooldown_until = stats.get("cooldown_until", 0)
    
    if now < cooldown_until:
        remaining = int(cooldown_until - now)
        logging.warning(f"⏸️ {provider} is in cooldown (remaining: {remaining}s)")
        return True
    return False


def set_provider_cooldown(provider: str, duration: int):
    """Set cooldown for a provider"""
    now = datetime.now(timezone.utc).timestamp()
    _provider_stats[provider]["cooldown_until"] = now + duration
    logging.warning(f"🔒 {provider} cooldown set for {duration}s")


def clear_provider_cooldown(provider: str):
    """Clear cooldown for a provider"""
    _provider_stats[provider]["cooldown_until"] = 0
    logging.info(f"🔓 {provider} cooldown cleared")


# ============================================
# Mail.tm Provider Functions
# ============================================

async def get_mailtm_domains():
    """Get available domains from Mail.tm with caching"""
    now = datetime.now(timezone.utc).timestamp()
    cache = _domain_cache["mailtm"]
    
    if cache["domains"] and now < cache["expires_at"]:
        logging.info(f"✅ Using cached Mail.tm domains (TTL: {int(cache['expires_at'] - now)}s)")
        return cache["domains"]
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{MAILTM_BASE_URL}/domains")
            response.raise_for_status()
            data = response.json()
            domains = data.get("hydra:member", [])
            if domains:
                domain_list = [d["domain"] for d in domains]
                cache["domains"] = domain_list
                cache["expires_at"] = now + DOMAIN_CACHE_TTL
                logging.info(f"✅ Cached {len(domain_list)} Mail.tm domains")
                return domain_list
            return []
        except Exception as e:
            logging.error(f"❌ Mail.tm domains error: {e}")
            if cache["domains"]:
                logging.warning("⚠️ Using expired cache due to API error")
                return cache["domains"]
            return []


async def create_mailtm_account(address: str, password: str):
    """Create account on Mail.tm"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(
                f"{MAILTM_BASE_URL}/accounts",
                json={"address": address, "password": password}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                logging.warning("⚠️ Mail.tm rate limited (429)")
                raise HTTPException(status_code=429, detail="Mail.tm rate limited")
            raise


async def get_mailtm_token(address: str, password: str):
    """Get authentication token from Mail.tm"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(
                f"{MAILTM_BASE_URL}/token",
                json={"address": address, "password": password}
            )
            response.raise_for_status()
            return response.json()["token"]
        except Exception as e:
            logging.error(f"Error getting Mail.tm token: {e}")
            raise


async def get_mailtm_messages(token: str):
    """Get messages from Mail.tm"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{MAILTM_BASE_URL}/messages",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            data = response.json()
            return data.get("hydra:member", [])
        except Exception as e:
            logging.error(f"Error getting Mail.tm messages: {e}")
            return []


async def get_mailtm_message_detail(token: str, message_id: str):
    """Get message detail from Mail.tm with proper HTML normalization"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{MAILTM_BASE_URL}/messages/{message_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            data = response.json()
            
            # Normalize html and text to always be arrays
            if "html" in data:
                if isinstance(data["html"], list):
                    pass
                elif isinstance(data["html"], str):
                    data["html"] = [data["html"]] if data["html"] else []
                else:
                    data["html"] = []
            else:
                data["html"] = []
            
            if "text" in data:
                if isinstance(data["text"], list):
                    pass
                elif isinstance(data["text"], str):
                    data["text"] = [data["text"]] if data["text"] else []
                else:
                    data["text"] = []
            else:
                data["text"] = []
            
            return data
        except Exception as e:
            logging.error(f"Error getting Mail.tm message detail: {e}")
            return None


# ============================================
# 1secmail Provider Functions
# ============================================

async def get_1secmail_domains():
    """Get available domains from 1secmail with caching and fallback"""
    now = datetime.now(timezone.utc).timestamp()
    cache = _domain_cache["1secmail"]
    
    if cache["domains"] and now < cache["expires_at"]:
        logging.info(f"✅ Using cached 1secmail domains (TTL: {int(cache['expires_at'] - now)}s)")
        return cache["domains"]
    
    FALLBACK_DOMAINS = [
        "1secmail.com", "1secmail.org", "1secmail.net",
        "wwjmp.com", "esiix.com", "xojxe.com", "yoggm.com"
    ]
    
    for attempt in range(RETRY_MAX_ATTEMPTS):
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                enhanced_headers = {
                    **BROWSER_HEADERS,
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "cross-site"
                }
                
                response = await client.get(
                    f"{ONESECMAIL_BASE_URL}/?action=getDomainList",
                    headers=enhanced_headers,
                    follow_redirects=True
                )
                response.raise_for_status()
                domains = response.json()
                
                if isinstance(domains, list) and domains:
                    cache["domains"] = domains
                    cache["expires_at"] = now + DOMAIN_CACHE_TTL
                    logging.info(f"✅ Cached {len(domains)} 1secmail domains from API")
                    return domains
            except Exception as e:
                logging.error(f"❌ 1secmail API error (attempt {attempt + 1}): {e}")
                if attempt < RETRY_MAX_ATTEMPTS - 1:
                    await asyncio.sleep(RETRY_BASE_DELAY * (2 ** attempt))
    
    if cache["domains"]:
        logging.warning("⚠️ Using expired cache due to API errors")
        return cache["domains"]
    
    logging.warning(f"⚠️ 1secmail API unavailable, using {len(FALLBACK_DOMAINS)} fallback domains")
    cache["domains"] = FALLBACK_DOMAINS
    cache["expires_at"] = now + DOMAIN_CACHE_TTL
    return FALLBACK_DOMAINS


async def create_1secmail_account(username: str, domain: str):
    """Create 1secmail account"""
    address = f"{username}@{domain}"
    return {
        "address": address,
        "password": "no-password",
        "token": address,
        "account_id": address
    }


async def get_1secmail_messages(username: str, domain: str):
    """Get messages from 1secmail"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{ONESECMAIL_BASE_URL}/?action=getMessages&login={username}&domain={domain}",
                headers=BROWSER_HEADERS
            )
            response.raise_for_status()
            messages = response.json()
            
            transformed = []
            for msg in messages:
                transformed.append({
                    "id": str(msg["id"]),
                    "from": {
                        "address": msg.get("from", "unknown"),
                        "name": msg.get("from", "unknown")
                    },
                    "subject": msg.get("subject", "No Subject"),
                    "createdAt": msg.get("date", datetime.now(timezone.utc).isoformat())
                })
            return transformed
        except Exception as e:
            logging.error(f"Error getting 1secmail messages: {e}")
            return []


async def get_1secmail_message_detail(username: str, domain: str, message_id: str):
    """Get message detail from 1secmail"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{ONESECMAIL_BASE_URL}/?action=readMessage&login={username}&domain={domain}&id={message_id}",
                headers=BROWSER_HEADERS
            )
            response.raise_for_status()
            msg = response.json()
            
            return {
                "id": str(msg["id"]),
                "from": {
                    "address": msg.get("from", "unknown"),
                    "name": msg.get("from", "unknown")
                },
                "subject": msg.get("subject", "No Subject"),
                "createdAt": msg.get("date", datetime.now(timezone.utc).isoformat()),
                "html": [msg.get("htmlBody", "")] if msg.get("htmlBody") else [],
                "text": [msg.get("textBody", "")] if msg.get("textBody") else []
            }
        except Exception as e:
            logging.error(f"Error getting 1secmail message detail: {e}")
            return None


# ============================================
# Mail.gw Provider Functions
# ============================================

async def get_mailgw_domains():
    """Get available domains from mail.gw with caching"""
    now = datetime.now(timezone.utc).timestamp()
    cache = _domain_cache["mailgw"]
    
    if cache["domains"] and now < cache["expires_at"]:
        logging.info(f"✅ Using cached mail.gw domains (TTL: {int(cache['expires_at'] - now)}s)")
        return cache["domains"]
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{MAILGW_BASE_URL}/domains")
            response.raise_for_status()
            data = response.json()
            domains = data.get("hydra:member", [])
            if domains:
                domain_list = [d["domain"] for d in domains]
                cache["domains"] = domain_list
                cache["expires_at"] = now + DOMAIN_CACHE_TTL
                logging.info(f"✅ Cached {len(domain_list)} mail.gw domains")
                return domain_list
            return []
        except Exception as e:
            logging.error(f"❌ Mail.gw domains error: {e}")
            if cache["domains"]:
                return cache["domains"]
            return []


async def create_mailgw_account(address: str, password: str):
    """Create account on mail.gw"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            logging.info(f"📧 Creating Mail.gw account: {address}")
            response = await client.post(
                f"{MAILGW_BASE_URL}/accounts",
                json={"address": address, "password": password}
            )
            response.raise_for_status()
            logging.info(f"✅ Mail.gw account created successfully")
            return response.json()
        except httpx.TimeoutException as e:
            logging.error(f"❌ Mail.gw timeout: {str(e)}")
            raise Exception(f"Mail.gw timeout after 30s")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                logging.warning("⚠️ Mail.gw rate limited (429)")
                raise HTTPException(status_code=429, detail="Mail.gw rate limited")
            error_text = e.response.text[:200] if e.response.text else "No error message"
            logging.error(f"❌ Mail.gw HTTP error: {e.response.status_code} - {error_text}")
            raise Exception(f"Mail.gw HTTP {e.response.status_code}")
        except Exception as e:
            error_msg = str(e) if str(e) else repr(e)
            logging.error(f"❌ Mail.gw connection error: {error_msg}")
            raise Exception(f"Mail.gw failed: {error_msg}")


async def get_mailgw_token(address: str, password: str):
    """Get authentication token from mail.gw"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(
                f"{MAILGW_BASE_URL}/token",
                json={"address": address, "password": password}
            )
            response.raise_for_status()
            return response.json()["token"]
        except Exception as e:
            logging.error(f"Error getting mail.gw token: {e}")
            raise


async def get_mailgw_messages(token: str):
    """Get messages from mail.gw"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{MAILGW_BASE_URL}/messages",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            data = response.json()
            return data.get("hydra:member", [])
        except Exception as e:
            logging.error(f"Error getting mail.gw messages: {e}")
            return []


async def get_mailgw_message_detail(token: str, message_id: str):
    """Get message detail from mail.gw with proper HTML normalization"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{MAILGW_BASE_URL}/messages/{message_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            data = response.json()
            
            # Normalize html and text to always be arrays
            if "html" in data:
                if isinstance(data["html"], list):
                    pass
                elif isinstance(data["html"], str):
                    data["html"] = [data["html"]] if data["html"] else []
                else:
                    data["html"] = []
            else:
                data["html"] = []
            
            if "text" in data:
                if isinstance(data["text"], list):
                    pass
                elif isinstance(data["text"], str):
                    data["text"] = [data["text"]] if data["text"] else []
                else:
                    data["text"] = []
            else:
                data["text"] = []
            
            return data
        except Exception as e:
            logging.error(f"Error getting mail.gw message detail: {e}")
            return None


# ============================================
# Guerrilla Mail Provider Functions - ENHANCED FIX
# ============================================

async def get_guerrilla_domains():
    """Get available domains from Guerrilla Mail"""
    now = datetime.now(timezone.utc).timestamp()
    cache = _domain_cache["guerrilla"]
    
    if cache["domains"] and now < cache["expires_at"]:
        logging.info(f"✅ Using cached Guerrilla domains (TTL: {int(cache['expires_at'] - now)}s)")
        return cache["domains"]
    
    default_domains = ["guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "sharklasers.com", "spam4.me"]
    cache["domains"] = default_domains
    cache["expires_at"] = now + DOMAIN_CACHE_TTL
    logging.info(f"✅ Cached {len(default_domains)} Guerrilla domains")
    return default_domains


async def create_guerrilla_account(username: str, domain: str):
    """Create Guerrilla Mail account"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{GUERRILLA_BASE_URL}?f=set_email_user&email_user={username}&lang=en&site=guerrillamail.com"
            )
            response.raise_for_status()
            data = response.json()
            
            address = data.get("email_addr", f"{username}@{domain}")
            sid_token = data.get("sid_token", "")
            
            return {
                "address": address,
                "password": "no-password",
                "token": sid_token,
                "account_id": sid_token
            }
        except Exception as e:
            logging.error(f"Error creating Guerrilla account: {e}")
            address = f"{username}@{domain}"
            import uuid
            return {
                "address": address,
                "password": "no-password",
                "token": str(uuid.uuid4()),
                "account_id": str(uuid.uuid4())
            }


async def get_guerrilla_messages(sid_token: str):
    """Get messages from Guerrilla Mail"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{GUERRILLA_BASE_URL}?f=get_email_list&offset=0&sid_token={sid_token}"
            )
            response.raise_for_status()
            data = response.json()
            messages = data.get("list", [])
            
            transformed = []
            for msg in messages:
                transformed.append({
                    "id": str(msg.get("mail_id", "")),
                    "from": {
                        "address": msg.get("mail_from", "unknown"),
                        "name": msg.get("mail_from", "unknown")
                    },
                    "subject": msg.get("mail_subject", "No Subject"),
                    "createdAt": msg.get("mail_timestamp", datetime.now(timezone.utc).isoformat())
                })
            return transformed
        except Exception as e:
            logging.error(f"Error getting Guerrilla messages: {e}")
            return []


async def get_guerrilla_message_detail(sid_token: str, message_id: str):
    """Get message detail from Guerrilla Mail - FIXED HTML RENDERING"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{GUERRILLA_BASE_URL}?f=fetch_email&email_id={message_id}&sid_token={sid_token}"
            )
            response.raise_for_status()
            data = response.json()
            
            # CRITICAL FIX: Get mail_body which contains HTML content
            mail_body = data.get("mail_body", "")
            
            # Also check mail_excerpt as fallback
            if not mail_body:
                mail_body = data.get("mail_excerpt", "")
            
            # IMPORTANT: Ensure content is returned as array (consistent with other providers)
            html_content = [mail_body] if mail_body else []
            text_content = [mail_body] if mail_body else []
            
            logging.info(f"📧 Guerrilla message detail - ID: {message_id}, HTML length: {len(mail_body)}")
            
            return {
                "id": str(data.get("mail_id", message_id)),
                "from": {
                    "address": data.get("mail_from", "unknown"),
                    "name": data.get("mail_from", "unknown")
                },
                "subject": data.get("mail_subject", "No Subject"),
                "createdAt": data.get("mail_timestamp", datetime.now(timezone.utc).isoformat()),
                "html": html_content,
                "text": text_content
            }
        except Exception as e:
            logging.error(f"❌ Error getting Guerrilla message detail: {e}")
            return None


# ============================================
# Multi-Provider Email Creation with Failover
# ============================================

async def create_email_with_failover(username: Optional[str] = None, preferred_service: str = "auto", preferred_domain: Optional[str] = None):
    """Create email with smart failover between providers"""
    
    if not username:
        username = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
    
    password = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    
    if preferred_service == "mailtm":
        providers_to_try = ["mailtm"]
    elif preferred_service == "1secmail":
        providers_to_try = ["1secmail"]
    elif preferred_service == "mailgw":
        providers_to_try = ["mailgw"]
    elif preferred_service == "guerrilla":
        providers_to_try = ["guerrilla"]
    else:
        # Auto mode: try all providers in random order
        providers_to_try = ["mailtm", "mailgw", "guerrilla", "1secmail"]
        random.shuffle(providers_to_try)
        logging.info(f"🎲 Random provider order: {providers_to_try}")
    
    errors = []
    skipped_providers = []
    
    for provider in providers_to_try:
        if is_provider_in_cooldown(provider):
            skipped_providers.append(provider)
            logging.info(f"⏭️ Skipping {provider} (in cooldown)")
            continue
        
        try:
            logging.info(f"🔄 Trying {provider}...")
            
            if provider == "mailtm":
                domains = await get_mailtm_domains()
                if not domains:
                    continue
                domain = preferred_domain if preferred_domain in domains else domains[0]
                address = f"{username}@{domain}"
                account_data = await create_mailtm_account(address, password)
                token = await get_mailtm_token(address, password)
                
                clear_provider_cooldown(provider)
                _provider_stats[provider]["success"] += 1
                logging.info(f"✅ Mail.tm email created: {address}")
                
                return {
                    "address": address,
                    "password": password,
                    "token": token,
                    "account_id": account_data["id"],
                    "provider": "mailtm",
                    "service_name": "Mail.tm",
                    "username": username,
                    "domain": domain
                }
            
            elif provider == "mailgw":
                domains = await get_mailgw_domains()
                if not domains:
                    continue
                domain = preferred_domain if preferred_domain in domains else domains[0]
                address = f"{username}@{domain}"
                account_data = await create_mailgw_account(address, password)
                token = await get_mailgw_token(address, password)
                
                clear_provider_cooldown(provider)
                _provider_stats[provider]["success"] += 1
                logging.info(f"✅ Mail.gw email created: {address}")
                
                return {
                    "address": address,
                    "password": password,
                    "token": token,
                    "account_id": account_data["id"],
                    "provider": "mailgw",
                    "service_name": "Mail.gw",
                    "username": username,
                    "domain": domain
                }
            
            elif provider == "1secmail":
                domains = await get_1secmail_domains()
                if not domains:
                    continue
                domain = preferred_domain if preferred_domain in domains else domains[0]
                account_data = await create_1secmail_account(username, domain)
                
                clear_provider_cooldown(provider)
                _provider_stats[provider]["success"] += 1
                logging.info(f"✅ 1secmail email created: {account_data['address']}")
                
                return {
                    "address": account_data["address"],
                    "password": account_data["password"],
                    "token": account_data["token"],
                    "account_id": account_data["account_id"],
                    "provider": "1secmail",
                    "service_name": "1secmail",
                    "username": username,
                    "domain": domain
                }
            
            elif provider == "guerrilla":
                domains = await get_guerrilla_domains()
                if not domains:
                    continue
                domain = preferred_domain if preferred_domain in domains else domains[0]
                account_data = await create_guerrilla_account(username, domain)
                
                clear_provider_cooldown(provider)
                _provider_stats[provider]["success"] += 1
                logging.info(f"✅ Guerrilla email created: {account_data['address']}")
                
                return {
                    "address": account_data["address"],
                    "password": account_data["password"],
                    "token": account_data["token"],
                    "account_id": account_data["account_id"],
                    "provider": "guerrilla",
                    "service_name": "Guerrilla Mail",
                    "username": username,
                    "domain": domain
                }
                
        except HTTPException as e:
            if e.status_code == 429:
                set_provider_cooldown(provider, PROVIDER_COOLDOWN_SECONDS)
                _provider_stats[provider]["failures"] += 1
                errors.append(f"{provider}: rate limited")
            else:
                errors.append(f"{provider}: {str(e)}")
        except Exception as e:
            logging.error(f"❌ {provider} failed: {e}")
            _provider_stats[provider]["failures"] += 1
            errors.append(f"{provider}: {str(e)}")
    
    raise HTTPException(
        status_code=503,
        detail=f"Tất cả dịch vụ email đều không khả dụng. Lỗi: {', '.join(errors)}"
    )


# ============================================
# API Routes
# ============================================

@api_router.get("/")
async def root():
    """API root with provider status"""
    now = datetime.now(timezone.utc).timestamp()
    
    for provider in _provider_stats:
        stats = _provider_stats[provider]
        cooldown_until = stats.get("cooldown_until", 0)
        
        if now < cooldown_until:
            stats["status"] = f"cooldown ({int(cooldown_until - now)}s remaining)"
        else:
            stats["status"] = "active"
        
        total = stats["success"] + stats["failures"]
        if total > 0:
            stats["success_rate"] = f"{(stats['success'] / total * 100):.1f}%"
        else:
            stats["success_rate"] = "N/A"
    
    return {
        "message": "TempMail API - MySQL with Multiple Providers",
        "providers": ["Mail.tm", "Mail.gw", "1secmail", "Guerrilla Mail"],
        "stats": _provider_stats,
        "config": {
            "provider_cooldown": f"{PROVIDER_COOLDOWN_SECONDS}s",
            "retry_attempts": RETRY_MAX_ATTEMPTS,
            "domain_cache_ttl": f"{DOMAIN_CACHE_TTL}s"
        }
    }


@api_router.post("/emails/create", response_model=CreateEmailResponse)
async def create_email(request: CreateEmailRequest, db: Session = Depends(get_db)):
    """Create a new temporary email with automatic provider failover"""
    try:
        email_data = await create_email_with_failover(
            username=request.username,
            preferred_service=request.service or "auto",
            preferred_domain=request.domain
        )
        
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=10)
        
        email_doc = TempEmail(
            address=email_data["address"],
            password=email_data["password"],
            token=email_data["token"],
            account_id=email_data["account_id"],
            created_at=now,
            expires_at=expires_at,
            message_count=0,
            provider=email_data["provider"],
            username=email_data["username"],
            domain=email_data["domain"]
        )
        
        db.add(email_doc)
        db.commit()
        db.refresh(email_doc)
        
        logging.info(f"✅ Email created: {email_doc.address} (Provider: {email_doc.provider})")
        
        return CreateEmailResponse(
            id=email_doc.id,
            address=email_doc.address,
            created_at=email_doc.created_at.isoformat(),
            expires_at=email_doc.expires_at.isoformat(),
            provider=email_doc.provider,
            service_name=email_data["service_name"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"❌ Error creating email: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create email: {str(e)}")


@api_router.get("/emails", response_model=List[TempEmailSchema])
async def get_emails(db: Session = Depends(get_db)):
    """Get all temporary emails"""
    emails = db.query(TempEmail).order_by(TempEmail.created_at.desc()).all()
    return [TempEmailSchema(**email.to_dict()) for email in emails]


@api_router.get("/emails/{email_id}")
async def get_email(email_id: int, db: Session = Depends(get_db)):
    """Get email by ID"""
    email = db.query(TempEmail).filter(TempEmail.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return email.to_dict()


@api_router.get("/emails/{email_id}/messages")
async def get_email_messages(email_id: int, db: Session = Depends(get_db)):
    """Get messages for an email"""
    email = db.query(TempEmail).filter(TempEmail.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    provider = email.provider
    
    if provider == "mailtm":
        messages = await get_mailtm_messages(email.token)
    elif provider == "mailgw":
        messages = await get_mailgw_messages(email.token)
    elif provider == "1secmail":
        username = email.username or email.address.split("@")[0]
        domain = email.domain or email.address.split("@")[1]
        messages = await get_1secmail_messages(username, domain)
    elif provider == "guerrilla":
        messages = await get_guerrilla_messages(email.token)
    else:
        messages = []
    
    email.message_count = len(messages)
    db.commit()
    
    return {"messages": messages, "count": len(messages)}


@api_router.get("/emails/{email_id}/messages/{message_id}")
async def get_message_detail(email_id: int, message_id: str, db: Session = Depends(get_db)):
    """Get message detail"""
    email = db.query(TempEmail).filter(TempEmail.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    provider = email.provider
    
    if provider == "mailtm":
        message = await get_mailtm_message_detail(email.token, message_id)
    elif provider == "mailgw":
        message = await get_mailgw_message_detail(email.token, message_id)
    elif provider == "1secmail":
        username = email.username or email.address.split("@")[0]
        domain = email.domain or email.address.split("@")[1]
        message = await get_1secmail_message_detail(username, domain, message_id)
    elif provider == "guerrilla":
        message = await get_guerrilla_message_detail(email.token, message_id)
    else:
        message = None
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return message


@api_router.post("/emails/{email_id}/refresh")
async def refresh_messages(email_id: int, db: Session = Depends(get_db)):
    """Refresh messages for an email"""
    email = db.query(TempEmail).filter(TempEmail.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    provider = email.provider
    
    if provider == "mailtm":
        messages = await get_mailtm_messages(email.token)
    elif provider == "mailgw":
        messages = await get_mailgw_messages(email.token)
    elif provider == "1secmail":
        username = email.username or email.address.split("@")[0]
        domain = email.domain or email.address.split("@")[1]
        messages = await get_1secmail_messages(username, domain)
    elif provider == "guerrilla":
        messages = await get_guerrilla_messages(email.token)
    else:
        messages = []
    
    email.message_count = len(messages)
    db.commit()
    
    return {"messages": messages, "count": len(messages)}


@api_router.delete("/emails/{email_id}")
async def delete_email(email_id: int, db: Session = Depends(get_db)):
    """Delete a temporary email"""
    email = db.query(TempEmail).filter(TempEmail.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    db.delete(email)
    db.commit()
    
    return {"status": "deleted"}


@api_router.post("/emails/{email_id}/extend-time")
async def extend_email_time(email_id: int, db: Session = Depends(get_db)):
    """Extend email expiry time by resetting to 10 minutes from now"""
    email = db.query(TempEmail).filter(TempEmail.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    now = datetime.now(timezone.utc)
    new_expires_at = now + timedelta(minutes=10)
    
    email.expires_at = new_expires_at
    db.commit()
    
    logging.info(f"⏰ Extended time for {email.address}: {new_expires_at.isoformat()}")
    
    return {
        "status": "extended",
        "expires_at": new_expires_at.isoformat()
    }


@api_router.get("/emails/history/list", response_model=List[EmailHistorySchema])
async def get_email_history(db: Session = Depends(get_db)):
    """Get all emails in history"""
    history = db.query(EmailHistory).order_by(EmailHistory.expired_at.desc()).all()
    return [EmailHistorySchema(**email.to_dict()) for email in history]


@api_router.get("/emails/history/{email_id}/messages")
async def get_history_email_messages(email_id: int, db: Session = Depends(get_db)):
    """Get messages for a history email"""
    email = db.query(EmailHistory).filter(EmailHistory.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found in history")
    
    # Try to get messages (may not work if provider deleted the account)
    messages = []
    return {"messages": messages, "count": len(messages)}


@api_router.get("/emails/history/{email_id}/messages/{message_id}")
async def get_history_message_detail(email_id: int, message_id: str, db: Session = Depends(get_db)):
    """Get message detail for a history email"""
    email = db.query(EmailHistory).filter(EmailHistory.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found in history")
    
    # Cannot get messages from history
    raise HTTPException(status_code=404, detail="Message not found")


@api_router.delete("/emails/history/delete")
async def delete_history_emails(request: DeleteHistoryRequest, db: Session = Depends(get_db)):
    """Delete history emails"""
    try:
        if request.ids and len(request.ids) > 0:
            deleted = db.query(EmailHistory).filter(EmailHistory.id.in_(request.ids)).delete(synchronize_session=False)
        else:
            deleted = db.query(EmailHistory).delete(synchronize_session=False)
        
        db.commit()
        
        return {
            "status": "deleted",
            "count": deleted
        }
    except Exception as e:
        logging.error(f"Error deleting history emails: {e}")
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ============================================
# SAVED EMAILS ENDPOINTS
# ============================================

@api_router.post("/emails/{email_id}/messages/{message_id}/save")
async def save_message(email_id: int, message_id: str, db: Session = Depends(get_db)):
    """Save a message to saved emails collection"""
    try:
        email = db.query(TempEmail).filter(TempEmail.id == email_id).first()
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")
        
        # Get message detail
        message = None
        provider = email.provider
        
        if provider == "mailtm":
            message = await get_mailtm_message_detail(email.token, message_id)
        elif provider == "mailgw":
            message = await get_mailgw_message_detail(email.token, message_id)
        elif provider == "guerrilla":
            message = await get_guerrilla_message_detail(email.token, message_id)
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Check if already saved
        existing = db.query(SavedEmail).filter(
            SavedEmail.email_address == email.address,
            SavedEmail.message_id == message_id
        ).first()
        
        if existing:
            return {
                "status": "already_saved",
                "message": "Email đã được lưu trước đó",
                "id": existing.id
            }
        
        # Extract content
        html_content = None
        text_content = None
        
        if "html" in message:
            if isinstance(message["html"], list) and len(message["html"]) > 0:
                html_content = message["html"][0]
            elif isinstance(message["html"], str):
                html_content = message["html"]
        
        if "text" in message:
            if isinstance(message["text"], list) and len(message["text"]) > 0:
                text_content = message["text"][0]
            elif isinstance(message["text"], str):
                text_content = message["text"]
        
        # Parse createdAt
        try:
            created_at = datetime.fromisoformat(message.get("createdAt", datetime.now(timezone.utc).isoformat()).replace('Z', '+00:00'))
        except:
            created_at = datetime.now(timezone.utc)
        
        # Create saved email document
        saved_email = SavedEmail(
            email_address=email.address,
            message_id=message_id,
            subject=message.get("subject", ""),
            from_address=message.get("from", {}).get("address", "") if isinstance(message.get("from"), dict) else "",
            from_name=message.get("from", {}).get("name", "") if isinstance(message.get("from"), dict) else "",
            html=html_content,
            text=text_content,
            created_at=created_at,
            saved_at=datetime.now(timezone.utc)
        )
        
        db.add(saved_email)
        db.commit()
        db.refresh(saved_email)
        
        logging.info(f"💾 Saved message {message_id} from {email.address}")
        
        return {
            "status": "saved",
            "message": "Email đã được lưu thành công",
            "id": saved_email.id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error saving message: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/emails/{email_id}/save")
async def save_email(email_id: int, db: Session = Depends(get_db)):
    """Save an email"""
    try:
        email = db.query(TempEmail).filter(TempEmail.id == email_id).first()
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")
        
        return {
            "status": "success",
            "message": "Email saved successfully",
            "id": email.id,
            "address": email.address,
            "provider": email.provider,
            "saved_at": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error saving email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/emails/saved/list")
async def get_saved_emails(db: Session = Depends(get_db)):
    """Get all saved emails"""
    try:
        saved_emails = db.query(SavedEmail).order_by(SavedEmail.saved_at.desc()).all()
        return [email.to_dict() for email in saved_emails]
    except Exception as e:
        logging.error(f"Error getting saved emails: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/emails/saved/{saved_id}")
async def get_saved_email_detail(saved_id: int, db: Session = Depends(get_db)):
    """Get a specific saved email with full content"""
    try:
        saved_email = db.query(SavedEmail).filter(SavedEmail.id == saved_id).first()
        
        if not saved_email:
            raise HTTPException(status_code=404, detail="Saved email not found")
        
        return saved_email.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting saved email detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class DeleteSavedRequest(BaseModel):
    ids: Optional[List[int]] = None


@api_router.delete("/emails/saved/delete")
async def delete_saved_emails(request: DeleteSavedRequest, db: Session = Depends(get_db)):
    """Delete saved emails"""
    try:
        if request.ids and len(request.ids) > 0:
            deleted = db.query(SavedEmail).filter(SavedEmail.id.in_(request.ids)).delete(synchronize_session=False)
        else:
            deleted = db.query(SavedEmail).delete(synchronize_session=False)
        
        db.commit()
        
        return {
            "status": "deleted",
            "count": deleted
        }
    except Exception as e:
        logging.error(f"Error deleting saved emails: {e}")
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/domains")
async def get_domains(service: str = "auto"):
    """Get available domains for a service"""
    domains = []
    
    if service == "mailtm":
        domains = await get_mailtm_domains()
    elif service == "mailgw":
        domains = await get_mailgw_domains()
    elif service == "1secmail":
        domains = await get_1secmail_domains()
    elif service == "guerrilla":
        domains = await get_guerrilla_domains()
    elif service == "auto":
        mailtm_domains = await get_mailtm_domains()
        if mailtm_domains:
            domains = mailtm_domains
        else:
            onesec_domains = await get_1secmail_domains()
            if onesec_domains:
                domains = onesec_domains
            else:
                mailgw_domains = await get_mailgw_domains()
                if mailgw_domains:
                    domains = mailgw_domains
                else:
                    guerrilla_domains = await get_guerrilla_domains()
                    domains = guerrilla_domains
    
    return {"domains": domains, "service": service}


# Startup event to start background tasks
@app.on_event("startup")
async def startup_event():
    """Start background tasks on application startup"""
    asyncio.create_task(background_task_loop())
    logging.info("✅ Application started with background tasks (MySQL)")
    logging.info("✅ Active providers: Mail.tm, 1secmail, Mail.gw, Guerrilla Mail")


async def background_task_loop():
    """Main background task loop"""
    CHECK_INTERVAL = 30
    logging.info(f"🚀 Background task started - checking every {CHECK_INTERVAL}s")
    
    while True:
        try:
            db = SessionLocal()
            now = datetime.now(timezone.utc)
            
            # Find expired emails
            expired_emails = db.query(TempEmail).filter(TempEmail.expires_at <= now).all()
            
            if expired_emails:
                logging.info(f"Found {len(expired_emails)} expired emails")
                
                for email in expired_emails:
                    try:
                        # Move to history
                        history_email = EmailHistory(
                            address=email.address,
                            password=email.password,
                            token=email.token,
                            account_id=email.account_id,
                            created_at=email.created_at,
                            expired_at=email.expires_at,
                            message_count=email.message_count
                        )
                        
                        db.add(history_email)
                        db.delete(email)
                        db.commit()
                        
                        logging.info(f"Moved email to history: {email.address}")
                    except Exception as e:
                        logging.error(f"Error moving email {email.address} to history: {e}")
                        db.rollback()
                        continue
            
            db.close()
        except Exception as e:
            logging.error(f"❌ Error in background task loop: {e}")
        
        await asyncio.sleep(CHECK_INTERVAL)


# CORS configuration
cors_origins = os.environ.get('CORS_ORIGINS', '*')
if cors_origins == '*':
    allow_origins = ['*']
    allow_credentials = False
else:
    allow_origins = cors_origins.split(',')
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the router in the main app
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
