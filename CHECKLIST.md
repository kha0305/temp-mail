# CHECKLIST - Kiểm Tra Trước Khi Chạy MySQL Local

## ✅ Bước 1: Kiểm Tra File Cần Thiết

### Backend Files
```bash
cd backend
ls -la
```

**Cần có:**
- [ ] `server.py` - Server chính (MySQL version)
- [ ] `database.py` - SQLAlchemy config
- [ ] `models.py` - Database models (TempEmail, EmailHistory)
- [ ] `background_tasks.py` - Background tasks (auto-expire emails)
- [ ] `init_db.py` - Script khởi tạo database
- [ ] `requirements.txt` - Python dependencies
- [ ] `.env` - Environment variables

**KHÔNG CÓ các file MongoDB:**
- [ ] ❌ `database_mongodb.py`
- [ ] ❌ `models_mongodb.py`
- [ ] ❌ `background_tasks_mongodb.py`

### Frontend Files
```bash
cd frontend
ls -la
```

**Cần có:**
- [ ] `package.json`
- [ ] `src/App.js`
- [ ] `src/App.css`
- [ ] `.env`

## ✅ Bước 2: Kiểm Tra Environment Variables

### Backend: `backend/.env`
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705      # ⚠️ THAY PASSWORD CỦA BẠN!
DB_NAME=temp_mail
CORS_ORIGINS=*
```

**Kiểm tra:**
- [ ] `DB_PASSWORD` đã đổi thành password MySQL của bạn
- [ ] `DB_NAME=temp_mail`
- [ ] `DB_HOST=localhost`

### Frontend: `frontend/.env`
```env
REACT_APP_BACKEND_URL=http://localhost:8001
PORT=7050
```

**Kiểm tra:**
- [ ] `REACT_APP_BACKEND_URL=http://localhost:8001` (không có /api)
- [ ] `PORT=7050` hoặc port bạn muốn dùng

## ✅ Bước 3: Kiểm Tra Hệ Thống

### MySQL
```bash
# Kiểm tra MySQL đang chạy
mysql --version
sudo systemctl status mysql  # Linux
brew services list | grep mysql  # Mac

# Test kết nối
mysql -u root -p
# Nhập password và kiểm tra kết nối thành công
```

**Kiểm tra:**
- [ ] MySQL version 8.0 trở lên
- [ ] MySQL đang chạy (status: running/active)
- [ ] Kết nối thành công với user/password

### Python
```bash
python --version
# hoặc
python3 --version
```

**Kiểm tra:**
- [ ] Python 3.9 trở lên

### Node.js & Yarn
```bash
node --version
yarn --version
```

**Kiểm tra:**
- [ ] Node.js 18 trở lên
- [ ] Yarn đã cài đặt

## ✅ Bước 4: Khởi Tạo Database

```bash
cd backend

# Tạo database nếu chưa có
mysql -u root -p
CREATE DATABASE temp_mail;
EXIT;

# Chạy init script
python init_db.py
```

**Kết quả mong đợi:**
```
✅ Successfully connected to MySQL server
✅ Database 'temp_mail' already exists
✅ All tables created successfully!
```

## ✅ Bước 5: Cài Đặt Dependencies

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Kiểm tra:**
- [ ] Virtual environment đã tạo
- [ ] Tất cả packages cài thành công
- [ ] Không có lỗi

### Frontend
```bash
cd frontend
yarn install
```

**Kiểm tra:**
- [ ] node_modules đã tạo
- [ ] Không có lỗi cài đặt

## ✅ Bước 6: Chạy Ứng Dụng

### Terminal 1 - Backend
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Kiểm tra:**
- [ ] Server khởi động không lỗi
- [ ] Thấy log: "Application startup complete"
- [ ] Không có lỗi MySQL connection

### Terminal 2 - Frontend
```bash
cd frontend
PORT=7050 yarn start
```

**Kiểm tra:**
- [ ] Compile thành công
- [ ] Browser tự động mở http://localhost:7050
- [ ] Không có lỗi compile

## ✅ Bước 7: Test Ứng Dụng

### Frontend (http://localhost:7050)
- [ ] Trang web load thành công
- [ ] Email tự động được tạo khi vào trang
- [ ] Hiển thị địa chỉ email
- [ ] Timer đếm ngược 10:00 → 09:59...
- [ ] Nút "Làm mới 10 phút" hoạt động
- [ ] Tab "Lịch sử" hiển thị được

### Backend API (http://localhost:8001/docs)
- [ ] Swagger docs load được
- [ ] Test endpoint GET /api/emails
- [ ] Test endpoint POST /api/emails/create
- [ ] Response trả về đúng format

## ❌ Troubleshooting

### Lỗi: Can't connect to MySQL
```bash
# Kiểm tra MySQL status
sudo systemctl status mysql

# Restart MySQL
sudo systemctl restart mysql

# Check password trong .env
cat backend/.env | grep PASSWORD
```

### Lỗi: Port already in use
```bash
# Kill port 8001
lsof -ti:8001 | xargs kill -9

# Kill port 7050
lsof -ti:7050 | xargs kill -9
```

### Lỗi: Table doesn't exist
```bash
cd backend
python init_db.py --reset
# Enter 'yes' để confirm
```

### Lỗi: Module not found
```bash
# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
yarn install
```

## 📝 Summary

Trước khi chạy, đảm bảo:

✅ **Files**: Tất cả file cần thiết có đầy đủ, không có file MongoDB
✅ **MySQL**: Đang chạy, database 'temp_mail' đã tạo
✅ **Config**: File .env đã cấu hình đúng (đặc biệt là DB_PASSWORD)
✅ **Dependencies**: Đã cài đặt đầy đủ cho backend và frontend
✅ **Ports**: Port 8001 và 3000 không bị chiếm
✅ **Init**: Đã chạy init_db.py thành công

Nếu tất cả đều ✅, bạn có thể chạy ứng dụng!
