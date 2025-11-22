# Hướng dẫn Deploy lên Vercel (Frontend + Backend)

Vì bạn đã có **Domain** và **Vercel**, đây là cách tối ưu nhất để tận dụng chúng.

⚠️ **Lưu ý quan trọng trước khi làm:**

1.  **Database**: Vercel **không** chứa Database. Bạn **bắt buộc** phải có một MySQL Database online (Cloud).
    - _Gợi ý miễn phí/rẻ_: Aiven, Railway, PlanetScale, hoặc TiDB Cloud.
    - _Không thể_ dùng `localhost` hay XAMPP trên máy tính của bạn được nữa.
2.  **Backend trên Vercel**: Vercel chạy theo dạng Serverless, nên tính năng "tự động dọn dẹp email hết hạn" (Background Task) sẽ **không hoạt động ổn định** như trên VPS. Tuy nhiên, các tính năng chính (tạo mail, nhận mail) vẫn hoạt động tốt.

---

## Bước 1: Chuẩn bị Database (Bắt buộc)

1.  Đăng ký một MySQL Database miễn phí trên mạng (ví dụ: [Aiven Console](https://console.aiven.io/)).
2.  Lấy các thông tin: `Host`, `Port`, `User`, `Password`, `Database Name`.
3.  Dùng tool ở máy (như HeidiSQL, DBeaver) kết nối vào Cloud Database đó và import cấu trúc bảng của bạn vào.

## Bước 2: Deploy Backend lên Vercel

1.  Đẩy code thư mục `backend` lên GitHub (hoặc GitLab/Bitbucket).
2.  Vào Vercel Dashboard -> **Add New Project** -> Chọn repo bạn vừa đẩy.
3.  Ở phần **Root Directory**, chọn `backend` (nếu bạn để cả project chung 1 repo).
4.  Ở phần **Environment Variables**, điền thông tin Cloud Database của bạn:
    - `DB_HOST`: (Host của cloud db)
    - `DB_PORT`: (Port của cloud db)
    - `DB_USER`: (User của cloud db)
    - `DB_PASSWORD`: (Pass của cloud db)
    - `DB_NAME`: (Tên db)
    - `CORS_ORIGINS`: `*` (hoặc domain frontend của bạn sau này)
5.  Bấm **Deploy**.
6.  Sau khi xong, Vercel sẽ cấp cho bạn 1 domain (ví dụ: `temp-mail-backend.vercel.app`). Hãy copy link này.

## Bước 3: Deploy Frontend lên Vercel

1.  Đẩy code thư mục `frontend` lên GitHub.
2.  Vào Vercel Dashboard -> **Add New Project** -> Chọn repo chứa frontend.
3.  Ở phần **Root Directory**, chọn `frontend`.
4.  Ở phần **Environment Variables**, thêm biến môi trường để trỏ về Backend:
    - Tên: `REACT_APP_BACKEND_URL`
    - Giá trị: `https://temp-mail-backend.vercel.app` (Link backend bạn vừa có ở Bước 2, **không** có dấu `/` ở cuối).
5.  Bấm **Deploy**.
6.  Vercel sẽ cấp domain cho frontend (ví dụ: `temp-mail-frontend.vercel.app`).

## Bước 4: Trỏ Domain riêng (Của bạn)

1.  Vào Project Frontend trên Vercel -> **Settings** -> **Domains**.
2.  Nhập domain của bạn vào (ví dụ: `mail.cuaban.com`).
3.  Vercel sẽ hướng dẫn bạn vào trang quản lý tên miền (nơi bạn mua domain) để thêm bản ghi **CNAME** hoặc **A Record**.
    - Thường là thêm CNAME trỏ về `cname.vercel-dns.com`.
4.  Đợi một chút để cập nhật DNS là xong.

---

## 💡 Mẹo nhỏ (Nếu Backend bị lỗi trên Vercel)

Do code hiện tại dùng `app.listen` (dành cho VPS), đôi khi Vercel Serverless sẽ báo lỗi Timeout.
Nếu bạn gặp lỗi này, bạn cần sửa nhẹ file `backend/src/server.js`:

- Thêm dòng `module.exports = app;` vào cuối file.
- Đây là thay đổi nhỏ để Vercel hiểu được ứng dụng của bạn.
