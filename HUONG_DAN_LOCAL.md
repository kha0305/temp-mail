# 🚀 Hướng Dẫn Chạy TempMail Trên Máy Local

## 📋 Yêu Cầu Hệ Thống

### 1. Python 3.8 trở lên
Kiểm tra version:
```bash
python3 --version
```

Cài đặt (nếu chưa có):
- **Ubuntu/Debian**:
  ```bash
  sudo apt update
  sudo apt install python3 python3-pip python3-venv
  ```
- **macOS**:
  ```bash
  brew install python@3.11
  ```
- **Windows**: Download từ [python.org](https://www.python.org/downloads/)

### 2. Node.js 16 trở lên
Kiểm tra version:
```bash
node --version
```

Cài đặt (nếu chưa có):
- **Ubuntu/Debian**:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt install -y nodejs
  ```
- **macOS**:
  ```bash
  brew install node
  ```
- **Windows**: Download từ [nodejs.org](https://nodejs.org/)

### 3. MySQL 8.0 trở lên

#### Cài đặt MySQL:

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
```

**macOS**:
```bash
brew install mysql
brew services start mysql
```

**Windows**: Download từ [MySQL Installer](https://dev.mysql.com/downloads/installer/)

#### Cấu hình MySQL:
```bash
# Đăng nhập vào MySQL
sudo mysql

# Tạo database và user
CREATE DATABASE tempmail_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tempmail_user'@'localhost' IDENTIFIED BY 'tempmail_password_123';
GRANT ALL PRIVILEGES ON tempmail_db.* TO 'tempmail_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 📥 Bước 1: Download Code

### Từ GitHub (nếu có):
```bash
git clone <repository-url>
cd app
```

### Hoặc giải nén file ZIP:
```bash
unzip app.zip
cd app
```

---

## ⚙️ Bước 2: Cấu Hình

### Backend (.env)
File `/app/backend/.env` đã được tạo sẵn với cấu hình MySQL local:

```env
# Database Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=tempmail_user
MYSQL_PASSWORD=tempmail_password_123
MYSQL_DATABASE=tempmail_db

# TempMail API Configuration
TEMPMAIL_API_URL=https://api.mail.tm
```

**⚠️ Lưu ý**: Nếu bạn sử dụng MySQL password khác, vui lòng cập nhật file này.

### Frontend (.env)
File `/app/frontend/.env` đã được cấu hình:
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

File `/app/frontend/.env.local` đã cấu hình port:
```env
PORT=7050
```

---

## 🚀 Bước 3: Chạy Ứng Dụng

### 🎯 Cách 1: Sử dụng Script Tự Động (KHUYẾN NGHỊ)

```bash
cd /app
bash start_app.sh
```

Menu sẽ hiện ra:
```
╔══════════════════════════════════════════╗
║     TEMPMAIL - LOCAL DEVELOPMENT        ║
╚══════════════════════════════════════════╝

Chọn một tùy chọn:
1) Khởi tạo Database (chỉ chạy lần đầu)
2) Chạy Backend
3) Chạy Frontend
4) Chạy cả Backend + Frontend
5) Thoát

Lựa chọn của bạn:
```

**Lần đầu tiên chạy:**
1. Chọn `1` - Khởi tạo Database
2. Sau đó chọn `4` - Chạy cả Backend + Frontend

**Các lần sau:**
- Chỉ cần chọn `4` để chạy toàn bộ ứng dụng

---

### 🔧 Cách 2: Chạy Thủ Công

#### Backend:
```bash
cd /app/backend

# Tạo virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# hoặc: venv\Scripts\activate  # Windows

# Cài đặt dependencies
pip install -r requirements.txt

# Khởi tạo database (chỉ lần đầu)
python init_db.py

# Chạy server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

#### Frontend (Terminal mới):
```bash
cd /app/frontend

# Cài đặt yarn (nếu chưa có)
npm install -g yarn

# Cài đặt dependencies
yarn install

# Chạy frontend
PORT=7050 yarn start
```

---

## 🌐 Truy Cập Ứng Dụng

Sau khi khởi động thành công:

- **Frontend**: http://localhost:7050
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs

---

## 🎨 Icon Tab

