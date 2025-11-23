# Hướng dẫn Deploy lên Vercel với Aiven MySQL

Bạn đã chọn **Aiven Console** cho Database và **Vercel** cho Web. Đây là sự kết hợp tuyệt vời.

## Phần 1: Lấy thông tin Database từ Aiven

1.  Đăng nhập vào [Aiven Console](https://console.aiven.io/).
2.  Tạo mới dịch vụ (Create Service) -> Chọn **MySQL** -> Chọn Cloud (ví dụ Google Cloud) -> Chọn gói **Free** (Hobbyist).
3.  Đợi một chút để service chạy (Running).
4.  Bấm vào tên service vừa tạo, bạn sẽ thấy thông tin kết nối (Connection information). Hãy copy các thông tin sau:
    - **Host**: (ví dụ: `mysql-2b3c4d5e-user.aivencloud.com`)
    - **Port**: (ví dụ: `20892`)
    - **User**: (thường là `avnadmin`)
    - **Password**: (Bấm nút Copy để lấy mật khẩu)
    - **Database Name**: `defaultdb` (hoặc tên bạn đặt)

## Phần 2: Deploy Backend lên Vercel

1.  **Đẩy code lên GitHub**:

    - Tạo repo mới trên GitHub.
    - Upload toàn bộ code hiện tại lên đó.

2.  **Tạo Project Backend trên Vercel**:

    - Vào [Vercel Dashboard](https://vercel.com/dashboard).
    - Bấm **Add New...** -> **Project**.
    - Chọn repo GitHub bạn vừa đẩy lên.
    - Ở mục **Root Directory**, bấm `Edit` và chọn thư mục `backend`.

3.  **Cấu hình Biến môi trường (Environment Variables)**:

    - Mở mục **Environment Variables** và thêm các biến sau (dùng thông tin từ Aiven):
      - `DB_HOST`: (Dán Host từ Aiven)
      - `DB_PORT`: (Dán Port từ Aiven)
      - `DB_USER`: (Dán User từ Aiven)
      - `DB_PASSWORD`: (Dán Password từ Aiven)
      - `DB_NAME`: `defaultdb`
      - `CORS_ORIGINS`: `*`

4.  **Deploy**:
    - Bấm nút **Deploy**.
    - Đợi một chút, nếu thành công màn hình sẽ bắn pháo hoa.
    - Bấm vào **Continue to Dashboard**, copy cái **Domain** của backend (ví dụ: `temp-mail-backend.vercel.app`).

## Phần 3: Deploy Frontend lên Vercel

1.  **Tạo Project Frontend trên Vercel**:

    - Quay lại Dashboard, bấm **Add New...** -> **Project**.
    - Vẫn chọn repo cũ.
    - Nhưng lần này ở **Root Directory**, bấm `Edit` và chọn thư mục `frontend`.

2.  **Cấu hình Biến môi trường**:

    - Thêm biến sau:
      - `REACT_APP_BACKEND_URL`: `https://temp-mail-backend.vercel.app` (Thay bằng link backend bạn vừa copy ở trên, **lưu ý không có dấu / ở cuối**).

3.  **Deploy**:
    - Bấm nút **Deploy**.
    - Sau khi xong, bạn sẽ có link frontend (ví dụ: `temp-mail-frontend.vercel.app`).

## Phần 4: Kiểm tra

Truy cập vào link Frontend. Nếu thấy web hiện lên và không báo lỗi kết nối, thử tạo email mới xem có được không.

---

**Lưu ý:** Code backend đã được cập nhật để hỗ trợ SSL cho Aiven. Bạn không cần sửa gì thêm.
