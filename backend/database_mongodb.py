"""MongoDB database configuration - Fallback for container environments"""
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/temp_mail')

# Create MongoDB client
client = AsyncIOMotorClient(MONGO_URL)
db = client.get_database()

async def get_mongodb():
    """Get MongoDB database instance"""
    return db