Ứng dụng đã có favicon và logo icons:
- ✅ `favicon.ico` - Icon hiển thị trên tab browser
- ✅ `logo192.png` - Icon cho mobile/PWA
- ✅ `logo512.png` - Icon high-resolution

Icon được tạo từ file `mail-icon.svg` với theme màu tím gradient.

---

## 🔍 Kiểm Tra Kết Nối

### Kiểm tra MySQL:
```bash
mysql -u tempmail_user -p
# Nhập password: tempmail_password_123

USE tempmail_db;
SHOW TABLES;
```

Bạn sẽ thấy table `temp_emails`.

### Kiểm tra Backend:
```bash
curl http://localhost:8001/health
```

Response:
```json
{"status": "healthy"}
```

### Kiểm tra Frontend:
Mở browser và truy cập: http://localhost:7050

---

## 🔧 Troubleshooting

### Lỗi: "Can't connect to MySQL server"
```bash
# Kiểm tra MySQL có đang chạy không
sudo systemctl status mysql  # Linux
brew services list | grep mysql  # macOS

# Restart MySQL nếu cần
sudo systemctl restart mysql  # Linux
brew services restart mysql  # macOS
```

### Lỗi: "Port 8001 already in use"
```bash
# Tìm và kill process đang dùng port 8001
lsof -ti:8001 | xargs kill -9  # Linux/macOS
```

### Lỗi: "Port 7050 already in use"
```bash
# Tìm và kill process đang dùng port 7050
lsof -ti:7050 | xargs kill -9  # Linux/macOS
```

### Lỗi: "Module not found"
```bash
# Backend
cd /app/backend
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd /app/frontend
rm -rf node_modules
yarn install
```

### Reset Database:
```bash
cd /app/backend
source venv/bin/activate
python init_db.py
```

---

## 📊 Database Schema

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

## 🛠️ Development Workflow

### Backup Database:
```bash
mysqldump -u tempmail_user -p tempmail_db > backup.sql
```

### Restore Database:
```bash
mysql -u tempmail_user -p tempmail_db < backup.sql
```

### Xem Logs:
```bash
# Backend logs - tự động in ra console
# Frontend logs - tự động in ra console và browser console
```

---

## 📝 API Endpoints

### Health Check
```bash
GET /health
```

### Generate Temporary Email
```bash
POST /api/generate-email
Response: {
  "email": "random@example.com",
  "password": "generated_password"
}
```

### Get Email List
```bash
GET /api/emails
Response: [
  {
    "id": "uuid",
    "address": "email@example.com",
    "created_at": "2025-01-01T00:00:00",
    "message_count": 0
  }
]
```

### Delete Email
```bash
DELETE /api/emails/{email_id}
Response: {"message": "Email deleted successfully"}
```

### Get Messages for Email
```bash
GET /api/emails/{email_id}/messages
Response: [
  {
    "id": "message_id",
    "subject": "Test",
    "from": "sender@example.com",
    "date": "2025-01-01T00:00:00"
  }
]
```

---

## 💡 Tips

1. **Hot Reload**: 
   - Backend: Tự động reload khi code thay đổi (uvicorn --reload)
   - Frontend: Tự động reload khi code thay đổi (React hot reload)

2. **Multiple Terminals**: 
   - Sử dụng tmux hoặc screen để chạy backend và frontend trong cùng một terminal
   - Hoặc dùng 2 terminal windows riêng biệt

3. **VSCode**: 
   - Cài đặt extension "Python" cho backend debugging
   - Cài đặt extension "ES7+ React" cho frontend development

---

## 🆘 Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra MySQL đang chạy
2. Kiểm tra port 8001 và 7050 không bị chiếm
3. Xem logs để tìm lỗi cụ thể
4. Đảm bảo đã cài đặt đủ dependencies

---

## 🎉 Chúc Bạn Code Vui Vẻ!

Ứng dụng TempMail của bạn đã sẵn sàng chạy trên máy local với:
- ✅ MySQL Database
- ✅ FastAPI Backend (Port 8001)
- ✅ React Frontend (Port 7050)
- ✅ Favicon và Logo Icons
- ✅ Hot Reload cho development
