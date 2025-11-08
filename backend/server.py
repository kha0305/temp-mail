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

# Mail.tm Configuration
MAILTM_BASE_URL = "https://api.mail.tm"

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


# API Routes
@api_router.get("/")
async def root():
    return {"message": "TempMail API - MySQL with Expiry"}


@api_router.post("/emails/create", response_model=CreateEmailResponse)
async def create_email(request: CreateEmailRequest, db: Session = Depends(get_db)):
    """Create a new temporary email with rate limiting"""
    try:
        # Check local rate limit (max 3 emails per minute)
        current_time = time.time()
        
        if current_time - _rate_limit_tracker["reset_time"] > 60:
            # Reset counter after 1 minute
            _rate_limit_tracker["create_count"] = 0
            _rate_limit_tracker["reset_time"] = current_time
        
        if _rate_limit_tracker["create_count"] >= 3:
            wait_seconds = int(60 - (current_time - _rate_limit_tracker["reset_time"]))
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit: Maximum 3 emails per minute. Please wait {wait_seconds} seconds."
            )
        
        # Increment counter
        _rate_limit_tracker["create_count"] += 1
        _rate_limit_tracker["last_create_time"] = current_time
        
        # Get available domain (with caching)
        domain = await get_available_domains()
        if not domain:
            raise HTTPException(status_code=500, detail="No domains available")
        
        # Generate random username if not provided
        if request.username:
            username = request.username
        else:
            username = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
        
        address = f"{username}@{domain}"
        password = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
        
        # Create account on Mail.tm (with retry logic)
        account_data = await create_mailtm_account(address, password)
        
        # Get authentication token
        token = await get_mailtm_token(address, password)
        
        # Calculate expiry time (10 minutes from now)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=10)
        
        # Save to database
        email = TempEmailModel(
            address=address,
            password=password,
            token=token,
            account_id=account_data["id"],
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
