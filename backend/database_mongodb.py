"""MongoDB connection for container environment"""
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DATABASE_NAME = "temp_mail"

# MongoDB client
client = AsyncIOMotorClient(MONGO_URL)
db = client[DATABASE_NAME]

# Collections
emails_collection = db["temp_emails"]
history_collection = db["email_history"]
saved_collection = db["saved_emails"]
