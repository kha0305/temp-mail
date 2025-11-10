# HƯỚNG DẪN CHẠY ỨNG DỤNG LOCAL VỚI MYSQL

## 🎯 Tổng quan

Ứng dụng TempMail hỗ trợ 2 môi trường:
- **Container (Emergent Cloud)**: Sử dụng MongoDB ✅ (Đang chạy)
- **Local (Máy tính cá nhân)**: Sử dụng MySQL 📝 (Hướng dẫn bên dưới)

---

## 📋 Yêu cầu hệ thống

### 1. MySQL Database
- **Phiên bản**: MySQL 8.0 trở lên
- **Tài khoản**: 
  - Username: `root`
  - Password: `190705`
  - Database: `temp_mail` (sẽ tự động tạo)

### 2. Python
- **Phiên bản**: Python 3.9 hoặc cao hơn
- **Cài đặt**: [python.org/downloads](https://www.python.org/downloads/)

### 3. Node.js & Yarn
- **Node.js**: Phiên bản 18 trở lên
- **Yarn**: Package manager (sẽ hướng dẫn cài đặt)

---

## 🛠️ BƯỚC 1: Cài đặt MySQL

### Windows:
1. Download MySQL Installer từ: https://dev.mysql.com/downloads/installer/
2. Chọn "MySQL Server" và cài đặt
3. Trong quá trình cài đặt:
   - Chọn "Development Machine"
   - Đặt root password: `190705`
   - Bật MySQL Server

### macOS:
```bash
# Cài đặt qua Homebrew
brew install mysql

# Khởi động MySQL
brew services start mysql

# Đặt password cho root
mysql_secure_installation
# Nhập password mới: 190705
```

### Linux (Ubuntu/Debian):
```bash
# Cài đặt MySQL
sudo apt update
sudo apt install mysql-server

# Khởi động MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# Đặt password cho root
sudo mysql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '190705';
FLUSH PRIVILEGES;
EXIT;
```

### Kiểm tra MySQL đã hoạt động:
```bash
mysql -u root -p190705 -e "SELECT VERSION();"
```

---

## 🚀 BƯỚC 2: Chuẩn bị Backend (Python)

### 1. Download code về máy local
Tải toàn bộ folder `/app` từ container về máy của bạn

### 2. Chuyển sang MySQL version
```bash
cd backend

# Backup file hiện tại (MongoDB version)
cp server.py server_mongodb_backup.py

# Chuyển sang MySQL version
cp server_mysql.py server.py

echo "✅ Đã chuyển sang MySQL version"
```

### 3. Tạo Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 4. Cài đặt dependencies
```bash
pip install -r requirements.txt
```

### 5. Cấu hình môi trường (.env)
File `backend/.env` đã được cấu hình sẵn:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705
DB_NAME=temp_mail
CORS_ORIGINS=http://localhost:3000
```

**Lưu ý**: Nếu bạn đổi password MySQL, cập nhật `DB_PASSWORD` trong file `.env`

### 6. Khởi tạo Database
```bash
python init_db.py
```

Kết quả mong đợi:
```
✅ Loaded .env file from: /path/to/backend/.env
✅ DB credentials loaded - User: root, Database: temp_mail
✅ Database 'temp_mail' is ready!
✅ Tất cả tables đã được tạo thành công!
```

### 7. Chạy Backend
```bash
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Kết quả mong đợi:
```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Application startup complete.
✅ Application started with background tasks (MySQL)
```

---

## 🎨 BƯỚC 3: Chuẩn bị Frontend (React)

### 1. Cài đặt Yarn (nếu chưa có)
```bash
# Windows/macOS/Linux
npm install -g yarn

# Kiểm tra
yarn --version
```

### 2. Di chuyển vào thư mục frontend
```bash
cd frontend
```

### 3. Cấu hình backend URL (.env)
Cập nhật file `frontend/.env`:
```env
REACT_APP_BACKEND_URL=http://localhost:8001
PORT=7050
```

**Quan trọng**: Đảm bảo `REACT_APP_BACKEND_URL` trỏ đến `http://localhost:8001` (backend local)

### 4. Cài đặt dependencies
```bash
yarn install
```

### 5. Chạy Frontend
```bash
PORT=7050 yarn start
```

hoặc (nếu đã có PORT trong .env):
```bash
yarn start
```

Kết quả mong đợi:
```
Compiled successfully!

You can now view temp-mail-frontend in the browser.

  Local:            http://localhost:7050
  On Your Network:  http://192.168.x.x:7050
```

---

## 🌐 BƯỚC 4: Truy cập ứng dụng

Mở trình duyệt và truy cập:
```
http://localhost:7050
```

Ứng dụng sẽ tự động:
1. ✅ Tạo email mới (không cần click nút)
2. ✅ Hiển thị timer đếm ngược 10 phút
3. ✅ Tự động refresh tin nhắn
4. ✅ Khi hết hạn → tự động tạo email mới

---

## 🔧 Troubleshooting (Xử lý lỗi)

### Lỗi 1: MySQL Connection Failed
```
❌ Can't connect to MySQL server on 'localhost'
```

**Giải pháp**:
1. Kiểm tra MySQL đang chạy:
   ```bash
   # Windows
   net start mysql
   
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status mysql
   ```

2. Kiểm tra password:
   ```bash
   mysql -u root -p190705
   ```

3. Kiểm tra file `.env` có đúng password không

### Lỗi 2: Port 8001 đã được sử dụng
```
❌ Address already in use: ('0.0.0.0', 8001)
```

**Giải pháp**:
```bash
# Windows
netstat -ano | findstr :8001
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:8001 | xargs kill -9
```

### Lỗi 3: Frontend không kết nối được Backend
```
❌ Network Error / CORS Error
```

**Giải pháp**:
1. Kiểm tra backend đang chạy: http://localhost:8001/api/
2. Kiểm tra `frontend/.env`:
   ```env
   REACT_APP_BACKEND_URL=http://localhost:8001
   ```
3. Restart frontend:
   ```bash
   # Ctrl+C để dừng
   yarn start
   ```

### Lỗi 4: Invalid Date hiển thị
```
Ngày: Invalid Date
```

**Giải pháp**: Đảm bảo backend trả về `created_at` và `expires_at` ở định dạng ISO 8601:
```json
{
  "created_at": "2025-11-10T11:35:51.587482+00:00",
  "expires_at": "2025-11-10T11:45:51.587482+00:00"
}
```

Nếu vẫn lỗi, check models.py có đúng timezone.utc không.

---

## 📊 Kiểm tra Database

### Kết nối MySQL
```bash
mysql -u root -p190705
```

### Xem tables
```sql
USE temp_mail;
SHOW TABLES;
```

Kết quả:
```
+---------------------+
| Tables_in_temp_mail |
+---------------------+
| email_history       |
| saved_emails        |
| temp_emails         |
+---------------------+
```

### Xem dữ liệu
```sql
SELECT * FROM temp_emails;
SELECT * FROM email_history;
SELECT * FROM saved_emails;
```

---

## 🎯 Tính năng chính

### 1. Tự động tạo email
- Khi vào trang lần đầu → tự động tạo email
- Khi email hết hạn (10 phút) → tự động tạo email mới

### 2. Timer đếm ngược
- Hiển thị thời gian còn lại: `9:45`, `8:30`, ...
- Khi về `0:00` → email hết hạn, chuyển vào lịch sử

### 3. Làm mới thời gian
- Click nút "Làm mới 10 phút"
- Timer reset về 10:00 (không cộng dồn)

### 4. Lịch sử email
- Tab "Lịch sử (N)"
- Xem email đã hết hạn
- Chọn và xóa email cũ
- Xóa tất cả lịch sử

### 5. Lưu email quan trọng
- Click vào tin nhắn
- Nút "Lưu" để bookmark
- Tab "Mail đã lưu" để xem lại

---

## 📝 API Documentation

Backend API: http://localhost:8001/docs (Swagger UI)

### Endpoints chính:
- `POST /api/emails/create` - Tạo email mới
- `GET /api/emails` - Lấy danh sách email
- `POST /api/emails/{id}/extend-time` - Làm mới thời gian
- `GET /api/emails/history/list` - Lịch sử email
- `DELETE /api/emails/history/delete` - Xóa lịch sử

---

## 🔄 So sánh Container vs Local

| Tính năng | Container (Cloud) | Local (Máy bạn) |
|-----------|------------------|-----------------|
| Database | MongoDB | MySQL |
| Backend URL | https://service-repair.preview.emergentagent.com | http://localhost:8001 |
| Frontend URL | https://service-repair.preview.emergentagent.com | http://localhost:7050 |
| Cài đặt | Không cần | Cần cài MySQL, Python, Node.js |
| Tốc độ | Phụ thuộc mạng | Nhanh (localhost) |
| Dữ liệu | Tạm thời | Lưu trên máy bạn |

---

## 💡 Tips & Best Practices

### 1. Backup Database
```bash
# Export database
mysqldump -u root -p190705 temp_mail > temp_mail_backup.sql

# Import database
mysql -u root -p190705 temp_mail < temp_mail_backup.sql
```

### 2. Reset Database (xóa tất cả dữ liệu)
```bash
cd backend
python init_db.py --reset
# Nhập 'yes' để xác nhận
```

### 3. Chạy cả 2 terminal cùng lúc
**Terminal 1 (Backend)**:
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python -m uvicorn server:app --reload
```

**Terminal 2 (Frontend)**:
```bash
cd frontend
yarn start
```

### 4. Development Mode
Backend có auto-reload (`--reload`) nên khi sửa code Python, server tự động restart.

Frontend cũng có hot-reload, sửa React code sẽ tự động cập nhật trình duyệt.

---

## 🆘 Liên hệ hỗ trợ

Nếu gặp vấn đề:
1. Check logs trong terminal
2. Check MySQL có chạy không: `mysql -u root -p190705`
3. Check backend API: http://localhost:8001/api/
4. Check console log trong trình duyệt (F12 → Console)

---

## ✅ Checklist hoàn thành

- [ ] MySQL đã cài đặt và chạy
- [ ] Backend đã chuyển sang MySQL version (`server.py`)
- [ ] Virtual environment đã tạo
- [ ] Dependencies đã cài (`pip install -r requirements.txt`)
- [ ] Database đã khởi tạo (`python init_db.py`)
- [ ] Backend đang chạy (http://localhost:8001/api/)
- [ ] Frontend `.env` đã cập nhật `REACT_APP_BACKEND_URL`
- [ ] Yarn dependencies đã cài (`yarn install`)
- [ ] Frontend đang chạy (http://localhost:7050)
- [ ] Ứng dụng hoạt động: tạo email, nhận tin nhắn

---

**🎉 Chúc bạn sử dụng TempMail thành công!**
