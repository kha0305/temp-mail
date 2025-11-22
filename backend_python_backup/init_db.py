#!/usr/bin/env python3
"""
Script để khởi tạo database và tables cho ứng dụng TempMail
"""
import sys
from database import engine, Base, SQLALCHEMY_DATABASE_URL
from models import TempEmail
import pymysql
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

def create_database():
    """Tạo database nếu chưa tồn tại"""
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = int(os.environ.get('DB_PORT', '3306'))
    DB_USER = os.environ.get('DB_USER', 'root')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
    DB_NAME = os.environ.get('DB_NAME', 'temp_mail')
    
    print(f"\n🔌 Đang kết nối đến MySQL tại {DB_HOST}:{DB_PORT}...")
    
    try:
        # Kết nối đến MySQL server (không chỉ định database)
        connection = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD
        )
        
        print("✅ Kết nối MySQL thành công!")
        
        with connection.cursor() as cursor:
            # Tạo database nếu chưa tồn tại
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"✅ Database '{DB_NAME}' đã sẵn sàng!")
        
        connection.commit()
        connection.close()
        return True
        
    except pymysql.Error as e:
        print(f"❌ Lỗi kết nối MySQL: {e}")
        print("\n⚠️  Vui lòng kiểm tra:")
        print("   1. MySQL đã được cài đặt và đang chạy")
        print("   2. Thông tin đăng nhập trong file .env đúng")
        print("   3. User có quyền tạo database")
        return False

def drop_tables():
    """Xóa tất cả các tables (nếu muốn reset lại từ đầu)"""
    try:
        print("\n⚠️  CẢNH BÁO: Đang xóa tất cả tables...")
        Base.metadata.drop_all(bind=engine)
        print("✅ Đã xóa tất cả tables!")
        return True
    except Exception as e:
        print(f"❌ Lỗi xóa tables: {e}")
        return False

def create_tables():
    """Tạo các tables trong database"""
    try:
        print("\n📋 Đang tạo tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Tất cả tables đã được tạo thành công!")
        print("\n📊 Tables:")
        print("   - temp_emails (id INT AUTO_INCREMENT, address, password, token, ...)")
        print("   - email_history (id INT AUTO_INCREMENT, address, expired_at, ...)")
        return True
    except Exception as e:
        print(f"❌ Lỗi tạo tables: {e}")
        return False

def main():
    print("="*60)
    print("🚀 KHỞI TẠO DATABASE CHO ỨNG DỤNG TEMPMAIL")
    print("="*60)
    
    # Kiểm tra xem có tham số --reset không
    reset_mode = "--reset" in sys.argv or "--drop" in sys.argv
    
    # Bước 1: Tạo database
    if not create_database():
        print("\n❌ Không thể tạo database. Vui lòng sửa lỗi và thử lại.")
        sys.exit(1)
    
    # Bước 2: Drop tables nếu reset mode
    if reset_mode:
        print("\n⚠️  Chế độ RESET được kích hoạt!")
        confirm = input("⚠️  Xóa tất cả dữ liệu và tạo lại tables? (yes/no): ")
        if confirm.lower() in ['yes', 'y']:
            if not drop_tables():
                print("\n❌ Không thể xóa tables.")
                sys.exit(1)
        else:
            print("❌ Hủy bỏ reset.")
            sys.exit(0)
    
    # Bước 3: Tạo tables
    if not create_tables():
        print("\n❌ Không thể tạo tables. Vui lòng sửa lỗi và thử lại.")
        sys.exit(1)
    
    print("\n" + "="*60)
    print("✅ HOÀN THÀNH! Database đã sẵn sàng sử dụng.")
    print("="*60)
    if reset_mode:
        print("\n⚠️  Lưu ý: ID bây giờ là số (integer) thay vì UUID")
    print("\n💡 Bước tiếp theo: Chạy ứng dụng với lệnh:")
    print("   bash start_app.sh")
    print("\n💡 Để reset database lần sau, chạy:")
    print("   python init_db.py --reset")
    print()

if __name__ == "__main__":
    main()