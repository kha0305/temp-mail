"""MongoDB database configuration for container environment"""
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env file
ROOT_DIR = Path(__file__).parent
env_path = ROOT_DIR / '.env'
load_dotenv(env_path, override=True)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = "temp_mail_db"

# Lazy client initialization - create when needed
_client = None
_database = None
_emails_collection = None
_history_collection = None

def get_client():
    """Get or create MongoDB client"""
    global _client, _database, _emails_collection, _history_collection
    
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URL)
        _database = _client[DB_NAME]
        _emails_collection = _database.get_collection("temp_emails")
        _history_collection = _database.get_collection("email_history")
        print(f"✅ MongoDB connected: {MONGO_URL}")
        print(f"✅ Database: {DB_NAME}")
    
    return _client

# Use property-like accessors
@property
def database():
    get_client()
    return _database

@property  
def emails_collection():
    get_client()
    return _emails_collection

@property
def history_collection():
    get_client()
    return _history_collection

# Initialize on import
get_client()

# Export for compatibility
database = _database
emails_collection = _emails_collection
history_collection = _history_collection

async def get_database():
    """Get database instance"""
    get_client()
    return _database
