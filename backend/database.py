from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import os
from dotenv import load_dotenv
from pathlib import Path
import sys

# Load .env file
ROOT_DIR = Path(__file__).parent
env_path = ROOT_DIR / '.env'

# Try to load .env file with verbose output
if env_path.exists():
    load_dotenv(env_path, override=True)
    print(f"✅ Loaded .env file from: {env_path}")
else:
    print(f"⚠️  .env file not found at: {env_path}")
    print(f"📁 Current directory: {Path.cwd()}")
    print(f"📁 Script directory: {ROOT_DIR}")

# MySQL connection string
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = os.environ.get('DB_PORT', '3306')
DB_USER = os.environ.get('DB_USER', 'root')
DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
DB_NAME = os.environ.get('DB_NAME', 'garena_creator_db')

# Debug: Check if password is loaded
if not DB_PASSWORD:
    print("❌ WARNING: DB_PASSWORD is empty!")
    print("📋 Please check your .env file contains: DB_PASSWORD=190705")
    sys.exit(1)
else:
    print(f"✅ DB credentials loaded - User: {DB_USER}, Database: {DB_NAME}")

# URL encode password to handle special characters
from urllib.parse import quote_plus
encoded_password = quote_plus(DB_PASSWORD)

SQLALCHEMY_DATABASE_URL = f"mysql+pymysql://{DB_USER}:{encoded_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Create engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
