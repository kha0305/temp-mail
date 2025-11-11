# ✅ CHECKLIST - CHẠY TEMPMAIL LOCAL

## 📋 TRƯỚC KHI BẮT ĐẦU

### Yêu cầu hệ thống:
- [ ] **MySQL 8.0+** đã cài đặt
- [ ] **Python 3.9+** đã cài đặt  
- [ ] **Node.js 18+** đã cài đặt
- [ ] **Yarn** đã cài đặt
- [ ] Port **8001** chưa bị chiếm
- [ ] Port **7050** chưa bị chiếm

---

## 🗄️ SETUP MYSQL

- [ ] MySQL đang chạy: `sudo systemctl status mysql`
- [ ] Kết nối được: `mysql -u root -p190705 -e "SELECT 1;"`
- [ ] Database tạo thành công: `mysql -u root -p190705 -e "USE temp_mail;"`
- [ ] Tables đã khởi tạo: `cd backend && python init_db.py`

**Commands:**
```bash
# Khởi động MySQL
sudo systemctl start mysql

# Tạo database
mysql -u root -p190705 -e "CREATE DATABASE IF NOT EXISTS temp_mail CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Khởi tạo tables
cd /app/backend
python init_db.py
```

---

## 🔧 SETUP BACKEND

- [ ] Virtual environment đã tạo: `ls backend/venv`
- [ ] Virtual environment đã activate: `source backend/venv/bin/activate`
- [ ] Dependencies đã cài: `pip list | grep fastapi`
- [ ] File `.env` đúng config MySQL
- [ ] Backend chạy được: `python -m uvicorn server:app --host 0.0.0.0 --port 8001`

**Commands:**
```bash
cd /app/backend

# Tạo venv
python -m venv venv

# Activate
source venv/bin/activate  # Linux/Mac
# HOẶC
venv\Scripts\activate     # Windows

# Cài dependencies
pip install -r requirements.txt

# Kiểm tra .env
cat .env
# Phải có:
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=190705
# DB_NAME=temp_mail
```

---

## 💻 SETUP FRONTEND

- [ ] Node modules đã cài: `ls frontend/node_modules`
- [ ] Craco đã cài: `ls frontend/node_modules/@craco`
- [ ] File `.env` có `REACT_APP_BACKEND_URL=http://localhost:8001`
- [ ] Yarn có thể chạy: `yarn --version`
- [ ] Frontend compile được: `PORT=7050 yarn start`

**Commands:**
```bash
cd /app/frontend

# Cài dependencies
yarn install

# Cài craco nếu thiếu
yarn add --dev @craco/craco

# Kiểm tra .env
cat .env
# Phải có:
# REACT_APP_BACKEND_URL=http://localhost:8001
# PORT=7050
```

---

## 🚀 KHỞI ĐỘNG

### Option 1: Tự động (Khuyên dùng)
- [ ] Script có quyền execute: `chmod +x start_local.sh`
- [ ] Chạy script: `./start_local.sh`
- [ ] Backend terminal mở
- [ ] Frontend terminal mở
- [ ] Browser tự động mở http://localhost:7050

### Option 2: Thủ công

**Terminal 1 - Backend:**
- [ ] `cd /app/backend`
- [ ] `source venv/bin/activate`
- [ ] `python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload`
- [ ] Thấy: "Uvicorn running on http://0.0.0.0:8001"
- [ ] Thấy: "Database connected successfully"
- [ ] Thấy: "Background tasks started"

**Terminal 2 - Frontend:**
- [ ] `cd /app/frontend`
- [ ] `PORT=7050 yarn start`
- [ ] Thấy: "Compiled successfully!"
- [ ] Thấy: "Local: http://localhost:7050"

---

## ✨ KIỂM TRA TÍNH NĂNG

### Khi vào http://localhost:7050

- [ ] **Auto-create email:** Email tự động tạo ngay khi vào trang
- [ ] **Timer:** Hiển thị đếm ngược từ 10:00 → 9:59 → 9:58...
- [ ] **Email address:** Hiển thị địa chỉ email (vd: abc123@mail.tm)
- [ ] **Copy button:** Click copy email thành công
- [ ] **Refresh button:** Click làm mới messages
- [ ] **Service dropdown:** Chọn được Mail.tm, Mail.gw, Guerrilla
- [ ] **Domain dropdown:** Hiển thị danh sách domain

### Tab "Email hiện tại"
- [ ] Hiển thị email đang active
- [ ] Timer đếm ngược chính xác
- [ ] Nút "Làm mới 10 phút" hoạt động (reset về 10:00)
- [ ] Messages tự động refresh mỗi 5 giây
- [ ] Click vào message để xem chi tiết

### Tab "Lịch sử"
- [ ] Hiển thị danh sách email đã hết hạn
- [ ] Checkbox chọn email
- [ ] Nút "Xóa đã chọn" hoạt động
- [ ] Nút "Xóa tất cả" hoạt động
- [ ] Click email để xem messages cũ

