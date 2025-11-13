# HƯỚNG DẪN CHI TIẾT - TEMPMAIL

## Mục lục

1. [Cài đặt môi trường](#1-cài-đặt-môi-trường)
2. [Cấu hình MySQL](#2-cấu-hình-mysql)
3. [Chạy ứng dụng](#3-chạy-ứng-dụng)
4. [Sử dụng ứng dụng](#4-sử-dụng-ứng-dụng)
5. [Xử lý lỗi thường gặp](#5-xử-lý-lỗi-thường-gặp)

---

## 1. Cài đặt môi trường

### 1.1 Cài đặt Python (Backend)

```bash
# Kiểm tra Python đã cài
python3 --version

# Cài đặt pip nếu chưa có
sudo apt-get install python3-pip

# Di chuyển vào thư mục backend
cd /app/backend

# Cài đặt dependencies
pip install -r requirements.txt
```

### 1.2 Cài đặt Node.js (Frontend)

```bash
# Kiểm tra Node.js đã cài
node --version
npm --version

# Cài yarn (khuyến nghị)
npm install -g yarn

# Di chuyển vào thư mục frontend
cd /app/frontend

# Cài đặt dependencies
yarn install
```

---

## 2. Cấu hình MySQL

### 2.1 Cài đặt MySQL/MariaDB

**Ubuntu/Debian:**

```bash
sudo apt-get update
sudo apt-get install mariadb-server mariadb-client
```

**macOS:**

```bash
brew install mariadb
brew services start mariadb
```

**Windows:**

Tải và cài đặt MySQL Community Server từ: https://dev.mysql.com/downloads/mysql/

### 2.2 Khởi động MySQL

```bash
# Linux
sudo service mariadb start
sudo service mariadb status

# macOS
brew services start mariadb

# Windows
# MySQL tự động chạy sau khi cài đặt
```

### 2.3 Tạo Database

```bash
# Kết nối MySQL (không cần password lần đầu)
mysql -u root

# Trong MySQL shell:
CREATE DATABASE temp_mail CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Đặt password cho root
ALTER USER 'root'@'localhost' IDENTIFIED BY '190705';
FLUSH PRIVILEGES;

# Thoát
exit;
```

### 2.4 Kiểm tra kết nối

```bash
# Test kết nối với password
mysql -u root -p190705 -e "SHOW DATABASES;"

# Kết quả phải hiển thị database temp_mail
```

### 2.5 Kiểm tra file .env

File `/app/backend/.env` phải có nội dung:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705
DB_NAME=temp_mail
CORS_ORIGINS=http://localhost:3000
```

---

## 3. Chạy ứng dụng

### 3.1 Chạy với Supervisor (Khuyến nghị)

**Kiểm tra supervisor:**

```bash
sudo supervisorctl status
```

**Khởi động services:**

```bash
# Restart tất cả services
sudo supervisorctl restart all

# Hoặc restart từng service
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
```

**Xem logs:**

```bash
# Backend logs
tail -f /var/log/supervisor/backend.out.log
tail -f /var/log/supervisor/backend.err.log

# Frontend logs
tail -f /var/log/supervisor/frontend.out.log
tail -f /var/log/supervisor/frontend.err.log
```

### 3.2 Chạy thủ công (Development)

**Terminal 1 - Backend:**

```bash
cd /app/backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2 - Frontend:**

```bash
cd /app/frontend
yarn start
```

### 3.3 Kiểm tra services đang chạy

```bash
# Kiểm tra backend
curl http://localhost:8001/api/

# Kiểm tra frontend (mở browser)
open http://localhost:3000
```

---

## 4. Sử dụng ứng dụng

### 4.1 Tạo Email mới

1. Mở trình duyệt: http://localhost:3000
2. Ứng dụng sẽ tự động tạo email ngẫu nhiên
3. Hoặc click nút **"Tạo email mới"** để tạo email khác

### 4.2 Chọn dịch vụ Email

- **🎲 Random**: Tự động chọn dịch vụ ngẫu nhiên (Mail.tm, Mail.gw, 1secmail)
- **Mail.tm**: Dịch vụ mail.tm
- **Mail.gw**: Dịch vụ mail.gw  
- **1secmail**: Dịch vụ 1secmail

### 4.3 Quản lý Email

**Làm mới thời gian:**
- Click nút **"Làm mới 10 phút"** để reset timer về 10 phút

**Xóa email:**
- Click nút **"Xóa"** để xóa email hiện tại
- Email sẽ KHÔNG được lưu vào lịch sử

**Lưu email:**
- Click nút **"Lưu"** để lưu email vào mục "Mail đã lưu"

### 4.4 Nhận và đọc Email

1. Email sẽ tự động làm mới mỗi 30 giây
2. Click vào tin nhắn để đọc nội dung
3. Có 2 chế độ xem: **HTML** và **Text**
4. Click **"Lưu email này"** trong chi tiết email để lưu tin nhắn quan trọng

### 4.5 Lịch sử

- Tab **"Lịch sử"**: Xem email đã hết hạn
- Chọn nhiều email và xóa hàng loạt
- Click **"Xóa tất cả"** để xóa toàn bộ lịch sử

### 4.6 Mail đã lưu

- Tab **"Mail đã lưu"**: Xem email/tin nhắn đã lưu
- Click vào email để xem lại nội dung
- Quản lý và xóa email đã lưu

---

## 5. Xử lý lỗi thường gặp

### 5.1 Lỗi: MySQL Connection Failed

**Triệu chứng:**
```
ERROR: Can't connect to MySQL server on '127.0.0.1'
```

**Giải pháp:**

```bash
# 1. Kiểm tra MySQL đang chạy
sudo service mariadb status

# 2. Khởi động MySQL
sudo service mariadb start

# 3. Kiểm tra kết nối
mysql -u root -p190705 -e "SELECT 1;"

# 4. Kiểm tra database tồn tại
mysql -u root -p190705 -e "SHOW DATABASES LIKE 'temp_mail';"

# 5. Tạo lại database nếu cần
mysql -u root -p190705 -e "CREATE DATABASE IF NOT EXISTS temp_mail;"
```

### 5.2 Lỗi: Backend không khởi động

**Triệu chứng:**
```
ModuleNotFoundError: No module named 'fastapi'
```

**Giải pháp:**

```bash
cd /app/backend

# Cài lại tất cả dependencies
pip install -r requirements.txt --force-reinstall

# Hoặc cài từng package bị thiếu
pip install fastapi uvicorn sqlalchemy pymysql python-dotenv httpx
```

### 5.3 Lỗi: Frontend không khởi động

**Triệu chứng:**
```
Error: Cannot find module 'react'
```

**Giải pháp:**

```bash
cd /app/frontend

# Xóa node_modules và cài lại
rm -rf node_modules yarn.lock
yarn install

# Hoặc dùng npm
rm -rf node_modules package-lock.json
npm install
```

### 5.4 Lỗi: CORS Error

**Triệu chứng:**
```
Access to fetch at 'http://localhost:8001/api/' has been blocked by CORS policy
```

**Giải pháp:**

Kiểm tra file `/app/backend/.env`:
```env
CORS_ORIGINS=http://localhost:3000
```

Restart backend:
```bash
sudo supervisorctl restart backend
```

### 5.5 Lỗi: Port đã được sử dụng

**Triệu chứng:**
```
ERROR: Address already in use
```

**Giải pháp:**

```bash
# Tìm process đang dùng port 8001
lsof -i :8001

# Kill process
kill -9 <PID>

# Hoặc dùng fuser
sudo fuser -k 8001/tcp

# Tương tự cho port 3000
sudo fuser -k 3000/tcp
```

### 5.6 Lỗi: Database tables không tồn tại

**Triệu chứng:**
```
Table 'temp_mail.temp_emails' doesn't exist
```

**Giải pháp:**

Tables sẽ được tạo tự động khi backend khởi động. Nếu không, restart backend:

```bash
sudo supervisorctl restart backend

# Hoặc chạy script init database
cd /app/backend
python init_db.py
```

### 5.7 Lỗi: Email providers không khả dụng

**Triệu chứng:**
```
Tất cả dịch vụ email đều không khả dụng
```

**Giải pháp:**

1. Đợi 60 giây (provider cooldown)
2. Thử lại với dịch vụ khác
3. Kiểm tra kết nối internet
4. Check logs: `tail -f /var/log/supervisor/backend.err.log`

---

## 6. Maintenance

### 6.1 Backup Database

```bash
# Backup
mysqldump -u root -p190705 temp_mail > backup_$(date +%Y%m%d).sql

# Restore
mysql -u root -p190705 temp_mail < backup_20240101.sql
```

### 6.2 Xóa dữ liệu cũ

```bash
mysql -u root -p190705 temp_mail -e "DELETE FROM email_history WHERE expired_at < DATE_SUB(NOW(), INTERVAL 7 DAY);"
mysql -u root -p190705 temp_mail -e "DELETE FROM saved_emails WHERE saved_at < DATE_SUB(NOW(), INTERVAL 30 DAY);"
```

### 6.3 Update code

```bash
# Pull code mới
git pull

# Update backend dependencies
cd /app/backend
pip install -r requirements.txt --upgrade

# Update frontend dependencies
cd /app/frontend
yarn upgrade

# Restart services
sudo supervisorctl restart all
```

---

## 7. Tips & Tricks

### 7.1 Chạy backend ở background

```bash
cd /app/backend
nohup uvicorn server:app --host 0.0.0.0 --port 8001 > backend.log 2>&1 &
```

### 7.2 Tăng timeout cho email providers

Sửa file `/app/backend/server.py`, tìm và thay đổi:
```python
RETRY_MAX_ATTEMPTS = 5  # Tăng từ 3 lên 5
PROVIDER_COOLDOWN_SECONDS = 30  # Giảm từ 60 xuống 30
```

### 7.3 Enable debug mode

File `/app/backend/database.py`, dòng 82:
```python
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=True  # Thay False thành True để xem SQL queries
)
```

---

## 8. Liên hệ & Support

Nếu gặp vấn đề không giải quyết được, vui lòng:

1. Kiểm tra logs: `/var/log/supervisor/backend.err.log`
2. Kiểm tra MySQL: `sudo service mariadb status`
3. Restart services: `sudo supervisorctl restart all`
4. Tạo issue trên GitHub

---

**Chúc bạn sử dụng TempMail thành công! 🎉**
