# 🎯 TempMail - CHẠY HOÀN TOÀN TRÊN LOCAL

## ✅ CẤU HÌNH ĐẦY ĐỦ CHO LOCAL

### 🖥️ FRONTEND - Port 7050

**File: `/frontend/.env`**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
REACT_APP_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
```

**File: `/frontend/.env.local`**
```env
PORT=7050
```

✅ Frontend sẽ chạy tại: **http://localhost:7050**
✅ Frontend sẽ gọi API tại: **http://localhost:8001**

---

### 🔧 BACKEND - Port 8001

**File: `/backend/.env`**
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705
DB_NAME=temp_mail
CORS_ORIGINS=*
```

✅ Backend sẽ chạy tại: **http://localhost:8001**
✅ Backend sẽ kết nối MySQL tại: **localhost:3306**
✅ Database name: **temp_mail**

⚠️ **LƯU Ý**: Bạn cần tạo database `temp_mail` trong MySQL!

---

## 🚀 CÁCH CHẠY NHANH

### Bước 1: Cài đặt MySQL và Tạo Database

```bash
# Ubuntu/Debian
sudo apt install mysql-server
sudo systemctl start mysql

# macOS
brew install mysql
brew services start mysql

# Tạo database
sudo mysql
```

Trong MySQL shell:
```sql
CREATE DATABASE temp_mail CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Nếu user của bạn là root với password 190705, không cần tạo user mới
# Nếu chưa set password cho root:
ALTER USER 'root'@'localhost' IDENTIFIED BY '190705';
FLUSH PRIVILEGES;
EXIT;
```

---

### Bước 2: Kiểm Tra Kết Nối MySQL

```bash
mysql -u root -p
# Nhập password: 190705

USE temp_mail;
SHOW TABLES;
EXIT;
```

---

### Bước 3: Chạy Ứng Dụng

```bash
cd /path/to/temp-mail

# Sử dụng script tự động
bash start_app.sh
```

**Menu hiện ra, chọn:**
1. Lần đầu tiên:
   - Chọn `1` - Khởi tạo Database (tạo tables)
   - Chọn `4` - Chạy Backend + Frontend

2. Các lần sau:
   - Chọn `4` - Chạy toàn bộ

---

### Hoặc Chạy Thủ Công:

**Terminal 1 - Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# hoặc: venv\Scripts\activate  # Windows

pip install -r requirements.txt
python3 init_db.py  # Khởi tạo database
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
yarn install
PORT=7050 yarn start
```

---

## 🌐 TRUY CẬP ỨNG DỤNG

Sau khi khởi động thành công:

- **Frontend**: http://localhost:7050 ✅
- **Backend API**: http://localhost:8001 ✅
- **API Documentation**: http://localhost:8001/docs ✅

---

## 🎨 FAVICON & ICONS

Ứng dụng đã có đầy đủ icons:

✅ `frontend/public/favicon.ico` - Hiển thị trên tab browser
✅ `frontend/public/logo192.png` - Mobile/PWA icon
✅ `frontend/public/logo512.png` - High-res icon
✅ `frontend/public/mail-icon.svg` - Source vector
✅ `frontend/public/manifest.json` - PWA config

**Tab title**: "TempMail - Temporary Email Generator"

---

## 📁 CẤU TRÚC DỰ ÁN

```
temp-mail/
├── backend/
│   ├── .env                    # MySQL config (localhost)
│   ├── server.py              # FastAPI server
│   ├── database.py            # SQLAlchemy setup
│   ├── models.py              # Database models
│   ├── init_db.py             # Database initialization
│   └── requirements.txt       # Python dependencies
│
├── frontend/
│   ├── .env                   # Backend URL (localhost:8001)
│   ├── .env.local            # Port 7050
│   ├── package.json          # Node dependencies
│   ├── public/
│   │   ├── favicon.ico       # Tab icon
│   │   ├── logo192.png       # Mobile icon
│   │   ├── logo512.png       # Desktop icon
│   │   └── manifest.json     # PWA config
│   └── src/                  # React source code
│
├── start_app.sh              # Menu khởi động chính
├── start_backend.sh          # Khởi động backend
├── start_frontend.sh         # Khởi động frontend
│
└── Docs/
    ├── QUICK_START.md        # Hướng dẫn nhanh
    ├── HUONG_DAN_LOCAL.md    # Chi tiết tiếng Việt
    ├── CHECKLIST.md          # Checklist files
    └── HUONG_DAN_PUSH_PULL.md # Push/Pull GitHub
```

---

## 🔍 KIỂM TRA CẤU HÌNH

### Kiểm tra Frontend config:
```bash
cat frontend/.env
# Phải thấy: REACT_APP_BACKEND_URL=http://localhost:8001

