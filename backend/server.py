"""FastAPI server with MySQL, multiple email providers, and failover"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
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

# Email Provider URLs
MAILTM_BASE_URL = "https://api.mail.tm"
ONESECMAIL_BASE_URL = "https://www.1secmail.com/api/v1"

# Provider stats tracking
_provider_stats = {
    "mailtm": {"success": 0, "failures": 0, "last_failure_time": 0},
    "1secmail": {"success": 0, "failures": 0, "last_failure_time": 0}
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
    provider: str = "mailtm"
    username: Optional[str] = ""
    domain: Optional[str] = ""


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
    service: Optional[str] = "auto"  # auto, mailtm, 1secmail
    domain: Optional[str] = None


class CreateEmailResponse(BaseModel):
    id: int
    address: str
    created_at: datetime
    expires_at: datetime
    provider: str
    service_name: str


class DeleteHistoryRequest(BaseModel):
    ids: Optional[List[int]] = None


# ============================================
# Mail.tm Provider Functions
# ============================================

async def get_mailtm_domains():
    """Get available domains from Mail.tm"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{MAILTM_BASE_URL}/domains")
            response.raise_for_status()
            data = response.json()
            domains = data.get("hydra:member", [])
            if domains:
                return [d["domain"] for d in domains]
            return []
        except Exception as e:
            logging.error(f"❌ Mail.tm domains error: {e}")
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
    """Get message detail from Mail.tm"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{MAILTM_BASE_URL}/messages/{message_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logging.error(f"Error getting Mail.tm message detail: {e}")
            return None


# ============================================
# 1secmail Provider Functions
# ============================================

async def get_1secmail_domains():
    """Get available domains from 1secmail"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{ONESECMAIL_BASE_URL}/?action=getDomainList")
            response.raise_for_status()
            domains = response.json()
            return domains if isinstance(domains, list) else []
        except Exception as e:
            logging.error(f"❌ 1secmail domains error: {e}")
            return []


async def create_1secmail_account(username: str, domain: str):
    """Create 1secmail account (no actual API call needed, just generate)"""
    # 1secmail doesn't require account creation - any email works!
    address = f"{username}@{domain}"
    # Use address as token since 1secmail doesn't use auth tokens
    return {
        "address": address,
        "password": "no-password",  # 1secmail doesn't use passwords
        "token": address,  # Use address as token
        "account_id": address
    }


async def get_1secmail_messages(username: str, domain: str):
    """Get messages from 1secmail"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{ONESECMAIL_BASE_URL}/?action=getMessages&login={username}&domain={domain}"
            )
            response.raise_for_status()
            messages = response.json()
            
            # Transform to Mail.tm format for consistency
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
                f"{ONESECMAIL_BASE_URL}/?action=readMessage&login={username}&domain={domain}&id={message_id}"
            )
            response.raise_for_status()
            msg = response.json()
            
            # Transform to Mail.tm format
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
# Multi-Provider Email Creation with Failover
# ============================================

async def create_email_with_failover(username: Optional[str] = None, preferred_service: str = "auto"):
    """
    Create email with automatic failover between providers
    Tries Mail.tm first, then falls back to 1secmail if rate limited
    """
    
    if not username:
        username = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
    
    password = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    
    # Try Mail.tm first (if not explicitly disabled)
    if preferred_service in ["auto", "mailtm"]:
        try:
            logging.info("🔄 Trying Mail.tm...")
            domains = await get_mailtm_domains()
            if domains:
                domain = domains[0]
                address = f"{username}@{domain}"
                
                account_data = await create_mailtm_account(address, password)
                token = await get_mailtm_token(address, password)
                
                _provider_stats["mailtm"]["success"] += 1
                logging.info("✅ Mail.tm email created successfully")
                
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
        except HTTPException as e:
            if e.status_code == 429:
                logging.warning("⚠️ Mail.tm rate limited, falling back to 1secmail...")
                _provider_stats["mailtm"]["failures"] += 1
                _provider_stats["mailtm"]["last_failure_time"] = datetime.now(timezone.utc).timestamp()
            else:
                raise
        except Exception as e:
            logging.error(f"❌ Mail.tm failed: {e}")
            _provider_stats["mailtm"]["failures"] += 1
    
    # Fallback to 1secmail
    try:
        logging.info("🔄 Trying 1secmail...")
        domains = await get_1secmail_domains()
        if not domains:
            raise HTTPException(status_code=500, detail="No email providers available")
        
        domain = domains[0]
        account_data = await create_1secmail_account(username, domain)
        
        _provider_stats["1secmail"]["success"] += 1
        logging.info("✅ 1secmail email created successfully")
        
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
    except Exception as e:
        logging.error(f"❌ 1secmail failed: {e}")
        _provider_stats["1secmail"]["failures"] += 1
        raise HTTPException(status_code=500, detail="All email providers failed")


# ============================================
# API Routes
# ============================================

@api_router.get("/")
async def root():
    return {
        "message": "TempMail API - MySQL with Multiple Providers",
        "providers": ["Mail.tm", "1secmail"],
        "stats": _provider_stats
    }


@api_router.post("/emails/create", response_model=CreateEmailResponse)
async def create_email(request: CreateEmailRequest, db: Session = Depends(get_db)):
    """Create a new temporary email with automatic provider failover"""
    try:
        # Create email using multi-provider with failover
        email_data = await create_email_with_failover(
            username=request.username,
            preferred_service=request.service or "auto"
        )
        
        # Calculate expiry time (10 minutes from now)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=10)
        
        # Create database record
        email = TempEmailModel(
            address=email_data["address"],
            password=email_data["password"],
            token=email_data["token"],
            account_id=email_data["account_id"],
            created_at=now,
            expires_at=expires_at,
            provider=email_data["provider"],
            username=email_data["username"],
            domain=email_data["domain"]
        )
        
        db.add(email)
        db.commit()
        db.refresh(email)
        
        logging.info(f"✅ Email created: {email.address} (Provider: {email.provider})")
        
        return CreateEmailResponse(
            id=email.id,
            address=email.address,
            created_at=email.created_at,
            expires_at=email.expires_at,
            provider=email.provider,
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
    emails = db.query(TempEmailModel).order_by(TempEmailModel.created_at.desc()).all()
    return emails


@api_router.get("/emails/{email_id}")
async def get_email(email_id: int, db: Session = Depends(get_db)):
    """Get email by ID"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return email.to_dict()


