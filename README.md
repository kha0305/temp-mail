# 📧 TempMail Application - Ứng Dụng Email Tạm Thời

Ứng dụng tạo và quản lý email tạm thời sử dụng Mail.tm API, được xây dựng với FastAPI (Backend), React (Frontend), và MySQL (Database).

## 🌟 Tính Năng

- ✉️ Tạo email tạm thời tức thì
- 📨 Nhận và đọc tin nhắn email
- 🔄 Tự động refresh tin nhắn mới
- 🗑️ Xóa email không cần thiết
- 💾 Lưu trữ lịch sử email trong MySQL

## 🚀 Bắt Đầu Nhanh

### Yêu Cầu
- Python 3.11+
- Node.js 16+
- MySQL 8.0+

### Cài Đặt và Chạy

```bash
# 1. Clone hoặc vào thư mục dự án
cd /app

# 2. Cấu hình database trong backend/.env
# Đảm bảo thông tin MySQL đúng

# 3. Khởi tạo database và chạy ứng dụng
bash start_app.sh
```

Chọn option:
- **Option 3**: Chạy cả Backend và Frontend (Khuyến nghị)
- **Option 4**: Khởi tạo Database (nếu chưa tạo)

## 📚 Hướng Dẫn Chi Tiết

Xem file [SETUP_GUIDE.md](./SETUP_GUIDE.md) để có hướng dẫn đầy đủ về:
- Cài đặt dependencies
- Cấu hình MySQL
- Troubleshooting
- Backup/Restore database

## 🔗 URLs

Sau khi khởi động:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs

## 🏗️ Cấu Trúc Dự Án

```
/app/
├── backend/              # FastAPI Backend
│   ├── server.py        # Main server file
│   ├── database.py      # Database connection
│   ├── models.py        # SQLAlchemy models
│   ├── init_db.py       # Database initialization script
│   ├── requirements.txt # Python dependencies
│   └── .env            # Environment variables
├── frontend/            # React Frontend
│   ├── src/            # Source code
│   ├── public/         # Static files
│   ├── package.json    # Node dependencies
│   └── .env           # Frontend config
├── start_app.sh        # Main startup script
├── start_backend.sh    # Backend only
├── start_frontend.sh   # Frontend only
├── SETUP_GUIDE.md     # Detailed setup guide
└── README.md          # This file
```

## 🛠️ Tech Stack

- **Backend**: FastAPI, SQLAlchemy, PyMySQL
- **Frontend**: React, Axios
- **Database**: MySQL 8.0+
- **External API**: Mail.tm

## 📝 API Endpoints

- `GET /api/` - Health check
- `POST /api/emails/create` - Tạo email mới
- `GET /api/emails` - Lấy danh sách email
- `GET /api/emails/{email_id}` - Lấy chi tiết email
- `GET /api/emails/{email_id}/messages` - Lấy tin nhắn
- `POST /api/emails/{email_id}/refresh` - Refresh tin nhắn
- `DELETE /api/emails/{email_id}` - Xóa email

## 🔧 Development

### Chạy Backend Riêng
```bash
bash start_backend.sh
```

### Chạy Frontend Riêng
```bash
bash start_frontend.sh
```

### Khởi Tạo Database
```bash
cd backend
python3 init_db.py
```

## 🐛 Troubleshooting

### Không kết nối được MySQL
```bash
# Kiểm tra MySQL đang chạy
sudo systemctl status mysql  # Linux
brew services list          # macOS

# Khởi động MySQL
sudo systemctl start mysql  # Linux
brew services start mysql  # macOS
```

### Port đã được sử dụng
```bash
# Tìm process đang dùng port
lsof -i :8001  # Backend
lsof -i :3000  # Frontend

# Kill process
kill -9 <PID>
```

## 📄 License

MIT License

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

---

**Made with ❤️ using FastAPI + React + MySQL**
