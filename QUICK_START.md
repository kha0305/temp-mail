# 🚀 QUICK START - TempMail Local

## ✅ Đã Hoàn Thành

### 1. Chuyển đổi Database MongoDB → MySQL ✅
- SQLAlchemy models
- MySQL configuration
- Auto-init database script

### 2. Frontend Port 7050 ✅
- `.env.local` với PORT=7050
- Startup script tự động cấu hình

### 3. Favicon & Icons ✅
- `favicon.ico` (multi-size)
- `logo192.png` (192x192)
- `logo512.png` (512x512)
- Tab title: "TempMail - Temporary Email Generator"
- Theme: Màu tím gradient với icon email + đồng hồ

---

## 📥 Cách Chạy Nhanh

### Bước 1: Cài đặt MySQL
```bash
# Ubuntu/Debian
sudo apt install mysql-server
sudo systemctl start mysql

# macOS
brew install mysql
brew services start mysql
```

### Bước 2: Tạo Database
```bash
sudo mysql

CREATE DATABASE tempmail_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tempmail_user'@'localhost' IDENTIFIED BY 'tempmail_password_123';
GRANT ALL PRIVILEGES ON tempmail_db.* TO 'tempmail_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Bước 3: Download Code và Chạy
```bash
cd /app
bash start_app.sh
```

Chọn:
- Lần đầu: `1` (Init Database) → `4` (Run All)
- Các lần sau: `4` (Run All)

### Bước 4: Truy Cập
- **Frontend**: http://localhost:7050 ✅
- **Backend**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs

---

## 📖 Tài Liệu Chi Tiết

📄 **HUONG_DAN_LOCAL.md** - Hướng dẫn đầy đủ bằng tiếng Việt:
- Yêu cầu hệ thống
- Cài đặt từng bước
- Troubleshooting
- API documentation
- Database schema

📄 **SETUP_GUIDE.md** - English documentation

📄 **README.md** - Project overview

---

## 🎨 Files Quan Trọng

### Frontend
- `frontend/.env` - Backend URL config
- `frontend/.env.local` - Port 7050 config
- `frontend/public/favicon.ico` - Tab icon
- `frontend/public/logo192.png` - Mobile icon
- `frontend/public/logo512.png` - High-res icon
- `frontend/public/manifest.json` - PWA config

### Backend
- `backend/.env` - MySQL credentials
- `backend/database.py` - SQLAlchemy setup
- `backend/models.py` - TempEmail model
- `backend/server.py` - FastAPI endpoints
- `backend/init_db.py` - Auto database init

### Scripts
- `start_app.sh` - Main launcher (menu)
- `start_backend.sh` - Backend only
- `start_frontend.sh` - Frontend only

---

## ⚡ Troubleshooting Nhanh

### MySQL không connect được?
```bash
sudo systemctl restart mysql
mysql -u tempmail_user -p  # Test connection
```

### Port 7050 bị chiếm?
```bash
lsof -ti:7050 | xargs kill -9
```

### Port 8001 bị chiếm?
```bash
lsof -ti:8001 | xargs kill -9
```

### Dependencies lỗi?
```bash
# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
rm -rf node_modules
yarn install
```

---

## 🎯 Tech Stack

- **Frontend**: React + Port 7050
- **Backend**: FastAPI + Python + Port 8001
- **Database**: MySQL 8.0+
- **Icons**: SVG → PNG/ICO với theme tím gradient

---

## 📞 Cần Giúp Đỡ?

Xem file **HUONG_DAN_LOCAL.md** để biết thêm chi tiết!

---

Made with ❤️ for Local Development
