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
SMTPLABS_BASE_URL = "https://api.smtp.dev"

# Multiple SMTP Labs API Keys for load balancing and failover
SMTPLABS_API_KEYS = []
for i in range(1, 10):  # Support up to 9 keys
    key = os.environ.get(f'SMTPLABS_API_KEY_{i}', '').strip()
    if key:
        SMTPLABS_API_KEYS.append(key)
        logging.info(f"✅ Loaded SMTPLABS_API_KEY_{i}")

# Fallback to old single key format for backward compatibility
if not SMTPLABS_API_KEYS:
    old_key = os.environ.get('SMTPLABS_API_KEY', '').strip()
    if old_key:
        SMTPLABS_API_KEYS.append(old_key)
        logging.info("✅ Loaded legacy SMTPLABS_API_KEY")

logging.info(f"📧 SMTPLabs: {len(SMTPLABS_API_KEYS)} API key(s) loaded")

# Rate limiting tracking (in-memory)
# In production, use Redis or database
_rate_limit_tracker = {
    "last_create_time": 0,
    "create_count": 0,
    "reset_time": 0
}

# Domain cache to reduce API calls
_domain_cache = {
    "domain": None,
    "cached_at": 0,
    "ttl": 300  # Cache for 5 minutes
}

# Provider tracking for fallback (per key)
_provider_stats = {
    "mailtm": {"success": 0, "failures": 0, "last_failure": 0}
}

# Initialize stats for each SMTP key
for i, key in enumerate(SMTPLABS_API_KEYS, 1):
    _provider_stats[f"smtplabs_key{i}"] = {
        "success": 0, 
        "failures": 0, 
        "last_failure": 0,
        "last_success": 0
    }

# Track current key index for round-robin
_current_smtp_key_index = 0


# Pydantic Models
class TempEmailSchema(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)
    
    id: str
    address: str
    password: str
    token: str
    account_id: str
    created_at: datetime
    expires_at: datetime
    message_count: int = 0


class EmailHistorySchema(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)
    
    id: str
    address: str
    password: str
    token: str
    account_id: str
    created_at: datetime
    expired_at: datetime
    message_count: int = 0


class CreateEmailRequest(BaseModel):
    username: Optional[str] = None


class CreateEmailResponse(BaseModel):
    id: str
    address: str
    created_at: datetime
    expires_at: datetime


class DeleteHistoryRequest(BaseModel):
    ids: Optional[List[str]] = None


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
# SMTPLabs Service Functions (Fallback Provider)
# ============================================================================

