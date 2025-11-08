# HƯỚNG DẪN CHẠY TEMPMAIL VỚI MYSQL TRÊN LOCAL

## ✅ YÊU CẦU HỆ THỐNG

### 1. MySQL (8.0 trở lên)
- **Tải về:** https://dev.mysql.com/downloads/mysql/
- **Username:** root
- **Password:** 190705 (hoặc password bạn đã đặt)
- **Port:** 3306

### 2. Python (3.9+)
```bash
python --version
# Hoặc
python3 --version
```

### 3. Node.js & Yarn (18+)
```bash
node --version
yarn --version
```

---

## 📋 CÀI ĐẶT TỪNG BƯỚC

### Bước 1: Clone/Download code

Nếu code đã có trên máy, bỏ qua bước này.

### Bước 2: Cấu hình MySQL

1. **Mở MySQL Workbench hoặc MySQL Command Line**

2. **Tạo database** (tự động nếu dùng script, nhưng có thể tạo thủ công):
```sql
CREATE DATABASE IF NOT EXISTS temp_mail CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

3. **Kiểm tra kết nối:**
```bash
mysql -u root -p
# Nhập password: 190705
```

### Bước 3: Cấu hình Backend

1. **Kiểm tra file `.env` trong folder `backend/`:**
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705
DB_NAME=temp_mail
CORS_ORIGINS=*
```

2. **Cài đặt Python dependencies:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. **Khởi tạo database:**
```bash
python init_db.py
```

Bạn sẽ thấy:
```
✅ Database 'temp_mail' is ready!
✅ All tables created successfully!
```

### Bước 4: Cấu hình Frontend

1. **Kiểm tra file `.env` trong folder `frontend/`:**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
PORT=7050
```

2. **Cài đặt dependencies:**
```bash
cd frontend
yarn install
```

---

## 🚀 CHẠY ỨNG DỤNG

### Cách 1: Chạy bằng script tự động (Khuyên dùng)

**Linux/Mac:**
```bash
chmod +x start_app.sh
./start_app.sh
```

**Windows:**
```bash
# Mở 2 terminals:

# Terminal 1 - Backend
cd backend
venv\Scripts\activate
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 - Frontend
cd frontend
set PORT=7050 && yarn start
```

### Cách 2: Chạy thủ công

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
PORT=7050 yarn start
```

---

## 📍 TRUY CẬP ỨNG DỤNG

- **Frontend:** http://localhost:7050
- **Backend API:** http://localhost:8001
- **API Docs:** http://localhost:8001/docs

---

## ✨ TÍNH NĂNG MỚI

### 1. **Tự động tạo email khi vào trang**
- Khi mở app lần đầu → tự động tạo email ngay
- Không cần click nút "Tạo Email Mới"

### 2. **Tự động tạo email mới khi hết hạn**
- Sau 10 phút → email cũ tự động chuyển vào "Lịch sử"
- Email mới tự động được tạo và hiển thị
- Timer reset về 10 phút

### 3. **Nút "Làm mới 10 phút"**
- Click để reset timer về 10 phút
- **KHÔNG cộng dồn** thời gian cũ
- Ví dụ: Còn 3 phút → click → reset về 10 phút

### 4. **Lịch sử email**
- Xem tất cả email đã hết hạn
- Tick chọn email để xóa
- Nút "Xóa tất cả" để xóa toàn bộ lịch sử

---

## 🐛 TROUBLESHOOTING

### Lỗi: "Can't connect to MySQL server"

**Giải pháp:**
1. Kiểm tra MySQL đang chạy:
```bash
# Windows
services.msc → Tìm MySQL → Start

# Mac
mysql.server start

# Linux
sudo systemctl start mysql
```

2. Kiểm tra username/password trong `.env`:
```bash
mysql -u root -p190705
```

3. Kiểm tra port 3306:
```bash
netstat -an | grep 3306
```

### Lỗi: "Module not found" (Python)

**Giải pháp:**
```bash
cd backend
pip install -r requirements.txt
```

### Lỗi: "Port 8001 already in use"

**Giải pháp:**
```bash
# Windows
netstat -ano | findstr :8001
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :8001
kill -9 <PID>
```

### Lỗi: "Port 7050 already in use"

**Giải pháp:**
```bash
# Đổi PORT trong frontend/.env:
PORT=7050

# Hoặc kill process:
# Windows: taskkill /IM node.exe /F
# Linux/Mac: killall node
```

### Backend chạy nhưng không tạo email tự động

**Kiểm tra:**
1. Background tasks có chạy không:
```bash
# Trong terminal backend, bạn sẽ thấy:
# INFO:     Background tasks started (MySQL)
```

2. Xem logs backend:
```bash
# Terminal đang chạy backend sẽ hiển thị logs real-time
```

---

## 📊 DATABASE SCHEMA

### Table: `temp_emails`
```sql
CREATE TABLE temp_emails (
    id VARCHAR(36) PRIMARY KEY,
    address VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    token TEXT NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    message_count INT DEFAULT 0
);
```

### Table: `email_history`
```sql
CREATE TABLE email_history (
    id VARCHAR(36) PRIMARY KEY,
    address VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    token TEXT NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL,
    expired_at DATETIME NOT NULL,
    message_count INT DEFAULT 0
);
```

---

## 🔧 API ENDPOINTS

### Emails (Active)
- `POST /api/emails/create` - Tạo email mới
- `GET /api/emails` - Lấy danh sách email active
- `GET /api/emails/{id}` - Chi tiết email
- `GET /api/emails/{id}/messages` - Lấy tin nhắn
- `POST /api/emails/{id}/refresh` - Làm mới tin nhắn
- `POST /api/emails/{id}/extend-time` - Gia hạn 10 phút
- `DELETE /api/emails/{id}` - Xóa email

### History
- `GET /api/emails/history/list` - Danh sách lịch sử
- `GET /api/emails/history/{id}/messages` - Tin nhắn từ email cũ
- `DELETE /api/emails/history/delete` - Xóa lịch sử

---

## ⚡ TỐI ƯU HÓA

### Background Tasks
- Check email hết hạn mỗi 30 giây
- Tự động chuyển vào history
- Tự động tạo email mới nếu không còn active email

### Auto Refresh
- Messages tự động refresh mỗi 10 giây
- Có thể tắt/bật bằng toggle button

### Timer
- Update mỗi 1 giây
- Tính toán real-time từ `expires_at`
- Không lưu trong localStorage (luôn chính xác)

---

## 📝 GHI CHÚ

1. **Email hết hạn sau 10 phút** từ khi tạo hoặc từ khi gia hạn
2. **Nút "Làm mới 10 phút"** reset về 10 phút, không cộng dồn
3. **Background task** tự động xử lý email hết hạn
4. **UUID được dùng** thay vì ObjectID của MongoDB
5. **Database local** trên máy bạn, không chia sẻ với ai

---

## ❓ HỖ TRỢ

Nếu gặp vấn đề:
1. Kiểm tra MySQL đang chạy
2. Kiểm tra port 8001 và 7050 chưa bị chiếm
3. Xem logs trong terminal backend/frontend
4. Kiểm tra file `.env` có đúng thông tin MySQL không

---

**Chúc bạn sử dụng app vui vẻ! 🎉**
