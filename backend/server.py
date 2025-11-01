from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx
import random
import string

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Mail.tm Configuration
MAILTM_BASE_URL = "https://api.mail.tm"

# Models
class TempEmail(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    address: str
    password: str
    token: str
    account_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    message_count: int = 0

class EmailMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str
    email_id: str
    from_name: str
    from_address: str
    subject: str
    text: Optional[str] = None
    html: Optional[str] = None
    received_at: datetime
    seen: bool = False

class CreateEmailRequest(BaseModel):
    username: Optional[str] = None

class CreateEmailResponse(BaseModel):
    id: str
    address: str
    created_at: datetime

# Mail.tm Service Functions
async def get_available_domains():
    """Get available domains from Mail.tm"""
    async with httpx.AsyncClient(timeout=30.0) as http_client:
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
    async with httpx.AsyncClient(timeout=30.0) as http_client:
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
    async with httpx.AsyncClient(timeout=30.0) as http_client:
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
    async with httpx.AsyncClient(timeout=30.0) as http_client:
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
    async with httpx.AsyncClient(timeout=30.0) as http_client:
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
    return {"message": "TempMail API"}

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
        
        # Save to database
        email_doc = TempEmail(
            address=address,
            password=password,
            token=token,
            account_id=account_data["id"]
        )
        
        doc = email_doc.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.temp_emails.insert_one(doc)
        
        return CreateEmailResponse(
            id=email_doc.id,
            address=email_doc.address,
            created_at=email_doc.created_at
        )
    except Exception as e:
        logging.error(f"Error creating email: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/emails", response_model=List[TempEmail])
async def get_emails():
    """Get all temporary emails"""
    emails = await db.temp_emails.find({}, {"_id": 0}).to_list(1000)
    
    for email in emails:
        if isinstance(email['created_at'], str):
            email['created_at'] = datetime.fromisoformat(email['created_at'])
    
    return emails

@api_router.get("/emails/{email_id}")
async def get_email(email_id: str):
    """Get email by ID"""
    email = await db.temp_emails.find_one({"id": email_id}, {"_id": 0})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    if isinstance(email['created_at'], str):
        email['created_at'] = datetime.fromisoformat(email['created_at'])
    
    return email

@api_router.get("/emails/{email_id}/messages")
async def get_email_messages(email_id: str):
    """Get messages for an email"""
    email = await db.temp_emails.find_one({"id": email_id}, {"_id": 0})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Get messages from Mail.tm
    messages = await get_mailtm_messages(email["token"])
    
    # Update message count
    await db.temp_emails.update_one(
        {"id": email_id},
        {"$set": {"message_count": len(messages)}}
    )
    
    return {"messages": messages, "count": len(messages)}

@api_router.get("/emails/{email_id}/messages/{message_id}")
async def get_message_detail(email_id: str, message_id: str):
    """Get message detail"""
    email = await db.temp_emails.find_one({"id": email_id}, {"_id": 0})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    message = await get_mailtm_message_detail(email["token"], message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return message

@api_router.post("/emails/{email_id}/refresh")
async def refresh_messages(email_id: str):
    """Refresh messages for an email"""
    email = await db.temp_emails.find_one({"id": email_id}, {"_id": 0})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    messages = await get_mailtm_messages(email["token"])
    
    await db.temp_emails.update_one(
        {"id": email_id},
        {"$set": {"message_count": len(messages)}}
    )
    
    return {"messages": messages, "count": len(messages)}

@api_router.delete("/emails/{email_id}")
async def delete_email(email_id: str):
    """Delete a temporary email"""
    result = await db.temp_emails.delete_one({"id": email_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return {"status": "deleted"}

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()