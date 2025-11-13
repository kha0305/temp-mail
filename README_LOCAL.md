# 🚀 TempMail - Chạy Trên Máy Local

## ⚡ CHẠY NHANH (3 BƯỚC)

### Bước 1: Cài đặt yêu cầu
```bash
# MySQL
sudo apt install mysql-server
mysql -u root -p  # Set password: 190705

# Python 3.9+
sudo apt install python3 python3-pip python3-venv

# Node.js 18+ và Yarn
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g yarn
```

### Bước 2: Tạo database
```bash
mysql -u root -p190705
CREATE DATABASE temp_mail CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;

cd backend
python init_db.py
```

### Bước 3: Chạy app
```bash
# Cách 1: Tự động (khuyên dùng)
./start_local.sh

# Cách 2: Thủ công
# Terminal 1 - Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 - Frontend
cd frontend
yarn install
PORT=7050 yarn start
```

**Xong! Mở trình duyệt:** http://localhost:7050

---

## ✨ TÍNH NĂNG TỰ ĐỘNG

✅ **Email tự động tạo** khi vào trang lần đầu
✅ **Timer 10 phút** đếm ngược thời gian thực
✅ **Tự động tạo email mới** khi hết 10 phút
✅ **Email cũ tự động** chuyển vào lịch sử
✅ **Làm mới 10 phút**: Reset timer về 10:00 (không cộng dồn)

---

## 📖 TÀI LIỆU CHI TIẾT

Xem file `HUONG_DAN_CHAY_LOCAL.md` để biết:
- Hướng dẫn chi tiết từng bước
- Cách khắc phục lỗi
- Database schema
- Tips sử dụng

---

## 🔧 CONFIGURATION

### Backend (.env)
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705
DB_NAME=temp_mail
CORS_ORIGINS=http://localhost:3000
```

### Frontend (.env)
```env
REACT_APP_BACKEND_URL=http://localhost:8001
PORT=7050
```

---

## ❓ LỖI THƯỜNG GẶP

### 1. "Can't connect to MySQL"
```bash
sudo systemctl start mysql
mysql -u root -p190705 -e "SELECT 1;"
```

### 2. "Port already in use"
```bash
# Kill process on port 8001
lsof -i :8001
kill -9 <PID>

# Kill process on port 7050
lsof -i :7050
kill -9 <PID>
```

### 3. "Không tạo được email"
- Đợi vài giây, email providers có thể bị rate limit
- Kiểm tra backend logs
- Thử chọn provider khác (Mail.tm, Mail.gw, Guerrilla)

### 4. "Module not found"
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

---

## 📊 URLS

| Service | URL |
|---------|-----|
| Frontend | http://localhost:7050 |
| Backend | http://localhost:8001 |
| API Docs | http://localhost:8001/docs |

---

## 🎯 NGUYÊN NHÂN VẤN ĐỀ CŨ

**Vấn đề báo cáo:**
1. ❌ Không tạo được email ở tất cả service
2. ❌ Không có auto quay về 10 phút

**Nguyên nhân:**
- Frontend đang gọi tới URL backend **SAI**: `https://stable-local-build.preview.emergentagent.com`
- Gây lỗi CORS và không kết nối được backend
- Backend URL đúng phải là: `http://localhost:8001`

**Đã sửa:**
✅ File `/app/frontend/.env` → `REACT_APP_BACKEND_URL=http://localhost:8001`
✅ Tạo hướng dẫn chi tiết chạy local
✅ Tạo script tự động `start_local.sh`

---

## 🎊 CHECKLIST TRƯỚC KHI CHẠY

- [ ] MySQL đã cài và đang chạy
- [ ] Database `temp_mail` đã tạo
- [ ] Python 3.9+ đã cài
- [ ] Node.js 18+ và Yarn đã cài
- [ ] File `.env` backend có config đúng
- [ ] File `.env` frontend có `REACT_APP_BACKEND_URL=http://localhost:8001`
- [ ] Port 8001 và 7050 chưa bị chiếm

**Chúc bạn thành công! 🚀**
