# 🚀 Quick Reference - TempMail Local Setup

## Khởi Động Nhanh

```bash
# Chạy ứng dụng (Recommended)
cd /app
bash start_app.sh
# Chọn Option 3 (Backend + Frontend)
```

---

## 📝 Các Lệnh Quan Trọng

### 1. Khởi Tạo Database (Lần đầu tiên)
```bash
cd /app/backend
python3 init_db.py
```

### 2. Chạy Backend (Terminal 1)
```bash
cd /app/backend
source venv/bin/activate  # Hoặc tạo mới: python3 -m venv venv
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Chạy Frontend (Terminal 2)
```bash
cd /app/frontend
yarn install
PORT=7050 yarn start
```

### 4. Chạy Tất Cả (Script tự động)
```bash
bash start_app.sh
```

---

## 🔍 Kiểm Tra Services

### MySQL
```bash
# Kiểm tra MySQL đang chạy
sudo systemctl status mysql     # Linux
brew services list              # macOS

# Khởi động MySQL
sudo systemctl start mysql      # Linux
brew services start mysql       # macOS

# Đăng nhập MySQL
mysql -u root -p190705

# Kiểm tra database
USE garena_creator_db;
SHOW TABLES;
DESCRIBE temp_emails;
SELECT COUNT(*) FROM temp_emails;
EXIT;
```

### Backend
```bash
# Test API
curl http://localhost:8001/api/

# Xem logs backend
tail -f /app/backend/logs/*.log  # Nếu có logging

# Kiểm tra port
lsof -i :8001
```

### Frontend
```bash
# Kiểm tra port
lsof -i :7050

# Mở trong browser
open http://localhost:7050       # macOS
xdg-open http://localhost:7050   # Linux
```

---

## 🐛 Troubleshooting

### Port đã được sử dụng
```bash
# Tìm process
lsof -i :8001  # Backend
lsof -i :7050  # Frontend

# Kill process
kill -9 <PID>
```

### Lỗi kết nối MySQL
```bash
# Kiểm tra MySQL đang chạy
ps aux | grep mysql

# Restart MySQL
sudo systemctl restart mysql     # Linux
brew services restart mysql      # macOS

# Kiểm tra user và password
mysql -u root -p

# Kiểm tra bind-address trong config
sudo cat /etc/mysql/mysql.conf.d/mysqld.cnf | grep bind-address
# Nên là: bind-address = 127.0.0.1 hoặc 0.0.0.0
```

### Module not found (Backend)
```bash
cd /app/backend
source venv/bin/activate
pip install -r requirements.txt
```

### Dependencies error (Frontend)
```bash
cd /app/frontend
rm -rf node_modules package-lock.json yarn.lock
yarn install
```

### Database không tồn tại
```bash
mysql -u root -p190705
CREATE DATABASE garena_creator_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

cd /app/backend
python3 init_db.py
```

---

## 📊 Database Operations

### Xem dữ liệu
```sql
USE garena_creator_db;

-- Xem tất cả emails
SELECT * FROM temp_emails;

-- Đếm số email
SELECT COUNT(*) FROM temp_emails;

-- Xem email mới nhất
SELECT * FROM temp_emails ORDER BY created_at DESC LIMIT 5;

-- Xem email có tin nhắn
SELECT address, message_count FROM temp_emails WHERE message_count > 0;
```

### Xóa dữ liệu
```sql
-- Xóa tất cả emails
TRUNCATE TABLE temp_emails;

-- Xóa emails cũ hơn 1 ngày
DELETE FROM temp_emails WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 DAY);

-- Xóa emails không có tin nhắn
DELETE FROM temp_emails WHERE message_count = 0;
```

### Backup & Restore
```bash
# Backup
mysqldump -u root -p190705 garena_creator_db > backup_$(date +%Y%m%d).sql

# Restore
mysql -u root -p190705 garena_creator_db < backup_20250103.sql
```

---

## 🔗 URLs & Endpoints

### URLs
- Frontend: http://localhost:7050
- Backend: http://localhost:8001
- API Docs: http://localhost:8001/docs
- Alternative Docs: http://localhost:8001/redoc

### API Endpoints
```bash
# Health check
curl http://localhost:8001/api/

# Tạo email mới
curl -X POST http://localhost:8001/api/emails/create \
  -H "Content-Type: application/json" \
  -d '{"username": "test123"}'

# Lấy danh sách emails
curl http://localhost:8001/api/emails

# Lấy chi tiết email
curl http://localhost:8001/api/emails/{email_id}

# Lấy tin nhắn
curl http://localhost:8001/api/emails/{email_id}/messages

# Refresh tin nhắn
curl -X POST http://localhost:8001/api/emails/{email_id}/refresh

# Xóa email
curl -X DELETE http://localhost:8001/api/emails/{email_id}
```

---

## 📦 Environment Variables

### Backend (.env)
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705
DB_NAME=garena_creator_db
CORS_ORIGINS=*
```

### Frontend (.env)
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Frontend (.env.local)
```env
PORT=7050
```

---

## 🔄 Development Workflow

### 1. Bắt đầu ngày mới
```bash
# Khởi động MySQL
sudo systemctl start mysql

# Chạy ứng dụng
cd /app
bash start_app.sh
```

### 2. Khi sửa Backend code
```bash
# Backend tự động reload với --reload flag
# Chỉ cần lưu file, không cần restart
```

### 3. Khi sửa Frontend code
```bash
# React tự động hot reload
# Chỉ cần lưu file
```

### 4. Khi thêm dependencies
```bash
# Backend
cd /app/backend
pip install <package>
pip freeze > requirements.txt

# Frontend
cd /app/frontend
yarn add <package>
```

### 5. Khi thay đổi database schema
```bash
# Cập nhật models.py
# Sau đó:
cd /app/backend
python3 init_db.py  # Tạo lại tables
```

---

## 📚 Useful Commands

### Git Operations (Nếu dùng version control)
```bash
# Xem thay đổi
git status
git diff

# Commit changes
git add .
git commit -m "Description"

# Push to remote
git push origin main
```

### System Monitoring
```bash
# Kiểm tra CPU/Memory
top
htop

# Kiểm tra disk space
df -h

# Kiểm tra process
ps aux | grep python
ps aux | grep node
```

### Logs
```bash
# Backend logs
tail -f /var/log/supervisor/backend.*.log

# Frontend logs
# Xem trong terminal đang chạy yarn start

# MySQL logs
sudo tail -f /var/log/mysql/error.log
```

---

## 🎯 Quick Tips

1. **Luôn kiểm tra MySQL đang chạy trước khi start backend**
2. **Sử dụng API Docs** (/docs) để test endpoints nhanh
3. **Kiểm tra .env files** nếu có lỗi kết nối
4. **Port 7050** cho frontend, **8001** cho backend
5. **Backup database** trước khi làm việc với production data

---

## 📞 Support

Nếu gặp vấn đề:
1. Xem SETUP_GUIDE.md để biết chi tiết
2. Kiểm tra logs trong terminal
3. Verify các services đang chạy
4. Kiểm tra .env configuration

---

**Last Updated**: 2025-01-03
**Version**: 1.0
