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
import secrets
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

# Mail service configurations
MAIL_SERVICES = {
    "mail.tm": "https://api.mail.tm",
    "mail.gw": "https://api.mail.gw"
}

# Define Models
class DomainResponse(BaseModel):
    id: str
    domain: str
    service: str

class CreateEmailRequest(BaseModel):
    service: str
    domain: str

class CreateEmailResponse(BaseModel):
    id: str
    email: str
    password: str
    service: str
    token: Optional[str] = None

class Message(BaseModel):
    id: str
    from_email: str = Field(alias="from")
    subject: str
    intro: Optional[str] = None
    text: Optional[str] = None
    html: Optional[List[str]] = None
    created_at: str = Field(alias="createdAt")
    
    model_config = ConfigDict(populate_by_name=True)

class GetMessagesRequest(BaseModel):
    email: str
    token: str
    service: str

# Helper functions
def generate_random_string(length=10):
    """Generate random string for email username"""
    letters = string.ascii_lowercase + string.digits
    return ''.join(secrets.choice(letters) for i in range(length))

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Temporary Email Service"}

@api_router.get("/domains")
async def get_domains():
    """Get available domains from both mail.tm and mail.gw"""
    all_domains = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for service_name, base_url in MAIL_SERVICES.items():
            try:
                response = await client.get(f"{base_url}/domains")
                if response.status_code == 200:
                    data = response.json()
                    domains = data.get("hydra:member", []) if "hydra:member" in data else data
                    for domain_obj in domains:
                        all_domains.append({
                            "id": domain_obj.get("id", domain_obj.get("domain")),
                            "domain": domain_obj.get("domain"),
                            "service": service_name
                        })
            except Exception as e:
                logger.error(f"Error fetching domains from {service_name}: {e}")
    
    return {"domains": all_domains}

@api_router.post("/create-email")
async def create_email(request: CreateEmailRequest):
    """Create a new temporary email account"""
    base_url = MAIL_SERVICES.get(request.service)
    if not base_url:
        raise HTTPException(status_code=400, detail="Invalid service")
    
    # Generate random username
    username = generate_random_string(10)
    email = f"{username}@{request.domain}"
    password = generate_random_string(16)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Create account
            account_data = {
                "address": email,
                "password": password
            }
            create_response = await client.post(
                f"{base_url}/accounts",
                json=account_data
            )
            
            if create_response.status_code not in [200, 201]:
                raise HTTPException(
                    status_code=create_response.status_code,
                    detail=f"Failed to create account: {create_response.text}"
                )
            
            account = create_response.json()
            account_id = account.get("id")
            
            # Login to get token
            login_data = {
                "address": email,
                "password": password
            }
            token_response = await client.post(
                f"{base_url}/token",
                json=login_data
            )
            
            if token_response.status_code == 200:
                token_data = token_response.json()
                token = token_data.get("token")
            else:
                token = None
            
            # Save to database
            email_doc = {
                "id": str(uuid.uuid4()),
                "account_id": account_id,
                "email": email,
                "password": password,
                "service": request.service,
                "token": token,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.emails.insert_one(email_doc)
            
            return {
                "id": email_doc["id"],
                "email": email,
                "password": password,
                "service": request.service,
                "token": token
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating email: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/messages")
async def get_messages(request: GetMessagesRequest):
    """Get messages for a specific email"""
    base_url = MAIL_SERVICES.get(request.service)
    if not base_url:
        raise HTTPException(status_code=400, detail="Invalid service")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            headers = {
                "Authorization": f"Bearer {request.token}"
            }
            response = await client.get(
                f"{base_url}/messages",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                messages = data.get("hydra:member", []) if "hydra:member" in data else data
                return {"messages": messages}
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to fetch messages"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching messages: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/messages/{message_id}")
async def get_message_detail(message_id: str, service: str, token: str):
    """Get detailed message content"""
    base_url = MAIL_SERVICES.get(service)
    if not base_url:
        raise HTTPException(status_code=400, detail="Invalid service")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            headers = {
                "Authorization": f"Bearer {token}"
            }
            response = await client.get(
                f"{base_url}/messages/{message_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to fetch message"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching message detail: {e}")
            raise HTTPException(status_code=500, detail=str(e))

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