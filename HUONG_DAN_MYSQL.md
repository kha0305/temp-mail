# Hướng Dẫn Chạy TempMail với MySQL (Local)

## Yêu Cầu Hệ Thống

### 1. MySQL 8.0+
```bash
# Kiểm tra MySQL đã cài chưa
mysql --version

# Khởi động MySQL
# Linux: sudo systemctl start mysql
# Mac: brew services start mysql
# Windows: net start mysql
```

### 2. Python 3.9+
```bash
python --version
# hoặc
python3 --version
```

### 3. Node.js 18+ và Yarn
```bash
node --version
yarn --version

# Cài Yarn nếu chưa có
npm install -g yarn
```

## Cấu Hình Database

### 1. Tạo Database
```bash
mysql -u root -p
```

Trong MySQL console:
```sql
CREATE DATABASE temp_mail;
EXIT;
```

### 2. Cấu hình Backend (.env)
File: `/app/backend/.env`
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705
DB_NAME=temp_mail
CORS_ORIGINS=*
```

**⚠️ Quan trọng:** Thay đổi `DB_PASSWORD` thành password MySQL của bạn!

### 3. Khởi tạo Database
```bash
cd backend
python init_db.py
```

Nếu cần reset database:
```bash
python init_db.py --reset
```

## Cách Chạy Ứng Dụng

### Cách 1: Tự Động (Script)

```bash
# Từ thư mục gốc
./start_app.sh
```

### Cách 2: Thủ Công

#### Terminal 1 - Backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

#### Terminal 2 - Frontend:
```bash
cd frontend
yarn install
PORT=7050 yarn start
```

## Truy Cập Ứng Dụng

- **Frontend**: http://localhost:7050
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs

## Tính Năng

✅ **Tự động tạo email** khi vào trang (không cần click)
✅ **Hết 10 phút** → tự động tạo email mới
✅ **Làm mới 10 phút** - reset về 10 phút (không cộng dồn)
✅ **Lịch sử email** với tính năng chọn và xóa
✅ **Theme sáng/tối** - giao diện hiện đại

## Troubleshooting

### Lỗi: "Can't connect to MySQL server"
- Kiểm tra MySQL đang chạy: `sudo systemctl status mysql`
- Kiểm tra password trong file `.env`
- Kiểm tra port 3306 không bị chiếm: `netstat -an | grep 3306`

### Lỗi: "Table doesn't exist"
- Chạy lại: `python init_db.py`

### Lỗi: "Port 8001 already in use"
- Tìm và kill process: `lsof -ti:8001 | xargs kill -9`
- Hoặc đổi port trong uvicorn command

### Lỗi: "Port 7050 already in use"
- Tìm và kill process: `lsof -ti:7050 | xargs kill -9`
- Hoặc chạy với port khác: `PORT=3000 yarn start`

## Database Schema

### Table: temp_emails
```sql
id              VARCHAR(36) PRIMARY KEY (UUID)
address         VARCHAR(255) UNIQUE
password        VARCHAR(255)
token           TEXT
account_id      VARCHAR(255)
created_at      DATETIME
expires_at      DATETIME
message_count   INT
```

### Table: email_history
```sql
id              VARCHAR(36) PRIMARY KEY (UUID)
address         VARCHAR(255)
password        VARCHAR(255)
token           TEXT
account_id      VARCHAR(255)
created_at      DATETIME
expired_at      DATETIME
message_count   INT
```

## API Endpoints

### Emails
- `POST /api/emails/create` - Tạo email mới
- `GET /api/emails` - Lấy danh sách email
- `GET /api/emails/{id}` - Chi tiết email
- `DELETE /api/emails/{id}` - Xóa email
- `POST /api/emails/{id}/extend-time` - Làm mới 10 phút

### Messages
- `GET /api/emails/{id}/messages` - Lấy tin nhắn
- `POST /api/emails/{id}/refresh` - Làm mới tin nhắn
- `GET /api/emails/{id}/messages/{msg_id}` - Chi tiết tin nhắn

### History
- `GET /api/emails/history/list` - Danh sách lịch sử
- `GET /api/emails/history/{id}/messages` - Tin nhắn từ lịch sử
- `DELETE /api/emails/history/delete` - Xóa lịch sử

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy + PyMySQL
- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Database**: MySQL 8.0+
- **Email Provider**: Mail.tm API

## Ghi Chú

- Background task tự động kiểm tra email hết hạn mỗi 30 giây
- Email hết hạn tự động chuyển vào lịch sử
- Frontend tự động refresh messages mỗi 10 giây
- Timer đếm ngược real-time dựa trên `expires_at`

## Liên Hệ & Hỗ Trợ

Nếu gặp vấn đề, vui lòng kiểm tra:
1. MySQL đang chạy
2. Database đã được tạo
3. File `.env` có cấu hình đúng
4. Đã chạy `init_db.py`
5. Port 8001 và 3000 không bị chiếm
