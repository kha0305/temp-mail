# Tính Năng Tự Động (Auto Features)

## ✅ Đã Triển Khai

### 1. 🔄 Auto-Create Email Khi Timer Về 0

**Vị trí code:** `/app/frontend/src/App.js` (dòng 166-222)

**Cách hoạt động:**
- Timer đếm ngược từ 10 phút (600 giây)
- Khi timer về 0, tự động gọi API `/api/emails/create` để tạo email mới
- Email mới có thời gian 10 phút mới
- Email cũ được move vào History tự động bởi backend
- Sử dụng `useRef` để tránh race condition (không tạo duplicate)

**Log trong console:**
```javascript
⏰ Timer expired, auto-creating new email...
✅ Email mới đã được tạo tự động!
```

**Toast notification:**
- "⏰ Email đã hết hạn, đang tạo email mới tự động..."
- "✅ Email mới đã được tạo tự động! {address} ({provider})"

---

### 2. 🔁 Auto-Refresh Messages Mỗi 30 Giây

**Vị trí code:** `/app/frontend/src/App.js` (dòng 224-243)

**Cách hoạt động:**
- Tự động refresh messages mỗi 30 giây
- Chỉ hoạt động khi có email active (không phải history email)
- Silent mode: không hiển thị toast notification để tránh spam
- Sử dụng `setInterval` với cleanup khi component unmount

**Log trong console:**
```javascript
🔄 Auto-refresh enabled for email: xxx@domain.com
🔄 Auto-refreshing messages...
🛑 Auto-refresh cleanup (khi component unmount)
```

---

### 3. 🤖 Backend Background Task

**Vị trí code:** `/app/backend/background_tasks.py`

**Cách hoạt động:**
- Chạy mỗi 30 giây
- Kiểm tra emails đã hết hạn
- Move expired emails vào History table
- Nếu không còn active email nào, tự động tạo email mới

**Chức năng:**
- `check_expired_emails()`: Check và move expired emails
- `create_new_email_auto()`: Tự động tạo email mới

---

## 🧪 Testing

### Test Auto-Refresh:
```bash
# Chạy app và mở console
# Bạn sẽ thấy log mỗi 30s: "🔄 Auto-refreshing messages..."
```

### Test Auto-Create:
```bash
# Cách 1: Đợi timer về 0 (10 phút)
# Cách 2: Manually expire email bằng cách update database
mysql -u root -p190705 -e "UPDATE temp_mail.temp_emails SET expires_at = NOW()"
# Sau đó reload trang, email mới sẽ được tạo tự động
```

---

## 📊 Flow Diagram

```
User visits app
    ↓
Auto-create initial email (if none exists)
    ↓
Timer starts (10:00 countdown)
    ↓
Every 30s → Auto-refresh messages (silent)
    ↓
Timer reaches 0:00
    ↓
Frontend: Auto-create new email + Reset timer to 10:00
    ↓
Backend: Move old email to History
    ↓
Loop continues...
```

---

## 🔧 Configuration

### Thời gian auto-refresh (thay đổi từ 30s):
```javascript
// File: /app/frontend/src/App.js (line 234)
}, 30000); // 30 seconds → Thay đổi số này (milliseconds)
```

### Thời gian email expiry (thay đổi từ 10 phút):
```python
# File: /app/backend/server.py (line 365)
expires_at = now + timedelta(minutes=10)  # Thay đổi 10 thành số phút khác
```

---

## 🎯 Key Improvements Đã Làm

1. **Fix Race Condition**: Sử dụng `useRef` thay vì local variable
2. **Better Logging**: Thêm console.log để debug dễ dàng
3. **Enhanced UX**: Toast notifications rõ ràng hơn
4. **Silent Auto-Refresh**: Không spam user với toast mỗi 30s

---

## 📝 Notes

- Auto-refresh chỉ chạy khi tab đang active
- Khi switch sang History tab, auto-refresh tự động tắt
- Timer sẽ pause nếu user không active trên tab
- Email provider có thể fallback từ Mail.tm sang 1secmail nếu rate limited
