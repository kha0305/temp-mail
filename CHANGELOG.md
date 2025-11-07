# 📋 CHANGELOG - Chuyển Đổi MongoDB sang MySQL

## 🎯 Mục Tiêu Hoàn Thành
✅ Chuyển đổi ứng dụng TempMail từ MongoDB sang MySQL  
✅ Thiết lập để chạy hoàn toàn trên local  
✅ Frontend chạy trên port 7050  

---

## 🔄 Các Thay Đổi Chính

### 1. Backend Database Layer

#### Files Mới:
- **`backend/database.py`** - SQLAlchemy configuration và connection pool cho MySQL
- **`backend/models.py`** - SQLAlchemy models (TempEmail table)
- **`backend/init_db.py`** - Script tự động khởi tạo database và tables

#### Files Đã Cập Nhật:
- **`backend/server.py`**:
  - ❌ Xóa: `motor.motor_asyncio.AsyncIOMotorClient`
  - ✅ Thêm: `sqlalchemy.orm.Session`, `database.py`, `models.py`
  - 🔄 Thay đổi: Tất cả MongoDB queries → SQLAlchemy queries
  
  Ví dụ thay đổi:
  ```python
  # Cũ (MongoDB):
  await db.temp_emails.insert_one(doc)
  
  # Mới (MySQL):
  db.add(email_doc)
  db.commit()
  ```

- **`backend/requirements.txt`**:
  - ❌ Xóa: `motor==3.3.1`
  - ✅ Thêm: `SQLAlchemy==2.0.23`, `pymysql==1.1.0`

- **`backend/.env`**:
  ```env
  # Cũ:
  MONGO_URL="mongodb://localhost:27017"
  DB_NAME="test_database"
  
  # Mới:
  DB_HOST=localhost
  DB_PORT=3306
  DB_USER=root
  DB_PASSWORD=190705
  DB_NAME=garena_creator_db
  ```

### 2. Frontend Configuration

#### Files Đã Cập Nhật:
- **`frontend/.env`**:
  ```env
  # Cũ:
  REACT_APP_BACKEND_URL=https://email-cycle-system.preview.emergentagent.com
  
  # Mới:
  REACT_APP_BACKEND_URL=http://localhost:8001
  ```

#### Files Mới:
- **`frontend/.env.local`**:
  ```env
  PORT=7050
  ```

### 3. Local Development Scripts

#### Files Mới:
- **`start_app.sh`** - Script chính với menu:
  - Option 1: Chạy Backend only (port 8001)
  - Option 2: Chạy Frontend only (port 7050)
  - Option 3: Chạy cả Backend và Frontend
  - Option 4: Khởi tạo Database

- **`start_backend.sh`**:
  - Tự động tạo virtual environment
  - Cài đặt Python dependencies
  - Khởi tạo database (nếu cần)
  - Chạy uvicorn server

- **`start_frontend.sh`**:
  - Cài đặt Yarn (nếu chưa có)
  - Cài đặt node modules
  - Chạy React app trên port 7050

### 4. Documentation

#### Files Mới:
- **`SETUP_GUIDE.md`** - Hướng dẫn chi tiết:
  - Cài đặt Python, Node.js, MySQL
  - Cấu hình MySQL
  - Các cách chạy ứng dụng
  - Troubleshooting
  - Backup/Restore

#### Files Đã Cập Nhật:
- **`README.md`** - Quick start guide với thông tin mới

---

## 📊 Database Schema

### Bảng: `temp_emails`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | ID tự tăng |
| address | VARCHAR(255) | UNIQUE, NOT NULL | Email address |
| password | VARCHAR(255) | NOT NULL | Password |
| token | TEXT | NOT NULL | Auth token |
| account_id | VARCHAR(255) | NOT NULL | Mail.tm account ID |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| message_count | INT | DEFAULT 0 | Number of messages |

**Indexes:**
- PRIMARY KEY: `id` (AUTO_INCREMENT)
- UNIQUE INDEX: `address`

---

## 🚀 Cách Sử Dụng

### Quick Start:
```bash
cd /app
bash start_app.sh
# Chọn Option 3
```

