# Hướng dẫn Deploy lên VPS (Ubuntu/Linux)

Dự án này gồm 2 phần: **Node.js Backend** và **React Frontend**.

## 1. Chuẩn bị Server (VPS)

Cài đặt các phần mềm cần thiết:

```bash
sudo apt update
sudo apt install nodejs npm nginx mysql-server git
sudo npm install -g pm2
```

## 2. Cài đặt Database (MySQL)

1. Đăng nhập MySQL: `sudo mysql`
2. Tạo database và user:

```sql
CREATE DATABASE temp_mail;
CREATE USER 'temp_mail_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON temp_mail.* TO 'temp_mail_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

3. Import dữ liệu từ máy local (nếu có) hoặc để Backend tự tạo bảng khi chạy lần đầu.

## 3. Setup Backend

1. Upload thư mục `backend` lên server (ví dụ: `/var/www/temp-mail/backend`).
2. Vào thư mục và cài đặt:

```bash
cd /var/www/temp-mail/backend
npm install
```

3. Tạo file `.env` với thông tin database thật:

```env
DB_HOST=localhost
DB_USER=temp_mail_user
DB_PASSWORD=your_password
DB_NAME=temp_mail
PORT=8001
```

4. Chạy Backend bằng PM2:

```bash
pm2 start src/server.js --name "temp-mail-api"
pm2 save
pm2 startup
```

## 4. Setup Frontend

1. Trên máy local, tạo file `frontend/.env.production`:

```env
REACT_APP_BACKEND_URL=http://your-domain.com
```

_(Thay your-domain.com bằng IP hoặc tên miền của bạn)_

2. Build ra file tĩnh:

```bash
cd frontend
npm run build
```

3. Upload toàn bộ nội dung trong thư mục `frontend/build` lên server (ví dụ: `/var/www/temp-mail/frontend`).

## 5. Cấu hình Nginx

1. Copy file `deployment/nginx.conf` vào `/etc/nginx/sites-available/temp-mail`.
2. Sửa `server_name` thành domain của bạn.
3. Kích hoạt site:

```bash
sudo ln -s /etc/nginx/sites-available/temp-mail /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Nếu dùng Shared Hosting (cPanel)

1. **Frontend**: Upload nội dung thư mục `build` vào `public_html`.
2. **Backend**:
   - Tìm mục **"Setup Node.js App"** trong cPanel.
   - Tạo app mới, chọn đường dẫn đến thư mục backend.
   - Upload code backend.
   - Chạy `npm install` từ giao diện cPanel.
   - **Lưu ý**: Bạn có thể cần sửa file `.htaccess` để điều hướng các request `/api` vào port của Node.js app.
