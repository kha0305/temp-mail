"""
Migration script to add expires_at column to existing database
Run this if you get error: Unknown column 'temp_emails.expires_at'
"""
import pymysql
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Load .env file
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = int(os.environ.get('DB_PORT', '3306'))
DB_USER = os.environ.get('DB_USER', 'root')
DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
DB_NAME = os.environ.get('DB_NAME', 'temp_mail')

print("=" * 60)
print("DATABASE MIGRATION SCRIPT")
print("=" * 60)
print(f"Host: {DB_HOST}:{DB_PORT}")
print(f"Database: {DB_NAME}")
print(f"User: {DB_USER}")
print()

try:
    # Connect to MySQL
    connection = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )
    
    cursor = connection.cursor()
    
    print("✅ Connected to MySQL database")
    print()
    
    # Check if expires_at column exists in temp_emails
    print("🔍 Checking temp_emails table...")
    cursor.execute("""
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = %s 
        AND TABLE_NAME = 'temp_emails' 
        AND COLUMN_NAME = 'expires_at'
    """, (DB_NAME,))
    
    expires_at_exists = cursor.fetchone()
    
    if not expires_at_exists:
        print("⚠️  Column 'expires_at' not found in temp_emails")
        print("➕ Adding expires_at column...")
        
        # Add expires_at column with default value (10 minutes from now)
        cursor.execute("""
            ALTER TABLE temp_emails 
            ADD COLUMN expires_at DATETIME NOT NULL 
            DEFAULT (NOW() + INTERVAL 10 MINUTE)
            AFTER created_at
        """)
        
        # Update existing records to have expires_at = created_at + 10 minutes
        cursor.execute("""
            UPDATE temp_emails 
            SET expires_at = DATE_ADD(created_at, INTERVAL 10 MINUTE)
            WHERE expires_at IS NULL OR expires_at = created_at
        """)
        
        connection.commit()
        print("✅ Added expires_at column to temp_emails")
    else:
        print("✅ Column 'expires_at' already exists in temp_emails")
    
    print()
    
    # Check if email_history table exists
    print("🔍 Checking email_history table...")
    cursor.execute("""
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = %s 
        AND TABLE_NAME = 'email_history'
    """, (DB_NAME,))
    
    history_exists = cursor.fetchone()[0]
    
    if not history_exists:
        print("⚠️  Table 'email_history' not found")
        print("➕ Creating email_history table...")
        
        cursor.execute("""
            CREATE TABLE email_history (
                id VARCHAR(36) PRIMARY KEY,
                address VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                token TEXT NOT NULL,
                account_id VARCHAR(255) NOT NULL,
                created_at DATETIME NOT NULL,
                expired_at DATETIME NOT NULL,
                message_count INT DEFAULT 0
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        
        # Add index on address for faster queries
        cursor.execute("""
            CREATE INDEX idx_address ON email_history(address)
        """)
        
        connection.commit()
        print("✅ Created email_history table")
    else:
        print("✅ Table 'email_history' already exists")
    
    print()
    
    # Show table structure
    print("📋 Current table structure:")
    print()
    print("temp_emails:")
    cursor.execute("DESCRIBE temp_emails")
    for row in cursor.fetchall():
        print(f"  - {row[0]}: {row[1]}")
    
    print()
    print("email_history:")
    cursor.execute("DESCRIBE email_history")
    for row in cursor.fetchall():
        print(f"  - {row[0]}: {row[1]}")
    
    print()
    print("=" * 60)
    print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Restart backend: python -m uvicorn server:app --reload")
    print("2. Background tasks will now work correctly")
    print()
    
    cursor.close()
    connection.close()
    
except pymysql.Error as e:
    print(f"❌ MySQL Error: {e}")
    print()
    print("Common issues:")
    print("1. MySQL not running - Start MySQL service")
    print("2. Wrong credentials - Check .env file")
    print("3. Database doesn't exist - Run init_db.py first")
    exit(1)
    
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
