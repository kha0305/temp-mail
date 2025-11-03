#!/usr/bin/env python3
"""
Script kiểm tra cấu hình database và kết nối MySQL
"""
import os
from pathlib import Path
from dotenv import load_dotenv
import sys

# Load .env file
ROOT_DIR = Path(__file__).parent
env_path = ROOT_DIR / '.env'

print("=" * 60)
print("🔍 KIỂM TRA CẤU HÌNH DATABASE")
print("=" * 60)
print()

# Check if .env file exists
print(f"📁 Đường dẫn script: {ROOT_DIR}")
print(f"📄 Đường dẫn .env: {env_path}")
print(f"✓ File .env tồn tại: {'✅ CÓ' if env_path.exists() else '❌ KHÔNG'}")
print()

if not env_path.exists():
    print("❌ File .env không tồn tại!")
    print(f"💡 Vui lòng tạo file .env tại: {env_path}")
    print()
    print("Nội dung file .env cần có:")
    print("-" * 40)
    print("DB_HOST=localhost")
    print("DB_PORT=3306")
    print("DB_USER=root")
    print("DB_PASSWORD=190705")
    print("DB_NAME=garena_creator_db")
    print("CORS_ORIGINS=*")
    print("-" * 40)
    sys.exit(1)

# Load environment variables
load_dotenv(env_path, override=True)

# Check each variable
print("📋 BIẾN MÔI TRƯỜNG:")
print("-" * 60)

variables = {
    'DB_HOST': os.environ.get('DB_HOST'),
    'DB_PORT': os.environ.get('DB_PORT'),
    'DB_USER': os.environ.get('DB_USER'),
    'DB_PASSWORD': os.environ.get('DB_PASSWORD'),
    'DB_NAME': os.environ.get('DB_NAME'),
}

all_ok = True
for key, value in variables.items():
    if value:
        # Mask password for security
        display_value = '*' * len(value) if 'PASSWORD' in key else value
        print(f"✅ {key:15} = {display_value}")
    else:
        print(f"❌ {key:15} = (trống hoặc không tồn tại)")
        all_ok = False

print()

if not all_ok:
    print("❌ Một số biến môi trường bị thiếu!")
    print("💡 Vui lòng kiểm tra lại file .env")
    sys.exit(1)

# Test MySQL connection
print("=" * 60)
print("🔌 KIỂM TRA KẾT NỐI MYSQL")
print("=" * 60)
print()

try:
    import pymysql
    
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = int(os.environ.get('DB_PORT', '3306'))
    DB_USER = os.environ.get('DB_USER', 'root')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
    DB_NAME = os.environ.get('DB_NAME', 'temp_mail')
    
    print(f"🔗 Đang kết nối đến MySQL...")
    print(f"   Host: {DB_HOST}:{DB_PORT}")
    print(f"   User: {DB_USER}")
    print()
    
    # Test connection without database
    connection = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD
    )
    
    print("✅ Kết nối MySQL thành công!")
    
    # Check if database exists
    with connection.cursor() as cursor:
        cursor.execute("SHOW DATABASES LIKE %s", (DB_NAME,))
        result = cursor.fetchone()
        
        if result:
            print(f"✅ Database '{DB_NAME}' đã tồn tại")
        else:
            print(f"⚠️  Database '{DB_NAME}' chưa tồn tại")
            print(f"💡 Sẽ được tạo tự động khi chạy init_db.py")
    
    connection.close()
    
    print()
    print("=" * 60)
    print("✅ TẤT CẢ KIỂM TRA THÀNH CÔNG!")
    print("=" * 60)
    print()
    print("🚀 Bạn có thể chạy server bằng lệnh:")
    print("   python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001")
    print()

except ImportError:
    print("❌ Thư viện pymysql chưa được cài đặt")
    print("💡 Chạy: pip install pymysql")
    sys.exit(1)

except pymysql.err.OperationalError as e:
    print(f"❌ Lỗi kết nối MySQL: {e}")
    print()
    print("💡 Vui lòng kiểm tra:")
    print("   1. MySQL đã được cài đặt và đang chạy")
    print("   2. Username và password trong .env đúng")
    print("   3. MySQL đang lắng nghe trên localhost:3306")
    print()
    print("🔧 Cách kiểm tra MySQL:")
    print("   mysql -u root -p190705")
    sys.exit(1)

except Exception as e:
    print(f"❌ Lỗi không xác định: {e}")
    sys.exit(1)
