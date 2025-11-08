"""FastAPI server with MongoDB and expiry features"""
from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import httpx
import random
import string

from database_mongodb import client
from models_mongodb import TempEmail, EmailHistory

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Get database and collections
db = client.get_database()
temp_emails_collection = db.temp_emails
history_collection = db.email_history

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Email Provider Configuration
MAILTM_BASE_URL = "https://api.mail.tm"
MAILGW_BASE_URL = "https://api.mail.gw"
ONESECMAIL_BASE_URL = "https://www.1secmail.com/api/v1"
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
    model_config = ConfigDict(extra="ignore")
    
    id: str
    address: str
    password: str
    token: str
    account_id: str
    created_at: datetime
    expires_at: datetime
    message_count: int = 0


class EmailHistorySchema(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
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
    service: Optional[str] = "mailtm"  # Default to mailtm
    domain: Optional[str] = None  # If None, will use first available domain


class CreateEmailResponse(BaseModel):
    id: str
    address: str
    created_at: datetime
    expires_at: datetime
    provider: str
    service_name: str


class DeleteHistoryRequest(BaseModel):
    ids: Optional[List[int]] = None


class CreateEmailResponse(BaseModel):
    id: str
    address: str
    created_at: datetime
    expires_at: datetime


class DeleteHistoryRequest(BaseModel):
    ids: Optional[List[str]] = None


# Mail.tm Service Functions
async def get_available_domains():
    """Get available domains from Mail.tm"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(f"{MAILTM_BASE_URL}/domains")
            response.raise_for_status()
            data = response.json()
            domains = data.get("hydra:member", [])
            if domains:
                return domains[0]["domain"]
            return None
        except Exception as e:
            logging.error(f"Error getting domains: {e}")
            return None


async def create_mailtm_account(address: str, password: str):
    """Create account on Mail.tm"""
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.post(
                f"{MAILTM_BASE_URL}/accounts",
                json={"address": address, "password": password}
            )
            response.raise_for_status()
            return response.json()
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
    return {"message": "TempMail API - MongoDB with Expiry"}


@api_router.post("/emails/create", response_model=CreateEmailResponse)
async def create_email(request: CreateEmailRequest):
    """Create a new temporary email"""
    try:
        # Get available domain
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
        
        # Create account on Mail.tm
        account_data = await create_mailtm_account(address, password)
        
        # Get authentication token
        token = await get_mailtm_token(address, password)
        
        # Calculate expiry time (10 minutes from now)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=10)
        
        # Create document
        email_doc = TempEmail.create_document(
            address=address,
            password=password,
            token=token,
            account_id=account_data["id"],
            expires_at=expires_at
        )
        
        # Save to database
        await temp_emails_collection.insert_one(email_doc)
        
        return CreateEmailResponse(
            id=email_doc["_id"],
            address=email_doc["address"],
            created_at=email_doc["created_at"],
            expires_at=email_doc["expires_at"]
        )
    except Exception as e:
        logging.error(f"Error creating email: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/emails", response_model=List[TempEmailSchema])
async def get_emails():
    """Get all temporary emails"""
    emails = await temp_emails_collection.find().sort("created_at", -1).to_list(None)
    return [TempEmail.to_dict(email) for email in emails]


@api_router.get("/emails/{email_id}")
async def get_email(email_id: str):
    """Get email by ID"""
    email = await temp_emails_collection.find_one({"_id": email_id})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return TempEmail.to_dict(email)


@api_router.get("/emails/{email_id}/messages")
async def get_email_messages(email_id: str):
    """Get messages for an email"""
    email = await temp_emails_collection.find_one({"_id": email_id})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Get messages from Mail.tm
    messages = await get_mailtm_messages(email["token"])
    
    # Update message count
    await temp_emails_collection.update_one(
        {"_id": email_id},
        {"$set": {"message_count": len(messages)}}
    )
    
    return {"messages": messages, "count": len(messages)}


@api_router.get("/emails/{email_id}/messages/{message_id}")
async def get_message_detail(email_id: str, message_id: str):
    """Get message detail"""
    email = await temp_emails_collection.find_one({"_id": email_id})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    message = await get_mailtm_message_detail(email["token"], message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return message


@api_router.post("/emails/{email_id}/refresh")
async def refresh_messages(email_id: str):
    """Refresh messages for an email"""
    email = await temp_emails_collection.find_one({"_id": email_id})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    messages = await get_mailtm_messages(email["token"])
    
    await temp_emails_collection.update_one(
        {"_id": email_id},
        {"$set": {"message_count": len(messages)}}
    )
    
    return {"messages": messages, "count": len(messages)}


@api_router.delete("/emails/{email_id}")
async def delete_email(email_id: str):
    """Delete a temporary email"""
    result = await temp_emails_collection.delete_one({"_id": email_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return {"status": "deleted"}


@api_router.post("/emails/{email_id}/extend-time")
async def extend_email_time(email_id: str):
    """Extend email expiry time by resetting to 10 minutes from now"""
    email = await temp_emails_collection.find_one({"_id": email_id})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Reset expires_at to 10 minutes from now (not add to existing time)
    now = datetime.now(timezone.utc)
    new_expires_at = now + timedelta(minutes=10)
    
    await temp_emails_collection.update_one(
        {"_id": email_id},
        {"$set": {"expires_at": new_expires_at}}
    )
    
    return {
        "status": "extended",
        "expires_at": new_expires_at.isoformat()
    }


@api_router.get("/emails/history/list", response_model=List[EmailHistorySchema])
async def get_email_history():
    """Get all emails in history"""
    history = await history_collection.find().sort("expired_at", -1).to_list(None)
    return [EmailHistory.to_dict(email) for email in history]


@api_router.get("/emails/history/{email_id}/messages")
async def get_history_email_messages(email_id: str):
    """Get messages for a history email"""
    email = await history_collection.find_one({"_id": email_id})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found in history")
    
    # Get messages from Mail.tm using the stored token
    messages = await get_mailtm_messages(email["token"])
    
    return {"messages": messages, "count": len(messages)}


@api_router.get("/emails/history/{email_id}/messages/{message_id}")
async def get_history_message_detail(email_id: str, message_id: str):
    """Get message detail for a history email"""
    email = await history_collection.find_one({"_id": email_id})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found in history")
    
    message = await get_mailtm_message_detail(email["token"], message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return message


@api_router.delete("/emails/history/delete")
async def delete_history_emails(request: DeleteHistoryRequest):
    """Delete history emails. If ids is None or empty, delete all"""
    try:
        if request.ids and len(request.ids) > 0:
            # Delete specific emails by IDs
            result = await history_collection.delete_many({"_id": {"$in": request.ids}})
            deleted_count = result.deleted_count
        else:
            # Delete all history emails
            result = await history_collection.delete_many({})
            deleted_count = result.deleted_count
        
        return {
            "status": "deleted",
            "count": deleted_count
        }
    except Exception as e:
        logging.error(f"Error deleting history emails: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# Startup event to start background tasks
@app.on_event("startup")
async def startup_event():
    """Start background tasks on application startup"""
    from background_tasks_mongodb import start_background_tasks
    start_background_tasks()
    logging.info("Application started with background tasks (MongoDB)")


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
