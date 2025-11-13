# TempMail - Ứng dụng Email Tạm Thời

Ứng dụng tạo và quản lý email tạm thời với thời gian sử dụng 10 phút. Hỗ trợ nhiều nhà cung cấp email: Mail.tm, Mail.gw, 1secmail.

## Công nghệ sử dụng

- **Backend**: FastAPI (Python) + MySQL
- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Database**: MySQL/MariaDB

## Tính năng

- ✉️ Tạo email tạm thời tự động
- ⏰ Thời gian sử dụng 10 phút (có thể gia hạn)
- 🔄 Tự động làm mới email khi hết hạn
- 📧 Nhận và đọc email thời gian thực
- 💾 Lưu email quan trọng
- 📜 Lịch sử email đã hết hạn
- 🎲 Hỗ trợ nhiều dịch vụ email (Mail.tm, Mail.gw, 1secmail)
- 🌓 Chế độ sáng/tối

## Cài đặt

### Yêu cầu hệ thống

- Python 3.8+
- Node.js 16+
- MySQL 5.7+ hoặc MariaDB 10.3+

### Bước 1: Cài đặt MySQL

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install mariadb-server mariadb-client
sudo service mariadb start

# Tạo database
mysql -u root -e "CREATE DATABASE temp_mail CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '190705'; FLUSH PRIVILEGES;"
```

### Bước 2: Cài đặt Backend

```bash
cd /app/backend
pip install -r requirements.txt
```

### Bước 3: Cấu hình .env

File `/app/backend/.env` đã được cấu hình sẵn:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705
DB_NAME=temp_mail
CORS_ORIGINS=http://localhost:3000
```

### Bước 4: Cài đặt Frontend

```bash
cd /app/frontend
yarn install
```

### Bước 5: Chạy ứng dụng

**Sử dụng Supervisor (Khuyến nghị):**

```bash
sudo supervisorctl restart all
```

**Hoặc chạy thủ công:**

```bash
# Terminal 1 - Backend
cd /app/backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 - Frontend
cd /app/frontend
yarn start
```

### Truy cập ứng dụng

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001/api
- **API Docs**: http://localhost:8001/docs

## Cấu trúc dự án

```
/app/
├── backend/              # FastAPI backend
│   ├── server.py        # Main application
│   ├── database.py      # MySQL connection
│   ├── models.py        # SQLAlchemy models
│   ├── requirements.txt # Python dependencies
│   └── .env            # Environment variables
├── frontend/            # React frontend
│   ├── src/
│   │   ├── App.js      # Main component
│   │   └── components/ # UI components
│   ├── package.json    # Node dependencies
│   └── .env           # Frontend config
└── README.md          # This file
```

## API Endpoints

### Email Management

- `POST /api/emails/create` - Tạo email mới
- `GET /api/emails` - Lấy danh sách email
- `GET /api/emails/{id}` - Lấy chi tiết email
- `DELETE /api/emails/{id}` - Xóa email
- `POST /api/emails/{id}/extend-time` - Gia hạn thời gian

### Messages

- `GET /api/emails/{id}/messages` - Lấy danh sách tin nhắn
- `GET /api/emails/{id}/messages/{msg_id}` - Xem chi tiết tin nhắn
- `POST /api/emails/{id}/refresh` - Làm mới tin nhắn

### History & Saved

- `GET /api/emails/history/list` - Lịch sử email
- `DELETE /api/emails/history/delete` - Xóa lịch sử
- `GET /api/emails/saved/list` - Email đã lưu
- `POST /api/emails/{id}/messages/{msg_id}/save` - Lưu tin nhắn
- `DELETE /api/emails/saved/delete` - Xóa email đã lưu

## Database Schema

### Table: temp_emails

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| address | VARCHAR(255) | Email address |
| password | VARCHAR(255) | Email password |
| token | TEXT | Auth token |
| account_id | VARCHAR(255) | Provider account ID |
| created_at | DATETIME | Thời gian tạo |
| expires_at | DATETIME | Thời gian hết hạn |
| message_count | INT | Số tin nhắn |
| provider | VARCHAR(50) | Nhà cung cấp |
| username | VARCHAR(255) | Username |
| domain | VARCHAR(255) | Domain |

### Table: email_history

Lưu trữ email đã hết hạn

### Table: saved_emails

Lưu trữ email/tin nhắn quan trọng

## Troubleshooting

### MySQL Connection Error

```bash
# Kiểm tra MySQL đang chạy
sudo service mariadb status
sudo service mariadb start

# Kiểm tra database
mysql -u root -p190705 -e "SHOW DATABASES;"
```

### Backend không khởi động

```bash
# Xem logs
tail -f /var/log/supervisor/backend.err.log

# Cài lại dependencies
cd /app/backend
pip install -r requirements.txt --force-reinstall
```

### Frontend không khởi động

```bash
# Xóa node_modules và cài lại
cd /app/frontend
rm -rf node_modules yarn.lock
yarn install
```

## License

MIT License

## Support

Nếu gặp vấn đề, vui lòng tạo issue trên GitHub hoặc liên hệ developer.