cat frontend/.env.local
# Phải thấy: PORT=7050
```

### Kiểm tra Backend config:
```bash
cat backend/.env
# Phải thấy:
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=190705
# DB_NAME=temp_mail
```

### Test Backend:
```bash
curl http://localhost:8001/health
# Response: {"status": "healthy"}
```

### Test Frontend:
Mở browser: http://localhost:7050

---

## ⚡ TROUBLESHOOTING

### 1. Port 7050 bị chiếm?
```bash
# Linux/macOS
lsof -ti:7050 | xargs kill -9

# Windows
netstat -ano | findstr :7050
taskkill /PID <PID> /F
```

### 2. Port 8001 bị chiếm?
```bash
# Linux/macOS
lsof -ti:8001 | xargs kill -9

# Windows
netstat -ano | findstr :8001
taskkill /PID <PID> /F
```

### 3. MySQL không kết nối được?

**Kiểm tra MySQL có chạy:**
```bash
# Ubuntu/Debian
sudo systemctl status mysql

# macOS
brew services list | grep mysql
```

**Kiểm tra credentials:**
```bash
mysql -u root -p
# Password: 190705
```

**Nếu lỗi "Access denied":**
```bash
sudo mysql

ALTER USER 'root'@'localhost' IDENTIFIED BY '190705';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Lỗi "Database doesn't exist"?
```bash
cd backend
source venv/bin/activate
python3 init_db.py
```

### 5. Frontend không load được API?

**Kiểm tra Backend có chạy:**
```bash
curl http://localhost:8001/health
```

**Kiểm tra CORS:**
Backend đã cấu hình `CORS_ORIGINS=*` nên sẽ accept requests từ localhost:7050

**Kiểm tra file .env:**
```bash
cat frontend/.env
# REACT_APP_BACKEND_URL phải là http://localhost:8001
```

---

## 📊 DATABASE SCHEMA

### Table: `temp_emails`
```sql
CREATE TABLE temp_emails (
    id VARCHAR(36) PRIMARY KEY,
    address VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    token TEXT,
    account_id VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    message_count INT DEFAULT 0
);
```

---

## 🎯 WORKFLOW HOÀN CHỈNH

### 1️⃣ Lần Đầu Setup:
```bash
# Clone repository
git clone https://github.com/kha0305/temp-mail.git
cd temp-mail

# Cài MySQL và tạo database
sudo mysql
CREATE DATABASE temp_mail CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER USER 'root'@'localhost' IDENTIFIED BY '190705';
EXIT;

# Chạy app
bash start_app.sh
# Chọn: 1 (Init DB) → 4 (Run All)
```

### 2️⃣ Development Hàng Ngày:
```bash
cd temp-mail
bash start_app.sh
# Chọn: 4 (Run All)
```

### 3️⃣ Truy Cập:
- Frontend: http://localhost:7050
- Backend: http://localhost:8001
- API Docs: http://localhost:8001/docs

---

## 📝 API ENDPOINTS

### Health Check
```bash
GET http://localhost:8001/health
```

### Generate Email
```bash
POST http://localhost:8001/api/generate-email
Response: {"email": "...", "password": "..."}
```

### List Emails
```bash
GET http://localhost:8001/api/emails
```

### Delete Email
```bash
DELETE http://localhost:8001/api/emails/{email_id}
```

### Get Messages
```bash
GET http://localhost:8001/api/emails/{email_id}/messages
```

---

## 💡 TIPS

### Hot Reload:
- ✅ Frontend: Tự động reload khi sửa code
- ✅ Backend: Tự động reload với flag `--reload`

### Multiple Terminals:
Dùng `tmux` hoặc `screen` để chạy nhiều terminal:
```bash
# Terminal 1: Backend
cd backend && source venv/bin/activate && uvicorn server:app --reload --port 8001

# Terminal 2: Frontend  
cd frontend && PORT=7050 yarn start
```

### VSCode Extensions:
- Python (Microsoft)
- ES7+ React/Redux/React-Native snippets
- MySQL (weijan chen)

---

## 🎉 TÓM TẮT

✅ **Frontend**: Port 7050 - http://localhost:7050
✅ **Backend**: Port 8001 - http://localhost:8001
✅ **Database**: MySQL localhost:3306/temp_mail
✅ **Favicon**: Theme màu tím gradient với icon mail + clock
✅ **100% Local**: Không cần internet để chạy (trừ TempMail API)

---

## 📚 XEM THÊM

- **QUICK_START.md** - Hướng dẫn nhanh
- **HUONG_DAN_LOCAL.md** - Chi tiết setup
- **CHECKLIST.md** - Checklist files cần có
- **HUONG_DAN_PUSH_PULL.md** - Push/Pull GitHub

---

**Chúc bạn code vui vẻ! 🚀**
