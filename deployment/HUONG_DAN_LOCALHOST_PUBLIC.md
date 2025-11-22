# Hướng dẫn Public Localhost ra Internet (Cloudflare Tunnel)

Cách này giúp bạn chạy web trên máy tính cá nhân nhưng người khác vẫn truy cập được qua domain thật (ví dụ: `mail.domaincuaban.com`).

## Ưu điểm

- Không cần thuê VPS hay Hosting.
- Không cần mở port modem (NAT Port) -> An toàn hơn.
- Miễn phí và có HTTPS (ổ khóa bảo mật) luôn.

## Nhược điểm

- Máy tính của bạn phải **luôn bật** và **kết nối mạng**. Tắt máy là web sập.

---

## Bước 1: Chuẩn bị

1.  Một tên miền (Domain) đã mua.
2.  Tài khoản [Cloudflare](https://dash.cloudflare.com/sign-up) (Miễn phí).
3.  Chuyển DNS của tên miền về Cloudflare (nếu chưa làm).

## Bước 2: Cài đặt Cloudflare Tunnel (Trên máy tính của bạn)

1.  Vào trang [Zero Trust](https://one.dash.cloudflare.com/) của Cloudflare.
2.  Chọn **Networks** -> **Tunnels** -> **Create a Tunnel**.
3.  Đặt tên bất kỳ (ví dụ: `temp-mail-local`) -> Save.
4.  Chọn hệ điều hành **Windows**.
5.  Nó sẽ hiện ra một đoạn lệnh cài đặt. Copy đoạn đó.
6.  Mở **PowerShell** (chạy quyền Administrator) trên máy tính, dán lệnh đó vào và Enter.
    - _Lúc này máy bạn đã kết nối an toàn với Cloudflare._

## Bước 3: Cấu hình Domain (Public Hostname)

Sau khi cài xong ở Bước 2, bấm **Next** trên web Cloudflare để sang phần **Public Hostnames**.

Bạn cần thêm 2 đường dẫn (1 cho Frontend, 1 cho Backend):

### 1. Cấu hình cho Frontend (Giao diện)

- **Subdomain**: `mail` (hoặc để trống nếu muốn dùng domain chính).
- **Domain**: Chọn domain của bạn.
- **Service**:
  - Type: `HTTP`
  - URL: `localhost:3000` (Port mặc định của React)

### 2. Cấu hình cho Backend (API)

- **Subdomain**: `api` (ví dụ: `api.domaincuaban.com`).
- **Domain**: Chọn domain của bạn.
- **Service**:
  - Type: `HTTP`
  - URL: `localhost:8001` (Port của Node.js backend)

> **Lưu ý quan trọng**: Bạn phải sửa lại file `.env` trong code Frontend để trỏ về domain API mới này, chứ không dùng `localhost:8001` nữa.
>
> - Mở `frontend/.env` (hoặc `.env.local`)
> - Sửa: `REACT_APP_BACKEND_URL=https://api.domaincuaban.com`
> - **Khởi động lại Frontend** (`Ctrl+C` rồi `npm start` lại).

## Bước 4: Hoàn tất

Bây giờ bạn có thể gửi link `https://mail.domaincuaban.com` cho bạn bè.

- Họ sẽ truy cập vào máy tính của bạn thông qua đường hầm Cloudflare.
- Nhớ giữ máy tính và 2 cửa sổ dòng lệnh (Backend & Frontend) luôn chạy nhé!