async def smtplabs_create_account(address: str, password: str):
    """Create account on SMTPLabs"""
    if not SMTPLABS_API_KEY:
        raise HTTPException(status_code=500, detail="SMTPLabs API key not configured")
    
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        for attempt in range(3):
            try:
                response = await http_client.post(
                    f"{SMTPLABS_BASE_URL}/accounts",
                    headers={
                        "X-API-KEY": SMTPLABS_API_KEY,
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    json={"address": address, "password": password}
                )
                response.raise_for_status()
                data = response.json()
                logging.info(f"✅ SMTPLabs account created: {address}")
                _provider_stats["smtplabs"]["success"] += 1
                return data
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    wait_time = 2 ** attempt
                    logging.warning(f"SMTPLabs rate limited, waiting {wait_time}s (attempt {attempt + 1}/3)")
                    if attempt < 2:
                        await asyncio.sleep(wait_time)
                    else:
                        _provider_stats["smtplabs"]["failures"] += 1
                        _provider_stats["smtplabs"]["last_failure"] = time.time()
                        raise HTTPException(status_code=429, detail="SMTPLabs API rate limit exceeded")
                else:
                    logging.error(f"SMTPLabs error creating account: {e}")
                    _provider_stats["smtplabs"]["failures"] += 1
                    _provider_stats["smtplabs"]["last_failure"] = time.time()
                    raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                logging.error(f"SMTPLabs error: {e}")
                _provider_stats["smtplabs"]["failures"] += 1
                _provider_stats["smtplabs"]["last_failure"] = time.time()
                raise HTTPException(status_code=400, detail=str(e))


async def smtplabs_get_mailboxes(account_id: str):
    """Get mailboxes for SMTPLabs account"""
    if not SMTPLABS_API_KEY:
        return []
    
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(
                f"{SMTPLABS_BASE_URL}/accounts/{account_id}/mailboxes",
                headers={
                    "X-API-KEY": SMTPLABS_API_KEY,
                    "Accept": "application/json"
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("hydra:member", [])
        except Exception as e:
            logging.error(f"Error getting SMTPLabs mailboxes: {e}")
            return []


async def smtplabs_get_messages(account_id: str, mailbox_id: str):
    """Get messages from SMTPLabs mailbox"""
    if not SMTPLABS_API_KEY:
        return []
    
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(
                f"{SMTPLABS_BASE_URL}/accounts/{account_id}/mailboxes/{mailbox_id}/messages",
                headers={
                    "X-API-KEY": SMTPLABS_API_KEY,
                    "Accept": "application/json"
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("hydra:member", [])
        except Exception as e:
            logging.error(f"Error getting SMTPLabs messages: {e}")
            return []


async def smtplabs_get_message_detail(account_id: str, mailbox_id: str, message_id: str):
    """Get message detail from SMTPLabs"""
    if not SMTPLABS_API_KEY:
        return None
    
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(
                f"{SMTPLABS_BASE_URL}/accounts/{account_id}/mailboxes/{mailbox_id}/messages/{message_id}",
                headers={
                    "X-API-KEY": SMTPLABS_API_KEY,
                    "Accept": "application/json"
                }
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logging.error(f"Error getting SMTPLabs message detail: {e}")
            return None


# ============================================================================
# Unified Email Creation with Fallback Logic
# ============================================================================

async def create_email_with_fallback(username: str = None):
    """
    Create email with provider fallback:
    1. Try Mail.tm first (free, no API key needed)
    2. If Mail.tm fails (429 or error), fallback to SMTPLabs
    """
    errors = []
    
    # Strategy 1: Try Mail.tm first
    try:
        logging.info("🔄 Attempting to create email via Mail.tm...")
        
        # Get available domain
        domain = await get_available_domains()
        if not domain:
            raise Exception("No domains available from Mail.tm")
        
        # Generate username
        if not username:
            username = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
        
        address = f"{username}@{domain}"
        password = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
        
        # Create account
        account_data = await create_mailtm_account(address, password)
        
        # Get token
        token = await get_mailtm_token(address, password)
        
        _provider_stats["mailtm"]["success"] += 1
        
        return {
            "provider": "mailtm",
            "address": address,
            "password": password,
            "token": token,
            "account_id": account_data["id"],
            "mailbox_id": None  # Mail.tm doesn't use separate mailbox IDs
        }
        
    except Exception as e:
        error_msg = str(e)
        errors.append(f"Mail.tm: {error_msg}")
        _provider_stats["mailtm"]["failures"] += 1
        _provider_stats["mailtm"]["last_failure"] = time.time()
        logging.warning(f"❌ Mail.tm failed: {error_msg}")
    
    # Strategy 2: Fallback to SMTPLabs
    if SMTPLABS_API_KEY:
        try:
            logging.info("🔄 Falling back to SMTPLabs...")
            
            # SMTPLabs needs custom domain from their service
            # Generate a unique email with smtp.dev domain
            if not username:
                username = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
            
            # SMTPLabs allows custom domains but we'll use a test pattern
            address = f"{username}@test.smtp.dev"  # Use their test domain
            password = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
            
            # Create account
            account_data = await smtplabs_create_account(address, password)
            
            # Get mailboxes to find inbox
            mailboxes = await smtplabs_get_mailboxes(account_data["id"])
            inbox_id = mailboxes[0]["id"] if mailboxes else None
            
            return {
                "provider": "smtplabs",
                "address": address,
                "password": password,
                "token": SMTPLABS_API_KEY,  # SMTPLabs uses API key, not per-account token
                "account_id": account_data["id"],
                "mailbox_id": inbox_id
            }
            
        except Exception as e:
            error_msg = str(e)
            errors.append(f"SMTPLabs: {error_msg}")
            logging.error(f"❌ SMTPLabs also failed: {error_msg}")
    else:
        errors.append("SMTPLabs: API key not configured")
        logging.warning("⚠️  SMTPLabs API key not configured, cannot use as fallback")
    
    # Both providers failed
    error_detail = " | ".join(errors)
    logging.error(f"❌ All providers failed: {error_detail}")
    raise HTTPException(
        status_code=503,
        detail=f"All email providers unavailable. Errors: {error_detail}"
    )



# API Routes
@api_router.get("/")
async def root():
    return {"message": "TempMail API - MySQL with Expiry"}


@api_router.post("/emails/create", response_model=CreateEmailResponse)
async def create_email(request: CreateEmailRequest, db: Session = Depends(get_db)):
    """Create a new temporary email with dual provider fallback (Mail.tm → SMTPLabs)"""
    try:
        # Check local rate limit (max 10 emails per minute for development)
        # TODO: Lower this to 3 for production
        current_time = time.time()
        MAX_EMAILS_PER_MINUTE = 10  # Increase for development/testing
        
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
        
        # Use unified email creation with fallback
        email_data = await create_email_with_fallback(username=request.username)
        
        # Calculate expiry time (10 minutes from now)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=10)
        
        # Save to database with provider info
        email = TempEmailModel(
            address=email_data["address"],
            password=email_data["password"],
            token=email_data["token"],
            account_id=email_data["account_id"],
            created_at=now,
            expires_at=expires_at,
            message_count=0
        )
        
        db.add(email)
        db.commit()
        db.refresh(email)
        
        return CreateEmailResponse(
            id=email.id,
            address=email.address,
            created_at=email.created_at,
            expires_at=email.expires_at
        )
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
async def get_email(email_id: str, db: Session = Depends(get_db)):
    """Get email by ID"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return email.to_dict()


@api_router.get("/emails/{email_id}/messages")
async def get_email_messages(email_id: str, db: Session = Depends(get_db)):
    """Get messages for an email"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Get messages from Mail.tm
    messages = await get_mailtm_messages(email.token)
    
    # Update message count
    email.message_count = len(messages)
    db.commit()
    
    return {"messages": messages, "count": len(messages)}


@api_router.get("/emails/{email_id}/messages/{message_id}")
async def get_message_detail(email_id: str, message_id: str, db: Session = Depends(get_db)):
    """Get message detail"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    message = await get_mailtm_message_detail(email.token, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return message


@api_router.post("/emails/{email_id}/refresh")
async def refresh_messages(email_id: str, db: Session = Depends(get_db)):
    """Refresh messages for an email"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    messages = await get_mailtm_messages(email.token)
    
    email.message_count = len(messages)
    db.commit()
    
    return {"messages": messages, "count": len(messages)}


@api_router.delete("/emails/{email_id}")
async def delete_email(email_id: str, db: Session = Depends(get_db)):
    """Delete a temporary email"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    db.delete(email)
    db.commit()
    
    return {"status": "deleted"}


@api_router.post("/emails/{email_id}/extend-time")
async def extend_email_time(email_id: str, db: Session = Depends(get_db)):
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
async def get_history_email_messages(email_id: str, db: Session = Depends(get_db)):
    """Get messages for a history email"""
    email = db.query(EmailHistoryModel).filter(EmailHistoryModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found in history")
    
    # Get messages from Mail.tm using the stored token
    messages = await get_mailtm_messages(email.token)
    
    return {"messages": messages, "count": len(messages)}


@api_router.get("/emails/history/{email_id}/messages/{message_id}")
async def get_history_message_detail(email_id: str, message_id: str, db: Session = Depends(get_db)):
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
