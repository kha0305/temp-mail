# TempMail - MySQL Version (Local)

Ứng dụng email tạm thời với MySQL database, chạy hoàn toàn trên máy local.

## 🚀 Quick Start

### 1. Yêu cầu
- MySQL 8.0+ (đang chạy trên localhost:3306)
- Python 3.9+
- Node.js 18+ & Yarn

### 2. Cấu hình Database

**Backend `.env`:**
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705
DB_NAME=temp_mail
CORS_ORIGINS=*
```

### 3. Khởi tạo Database

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python init_db.py
```

### 4. Chạy Backend

```bash
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 5. Chạy Frontend (Terminal mới)

```bash
cd frontend
yarn install
PORT=7050 yarn start
```

### 6. Truy cập

- Frontend: http://localhost:7050
- Backend: http://localhost:8001
- API Docs: http://localhost:8001/docs

---

## ✨ Tính năng

### ✅ Tự động tạo email
- Khi vào trang lần đầu → tự động tạo email
- Khi hết 10 phút → tự động tạo email mới

### ⏱️ Timer & Gia hạn
- Timer đếm ngược 10 phút
- Nút "Làm mới 10 phút": Reset về 10 phút (không cộng dồn)

### 📧 Quản lý email
- Xem tin nhắn real-time
- Auto-refresh mỗi 10 giây
- Xóa email thủ công

### 📜 Lịch sử
- Lưu email đã hết hạn
- Xem lại tin nhắn cũ
- Xóa chọn lọc hoặc xóa tất cả

---

## 🔧 Tech Stack

- **Frontend:** React 18 + Tailwind CSS + shadcn/ui
- **Backend:** FastAPI + SQLAlchemy
- **Database:** MySQL 8.0
- **Email Service:** Mail.tm API

---

## 📋 Database Schema

**temp_emails**: Email đang hoạt động (expires_at)
**email_history**: Email đã hết hạn (expired_at)

---

## 🐛 Troubleshooting

### MySQL connection error
```bash
# Kiểm tra MySQL đang chạy
mysql -u root -p190705

# Hoặc
services.msc  # Windows
mysql.server start  # Mac
sudo systemctl start mysql  # Linux
```

### Port already in use
```bash
# Backend (8001)
lsof -i :8001
kill -9 <PID>

# Frontend (7050)
lsof -i :7050
kill -9 <PID>
```

---

## 📚 Xem hướng dẫn chi tiết

👉 **[HUONG_DAN_CHAY_LOCAL_MYSQL.md](./HUONG_DAN_CHAY_LOCAL_MYSQL.md)**

---

Made with ❤️ for local development