### Tab "Mail đã lưu"
- [ ] Hiển thị email đã save
- [ ] Click để xem chi tiết
- [ ] Xóa email đã lưu

---

## 🔍 KIỂM TRA API

Mở http://localhost:8001/docs

- [ ] Swagger UI hiển thị
- [ ] Test endpoint GET `/api/emails`
- [ ] Test endpoint POST `/api/emails/create`
- [ ] Response có `expires_at` field

---

## 🎯 AUTO FEATURES (QUAN TRỌNG)

### 1. Auto-create on first visit
```
✅ Vào trang lần đầu → Email tự động tạo
   Không cần click nút "Tạo Email Mới"
```

### 2. Timer countdown
```
✅ Hiển thị: 10:00, 9:59, 9:58, ..., 0:10, 0:09, ..., 0:00
   Update mỗi giây
```

### 3. Auto-create on expiry
```
✅ Timer về 0:00 → Email cũ vào lịch sử → Email mới tự động tạo
   Timer reset về 10:00
```

### 4. Extend time (Reset)
```
✅ Click "Làm mới 10 phút" → Timer = 10:00
   VÍ DỤ: Timer còn 3:25 → Click → Timer = 10:00 (KHÔNG phải 13:25)
```

### 5. Background task
```
✅ Backend tự động check mỗi 30 giây
   Chuyển email hết hạn vào history
```

---

## ❌ TROUBLESHOOTING

### Backend không chạy

**Lỗi: "Can't connect to MySQL"**
```bash
# Kiểm tra MySQL
sudo systemctl status mysql
sudo systemctl start mysql

# Test connection
mysql -u root -p190705 -e "SELECT 1;"

# Kiểm tra database
mysql -u root -p190705 -e "SHOW DATABASES;"
```

**Lỗi: "Port 8001 already in use"**
```bash
# Tìm process
lsof -i :8001

# Kill process
kill -9 <PID>
```

**Lỗi: "ModuleNotFoundError"**
```bash
cd /app/backend
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend không chạy

**Lỗi: "craco: command not found"**
```bash
cd /app/frontend
yarn add --dev @craco/craco
yarn install
```

**Lỗi: "Port 7050 already in use"**
```bash
lsof -i :7050
kill -9 <PID>
```

**Lỗi: "yarn: command not found"**
```bash
npm install -g yarn
```

### App không tạo được email

**Browser console có lỗi CORS**
- [ ] Check backend đang chạy: http://localhost:8001/docs
- [ ] Check frontend .env: `REACT_APP_BACKEND_URL=http://localhost:8001`
- [ ] Restart frontend sau khi sửa .env

**"All providers failed"**
- [ ] Đợi 1-2 phút (rate limit)
- [ ] Thử provider khác từ dropdown
- [ ] Check backend logs có lỗi không

**Timer không đếm ngược**
- [ ] Check browser console có lỗi không
- [ ] Check email có field `expires_at` không (F12 → Network → /api/emails)
- [ ] Restart frontend

---

## 📊 LOGS

### Backend logs
```bash
# Xem logs real-time
tail -f /var/log/supervisor/backend.*.log

# Hoặc nếu chạy terminal
# Logs hiển thị trực tiếp trong terminal
```

### Frontend logs
```bash
# Trong browser: F12 → Console
# Hoặc trong terminal khi chạy yarn start
```

---

## ✅ CHECKLIST HOÀN THÀNH

Khi tất cả đều OK:

- [ ] MySQL running ✓
- [ ] Database created ✓
- [ ] Backend running on 8001 ✓
- [ ] Frontend running on 7050 ✓
- [ ] Browser mở http://localhost:7050 ✓
- [ ] Email tự động tạo ✓
- [ ] Timer đếm ngược ✓
- [ ] Tất cả tabs hoạt động ✓
- [ ] Không có lỗi trong console ✓

**🎉 DONE! App đang chạy hoàn hảo!**

---

## 📞 NẾU VẪN CÓ VẤN ĐỀ

1. **Đọc file:** `HUONG_DAN_CHAY_LOCAL.md` (chi tiết đầy đủ)
2. **Đọc file:** `FIX_SUMMARY.md` (giải thích vấn đề cũ)
3. **Check logs:** Backend và Frontend terminal
4. **Test API:** http://localhost:8001/docs
5. **Browser console:** F12 để xem lỗi JavaScript

**Các file hỗ trợ:**
- `HUONG_DAN_CHAY_LOCAL.md` - Hướng dẫn chi tiết
- `README_LOCAL.md` - Quick start
- `FIX_SUMMARY.md` - Vấn đề và giải pháp
- `start_local.sh` - Script tự động
- `CHECKLIST.md` - File này

**Good luck! 🚀**
