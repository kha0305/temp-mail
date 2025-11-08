# TempMail - Email Tạm Thời 10 Phút

Ứng dụng tạo email tạm thời với tự động hết hạn sau 10 phút.

## 🚀 Quick Start (MySQL Local)

### Yêu cầu
- MySQL 8.0+
- Python 3.9+
- Node.js 18+ & Yarn

### Cài đặt nhanh

```bash
# 1. Tạo database
mysql -u root -p
CREATE DATABASE temp_mail;
EXIT;

# 2. Cấu hình password MySQL
# Sửa file: backend/.env
# DB_PASSWORD=190705  ← Thay bằng password MySQL của bạn

# 3. Khởi tạo database
cd backend
python init_db.py

# 4. Chạy backend (Terminal 1)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# 5. Chạy frontend (Terminal 2)
cd frontend
yarn install
PORT=7050 yarn start
```

### Truy cập
- **Frontend**: http://localhost:7050
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs

## ✨ Tính năng

✅ Tự động tạo email khi vào trang  
✅ Hết 10 phút → tự động tạo email mới  
✅ Nút "Làm mới 10 phút" (reset về 10 phút)  
✅ Lịch sử email với tính năng chọn/xóa  
✅ Theme sáng/tối  
✅ Giao diện hiện đại  

## 📚 Tài liệu

- **[HUONG_DAN_MYSQL.md](HUONG_DAN_MYSQL.md)** - Hướng dẫn chi tiết đầy đủ
- **[CHECKLIST.md](CHECKLIST.md)** - Checklist kiểm tra trước khi chạy
- **[HUONG_DAN_CHAY_LOCAL_MYSQL.md](HUONG_DAN_CHAY_LOCAL_MYSQL.md)** - Hướng dẫn thay thế

## 🛠️ Tech Stack

- **Backend**: FastAPI + SQLAlchemy + PyMySQL
- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Database**: MySQL 8.0+
- **Email Provider**: Mail.tm API

## 📂 Cấu trúc Project

```
/app/
├── backend/
│   ├── server.py           # Server chính (MySQL)
│   ├── database.py         # SQLAlchemy config
│   ├── models.py           # Database models
│   ├── background_tasks.py # Auto-expire background tasks
│   ├── init_db.py          # Database initialization
│   ├── requirements.txt    # Python dependencies
│   └── .env                # Environment variables
├── frontend/
│   ├── src/
│   │   ├── App.js          # Main React component
│   │   └── App.css         # Styles
│   ├── package.json        # Node dependencies
│   └── .env                # Frontend config
├── HUONG_DAN_MYSQL.md      # Detailed guide
├── CHECKLIST.md            # Pre-run checklist
└── README.md               # This file
```

## ⚙️ Environment Variables

### Backend: `backend/.env`
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705          # ⚠️ THAY PASSWORD CỦA BẠN!
DB_NAME=temp_mail
CORS_ORIGINS=*
```

### Frontend: `frontend/.env`
```env
REACT_APP_BACKEND_URL=http://localhost:8001
PORT=7050
```

## 🐛 Troubleshooting

### MySQL Connection Error
```bash
# Kiểm tra MySQL đang chạy
sudo systemctl status mysql

# Kiểm tra password trong .env
cat backend/.env | grep PASSWORD
```

### Port Already in Use
```bash
# Kill port 8001
lsof -ti:8001 | xargs kill -9

# Kill port 3000
lsof -ti:3000 | xargs kill -9
```

### Table Not Found
```bash
cd backend
python init_db.py --reset
# Enter 'yes' to confirm
```

## 📝 API Endpoints

### Emails
- `POST /api/emails/create` - Tạo email mới
- `GET /api/emails` - Lấy danh sách email
- `POST /api/emails/{id}/extend-time` - Làm mới 10 phút
- `DELETE /api/emails/{id}` - Xóa email

### Messages
- `GET /api/emails/{id}/messages` - Lấy tin nhắn
- `POST /api/emails/{id}/refresh` - Làm mới tin nhắn

### History
- `GET /api/emails/history/list` - Danh sách lịch sử
- `DELETE /api/emails/history/delete` - Xóa lịch sử (selective/all)

## 🔥 Features Detail

### Auto-Create Email
- Email tự động tạo khi vào trang lần đầu
- Không cần click nút "Tạo Email"

### Auto-Expire & Renewal
- Email hết hạn sau 10 phút
- Tự động chuyển vào lịch sử
- Tự động tạo email mới

### Extend Time
- Click "Làm mới 10 phút"
- Timer reset về 10:00 (không cộng dồn)
- Ví dụ: 3:45 → Click → 10:00

### History Management
- Xem email đã hết hạn
- Checkbox chọn email
- Nút "Xóa đã chọn" / "Xóa tất cả"

## 📦 Database Schema

### Table: `temp_emails`
- `id` - Integer (Auto-increment)
- `address` - Email address (Unique)
- `password` - Generated password
- `token` - Authentication token
- `account_id` - Mail.tm account ID
- `created_at` - Created timestamp
- `expires_at` - Expiry timestamp (10 min)
- `message_count` - Number of messages
- `provider` - Email provider (mailtm)

### Table: `email_history`
- `id` - Integer (Auto-increment)
- `address` - Email address
- `expired_at` - Expiry timestamp
- (other fields same as temp_emails)

## 🚨 Quan trọng

1. **MySQL phải đang chạy** trước khi start backend
2. **Đổi password** trong `backend/.env` thành password MySQL của bạn
3. **Chạy init_db.py** để tạo tables trước khi start server
4. **Port 8001 và 3000** không được chiếm bởi process khác
5. **Background task** tự động chạy - check expired emails mỗi 30 giây

## 📞 Support

Nếu gặp vấn đề:
1. Kiểm tra [CHECKLIST.md](CHECKLIST.md)
2. Đọc [HUONG_DAN_MYSQL.md](HUONG_DAN_MYSQL.md)
3. Kiểm tra logs backend để debug
4. Đảm bảo MySQL đang chạy và password đúng

---

**Phiên bản**: 2.0 - MySQL Local Edition  
**Ngày cập nhật**: 2025-01-08
