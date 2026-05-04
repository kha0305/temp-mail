# Temp Mail

Ứng dụng temp mail full-stack với frontend React và backend Node.js/Express + MySQL.

## Stack hiện tại

- Backend: Node.js, Express, Sequelize, Socket.IO
- Frontend: React, Tailwind CSS, shadcn/ui
- Database: MySQL/MariaDB

## Chức năng chính

- Tạo email tạm thời 10 phút
- Tự động failover qua nhiều provider
- Xem inbox và chi tiết email
- Gia hạn thời gian email
- Lưu message hoặc lưu mailbox snapshot
- Lịch sử email hết hạn
- Socket polling cho cập nhật inbox theo thời gian thực

## Cấu trúc dự án

```text
temp-mail/
├─ backend/
│  ├─ src/
│  │  ├─ app.js
│  │  ├─ server.js
│  │  ├─ config/
│  │  ├─ constants/
│  │  ├─ middlewares/
│  │  ├─ models/
│  │  ├─ providers/
│  │  ├─ repositories/
│  │  ├─ routes/
│  │  ├─ services/
│  │  ├─ sockets/
│  │  └─ utils/
│  └─ package.json
├─ frontend/
├─ deployment/
```

## Cài đặt

### Một Lệnh Cho Toàn Bộ Dự Án

Từ thư mục gốc của dự án, chỉ cần:

```bash
npm install
npm run install:all
npm run db:init
npm run dev
```

Lệnh `npm run dev` sẽ chạy đồng thời:
- backend tại `http://localhost:8001`
- frontend tại `http://localhost:3000`

### SQL Khởi Tạo Database

Nếu MySQL user của bạn không có quyền tự tạo database từ backend, chạy file SQL này trước:

Hoặc dùng trực tiếp từ root:

```bash
npm run db:init
```

Lệnh này sẽ:
- đọc cấu hình DB từ `backend/.env`
- tự apply file SQL `deployment/sql/create-temp-mail-db.sql`
- tạo database và các bảng cần thiết

Nếu vẫn muốn chạy thủ công bằng MySQL CLI:

```bash
mysql -u root -p < deployment/sql/create-temp-mail-db.sql
```

File SQL:

[`deployment/sql/create-temp-mail-db.sql`](D:/tool/temp-mail/deployment/sql/create-temp-mail-db.sql)

File này sẽ tạo:
- database `temp_mail`
- table `temp_emails`
- table `email_history`
- table `saved_emails`
- các index/unique key cơ bản

### Backend

```bash
cd backend
npm install
```

Tạo `.env` trong `backend/`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705
DB_NAME=temp_mail
PORT=8001
CORS_ORIGINS=http://localhost:3000
```

### Frontend

```bash
cd frontend
yarn install
```

Tạo `.env` trong `frontend/`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

## Chạy dự án

### Chạy Nhanh Từ Root

```bash
npm run dev
```

### Backend

```bash
cd backend
npm run dev
```

### Frontend

```bash
cd frontend
yarn start
```

## API hiện tại

- `GET /api/`
- `POST /api/emails/create`
- `GET /api/emails`
- `GET /api/emails/:id`
- `GET /api/emails/:id/messages`
- `POST /api/emails/:id/refresh`
- `GET /api/emails/:id/messages/:messageId`
- `POST /api/emails/:id/extend-time`
- `DELETE /api/emails/:id`
- `POST /api/emails/:id/messages/:messageId/save`
- `POST /api/emails/:id/save`
- `GET /api/emails/history/list`
- `GET /api/emails/history/:id/messages`
- `GET /api/emails/history/:id/messages/:messageId`
- `DELETE /api/emails/history/delete`
- `GET /api/emails/saved/list`
- `GET /api/emails/saved/:id`
- `DELETE /api/emails/saved/delete`
- `GET /api/domains`

## Ghi chú

- Backend đã được refactor sang cấu trúc module hóa; mỗi endpoint nằm trong một file route riêng.
