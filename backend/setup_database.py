#!/usr/bin/env python3
"""
All-in-one database setup script
- Creates database if not exists
- Creates tables if not exists
- Runs migrations if tables exist but missing columns
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

print("=" * 70)
print("🚀 TEMPMAIL DATABASE SETUP")
print("=" * 70)
print(f"Host: {DB_HOST}:{DB_PORT}")
print(f"Database: {DB_NAME}")
print(f"User: {DB_USER}")
print()

try:
    # Step 1: Connect to MySQL server (without database)
    print("🔌 Connecting to MySQL server...")
    connection = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD
    )
    cursor = connection.cursor()
    print("✅ Connected to MySQL")
    print()
    
    # Step 2: Create database if not exists
    print("📦 Creating database...")
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    connection.commit()
    print(f"✅ Database '{DB_NAME}' is ready")
    print()
    
    # Step 3: Use the database
    cursor.execute(f"USE {DB_NAME}")
    
    # Step 4: Check if temp_emails table exists
    print("🔍 Checking tables...")
    cursor.execute("""
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'temp_emails'
    """, (DB_NAME,))
    
    temp_emails_exists = cursor.fetchone()[0] > 0
    
    if not temp_emails_exists:
        # Create temp_emails table
        print("📋 Creating temp_emails table...")
        cursor.execute("""
            CREATE TABLE temp_emails (
                id VARCHAR(36) PRIMARY KEY,
                address VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                token TEXT NOT NULL,
                account_id VARCHAR(255) NOT NULL,
                created_at DATETIME NOT NULL,
                expires_at DATETIME NOT NULL,
                message_count INT DEFAULT 0,
                INDEX idx_address (address),
                INDEX idx_expires_at (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        connection.commit()
        print("✅ Created temp_emails table")
    else:
        print("✅ Table 'temp_emails' exists")
        
        # Check if expires_at column exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = %s 
            AND TABLE_NAME = 'temp_emails' 
            AND COLUMN_NAME = 'expires_at'
        """, (DB_NAME,))
        
        expires_at_exists = cursor.fetchone()[0] > 0
        
        if not expires_at_exists:
            print("⚠️  Column 'expires_at' missing - running migration...")
            
            # Add expires_at column
            cursor.execute("""
                ALTER TABLE temp_emails 
                ADD COLUMN expires_at DATETIME NOT NULL 
                AFTER created_at
            """)
            
            # Update existing records
            cursor.execute("""
                UPDATE temp_emails 
                SET expires_at = DATE_ADD(created_at, INTERVAL 10 MINUTE)
            """)
            
            # Add index
            cursor.execute("""
                CREATE INDEX idx_expires_at ON temp_emails(expires_at)
            """)
            
            connection.commit()
            print("✅ Added expires_at column and updated existing records")
    
    print()
    
    # Step 5: Check email_history table
    cursor.execute("""
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'email_history'
    """, (DB_NAME,))
    
    history_exists = cursor.fetchone()[0] > 0
    
    if not history_exists:
        print("📋 Creating email_history table...")
        cursor.execute("""
            CREATE TABLE email_history (
                id VARCHAR(36) PRIMARY KEY,
                address VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                token TEXT NOT NULL,
                account_id VARCHAR(255) NOT NULL,
                created_at DATETIME NOT NULL,
                expired_at DATETIME NOT NULL,
                message_count INT DEFAULT 0,
                INDEX idx_address (address),
                INDEX idx_expired_at (expired_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        connection.commit()
        print("✅ Created email_history table")
    else:
        print("✅ Table 'email_history' exists")
    
    print()
    
    # Step 6: Show final structure
    print("=" * 70)
    print("📊 FINAL DATABASE STRUCTURE")
    print("=" * 70)
    print()
    
    print("📋 temp_emails:")
    cursor.execute("DESCRIBE temp_emails")
    for row in cursor.fetchall():
        field_type = row[1].decode() if isinstance(row[1], bytes) else row[1]
        print(f"   • {row[0]}: {field_type}")
    
    print()
    print("📋 email_history:")
    cursor.execute("DESCRIBE email_history")
    for row in cursor.fetchall():
        field_type = row[1].decode() if isinstance(row[1], bytes) else row[1]
        print(f"   • {row[0]}: {field_type}")
    
    print()
    print("=" * 70)
    print("✅ DATABASE SETUP COMPLETED SUCCESSFULLY!")
    print("=" * 70)
    print()
    print("🚀 Next steps:")
    print("   1. Start backend: python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload")
    print("   2. Start frontend: cd ../frontend && PORT=7050 yarn start")
    print("   3. Open browser: http://localhost:7050")
    print()
    
    cursor.close()
    connection.close()
    
except pymysql.Error as e:
    print(f"❌ MySQL Error: {e}")
    print()
    print("🔧 Troubleshooting:")
    print("   1. Check MySQL is running:")
    print("      • Windows: services.msc → MySQL → Start")
    print("      • Mac: mysql.server start")
    print("      • Linux: sudo systemctl start mysql")
    print()
    print("   2. Test connection:")
    print(f"      mysql -u {DB_USER} -p")
    print()
    print("   3. Check credentials in backend/.env:")
    print(f"      DB_USER={DB_USER}")
    print(f"      DB_PASSWORD={DB_PASSWORD}")
    print()
    exit(1)
    
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    exit(1)