@api_router.get("/emails/{email_id}/messages")
async def get_email_messages(email_id: int, db: Session = Depends(get_db)):
    """Get messages for an email (works with any provider)"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Route to correct provider
    if email.provider == "mailtm":
        messages = await get_mailtm_messages(email.token)
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
    """Get message detail (works with any provider)"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Route to correct provider
    if email.provider == "mailtm":
        message = await get_mailtm_message_detail(email.token, message_id)
    elif email.provider == "1secmail":
        message = await get_1secmail_message_detail(email.username, email.domain, message_id)
    else:
        message = None
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return message


@api_router.post("/emails/{email_id}/refresh")
async def refresh_messages(email_id: int, db: Session = Depends(get_db)):
    """Refresh messages for an email"""
    email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Route to correct provider
    if email.provider == "mailtm":
        messages = await get_mailtm_messages(email.token)
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
    
    # Reset expires_at to 10 minutes from now
    now = datetime.now(timezone.utc)
    new_expires_at = now + timedelta(minutes=10)
    
    email.expires_at = new_expires_at
    db.commit()
    
    return {
        "status": "extended",
        "expires_at": new_expires_at.isoformat()
    }


@api_router.get("/emails/history/list", response_model=List[EmailHistorySchema])
async def get_email_history(db: Session = Depends(get_db)):
    """Get all emails in history"""
    history = db.query(EmailHistoryModel).order_by(EmailHistoryModel.expired_at.desc()).all()
    return history


@api_router.get("/emails/history/{email_id}/messages")
async def get_history_email_messages(email_id: int, db: Session = Depends(get_db)):
    """Get messages for a history email"""
    email = db.query(EmailHistoryModel).filter(EmailHistoryModel.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found in history")
    
    # Try to get messages (may not work if provider deleted the account)
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
            deleted_count = db.query(EmailHistoryModel).filter(EmailHistoryModel.id.in_(request.ids)).delete(synchronize_session=False)
        else:
            # Delete all history emails
            deleted_count = db.query(EmailHistoryModel).delete(synchronize_session=False)
        
        db.commit()
        
        return {
            "status": "deleted",
            "count": deleted_count
        }
    except Exception as e:
        logging.error(f"Error deleting history emails: {e}")
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/domains")
async def get_domains(service: str = "auto"):
    """Get available domains for a service"""
    domains = []
    
    if service in ["auto", "mailtm"]:
        mailtm_domains = await get_mailtm_domains()
        domains.extend(mailtm_domains)
    
    if service in ["auto", "1secmail"] and not domains:
        onesec_domains = await get_1secmail_domains()
        domains.extend(onesec_domains)
    
    return {"domains": domains, "service": service}


# Startup event to start background tasks
@app.on_event("startup")
async def startup_event():
    """Start background tasks on application startup"""
    from background_tasks import start_background_tasks
    start_background_tasks()
    logging.info("✅ Application started with background tasks (MySQL)")
    logging.info("✅ Multi-provider support: Mail.tm, 1secmail")


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
