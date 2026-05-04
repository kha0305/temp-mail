# Temp Mail Backend

Backend Node.js đã được tách lại theo cấu trúc module hóa để dễ bảo trì và mở rộng.

## Cấu trúc

```text
src/
├─ app.js
├─ server.js
├─ config/
├─ constants/
├─ middlewares/
├─ models/
├─ providers/
├─ repositories/
├─ routes/
│  ├─ domains/
│  ├─ emails/
│  ├─ history/
│  ├─ root/
│  └─ saved/
├─ services/
├─ sockets/
└─ utils/
```

## Nguyên tắc

- Mỗi model ở một file riêng.
- Mỗi endpoint API ở một file route riêng.
- Route chỉ mỏng, business logic nằm ở service.
- Truy cập DB đi qua repository.
- Provider email dùng chung một registry với interface thống nhất.

## Chạy backend

```bash
npm install
npm run dev
```

## SQL Khởi Tạo Database

Nếu cần tạo DB thủ công trước khi chạy backend:

```bash
mysql -u root -p < ../deployment/sql/create-temp-mail-db.sql
```

Hoặc từ thư mục gốc:

```bash
npm run db:init
```

File SQL sẽ tạo database `temp_mail` cùng các bảng:
- `temp_emails`
- `email_history`
- `saved_emails`

## Environment

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705
DB_NAME=temp_mail
PORT=8001
CORS_ORIGINS=http://localhost:3000
```

## API surface

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