### URLs:
- Frontend: http://localhost:7050
- Backend: http://localhost:8001
- API Docs: http://localhost:8001/docs

---

## 🔍 Chi Tiết Chuyển Đổi API Endpoints

### 1. Create Email (POST /api/emails/create)
```python
# Cũ:
email_doc = TempEmail(address=address, ...)
doc = email_doc.model_dump()
await db.temp_emails.insert_one(doc)

# Mới:
email_doc = TempEmailModel(address=address, ...)
db.add(email_doc)
db.commit()
db.refresh(email_doc)
```

### 2. Get All Emails (GET /api/emails)
```python
# Cũ:
emails = await db.temp_emails.find({}, {"_id": 0}).to_list(1000)

# Mới:
emails = db.query(TempEmailModel).all()
```

### 3. Get Email by ID (GET /api/emails/{email_id})
```python
# Cũ:
email = await db.temp_emails.find_one({"id": email_id}, {"_id": 0})

# Mới:
email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
```

### 4. Update Message Count (POST /api/emails/{email_id}/refresh)
```python
# Cũ:
await db.temp_emails.update_one(
    {"id": email_id},
    {"$set": {"message_count": len(messages)}}
)

# Mới:
email.message_count = len(messages)
db.commit()
```

### 5. Delete Email (DELETE /api/emails/{email_id})
```python
# Cũ:
result = await db.temp_emails.delete_one({"id": email_id})

# Mới:
email = db.query(TempEmailModel).filter(TempEmailModel.id == email_id).first()
db.delete(email)
db.commit()
```

---

## ⚠️ Lưu Ý Quan Trọng

1. **Environment**: Ứng dụng hiện đang chạy trong container, không thể test với MySQL local. Cần download code về máy local để chạy.

2. **MySQL Requirements**:
   - MySQL 8.0+ phải được cài đặt và chạy
   - Database `garena_creator_db` sẽ được tự động tạo
   - User `root` phải có quyền CREATE DATABASE

3. **Port Configuration**:
   - Backend: 8001 (cố định)
   - Frontend: 7050 (theo yêu cầu)

4. **Dependencies**:
   - Python 3.11+
   - Node.js 16+
   - Yarn package manager

---

## 🧪 Testing

### Kiểm tra Backend:
```bash
curl http://localhost:8001/api/
# Expected: {"message": "TempMail API"}
```

### Kiểm tra Database:
```bash
mysql -u root -p190705
USE garena_creator_db;
SHOW TABLES;
DESCRIBE temp_emails;
```

### Kiểm tra Frontend:
Mở browser: http://localhost:7050

---

## 📦 Files Structure

```
/app/
├── backend/
│   ├── database.py          [NEW] MySQL connection
│   ├── models.py            [NEW] SQLAlchemy models
│   ├── init_db.py           [NEW] Database setup script
│   ├── server.py            [UPDATED] MongoDB → MySQL
│   ├── requirements.txt     [UPDATED] Dependencies
│   └── .env                 [UPDATED] MySQL config
├── frontend/
│   ├── .env                 [UPDATED] Backend URL
│   └── .env.local           [NEW] Port 7050
├── start_app.sh             [NEW] Main startup
├── start_backend.sh         [NEW] Backend startup
├── start_frontend.sh        [NEW] Frontend startup
├── SETUP_GUIDE.md          [NEW] Detailed guide
├── README.md               [UPDATED] Quick start
└── CHANGELOG.md            [NEW] This file
```

---

## ✅ Checklist Hoàn Thành

- [x] Chuyển đổi database layer từ MongoDB sang MySQL
- [x] Tạo SQLAlchemy models và configuration
- [x] Cập nhật tất cả API endpoints
- [x] Cập nhật dependencies
- [x] Cấu hình environment variables
- [x] Tạo database initialization script
- [x] Tạo startup scripts cho local
- [x] Cấu hình frontend port 7050
- [x] Viết documentation đầy đủ
- [x] Update README và guides

---

**Status**: ✅ HOÀN THÀNH  
**Date**: 2025-01-03  
**Version**: 1.0  

Ứng dụng đã sẵn sàng để chạy trên máy local với MySQL! 🎉
