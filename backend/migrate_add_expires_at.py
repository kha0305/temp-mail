#!/usr/bin/env python3
"""
Migration script: Thêm column 'expires_at' vào bảng temp_emails
"""
import pymysql
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

def migrate():
    """Thêm column expires_at vào table temp_emails"""
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = int(os.environ.get('DB_PORT', '3306'))
    DB_USER = os.environ.get('DB_USER', 'root')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
    DB_NAME = os.environ.get('DB_NAME', 'temp_mail')
    
    print(f"\n🔌 Đang kết nối đến MySQL tại {DB_HOST}:{DB_PORT}...")
    
    try:
        connection = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        
        print("✅ Kết nối MySQL thành công!")
        
        with connection.cursor() as cursor:
            # Kiểm tra xem column expires_at đã tồn tại chưa
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = %s 
                AND TABLE_NAME = 'temp_emails' 
                AND COLUMN_NAME = 'expires_at'
            """, (DB_NAME,))
            
            exists = cursor.fetchone()[0]
            
            if exists:
                print("ℹ️  Column 'expires_at' đã tồn tại trong table 'temp_emails'")
            else:
                print("📋 Đang thêm column 'expires_at' vào table 'temp_emails'...")
                
                # Thêm column expires_at
                cursor.execute("""
                    ALTER TABLE temp_emails 
                    ADD COLUMN expires_at DATETIME NOT NULL 
                    DEFAULT (NOW() + INTERVAL 10 MINUTE)
                    AFTER created_at
                """)
                
                # Update expires_at cho các record hiện có (nếu có)
                cursor.execute("""
                    UPDATE temp_emails 
                    SET expires_at = DATE_ADD(created_at, INTERVAL 10 MINUTE)
                    WHERE expires_at IS NULL OR expires_at = '0000-00-00 00:00:00'
                """)
                
                print("✅ Đã thêm column 'expires_at' thành công!")
                print("✅ Đã cập nhật expires_at cho các email hiện có")
        
        connection.commit()
        connection.close()
        
        print("\n" + "="*60)
        print("✅ MIGRATION HOÀN THÀNH!")
        print("="*60)
        print("\n💡 Bây giờ bạn có thể chạy lại backend server:")
        print("   python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001")
        print()
        
    except pymysql.Error as e:
        print(f"❌ Lỗi migration: {e}")
        print("\n⚠️  Vui lòng kiểm tra:")
        print("   1. MySQL đang chạy")
        print("   2. Database 'temp_mail' đã tồn tại")
        print("   3. Thông tin đăng nhập trong file .env đúng")
        return False
    
    return True

if __name__ == "__main__":
    print("="*60)
    print("🔄 MIGRATION: Thêm column 'expires_at'")
    print("="*60)
    migrate()
