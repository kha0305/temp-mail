# 📧 TempMail - Ứng Dụng Email Tạm Thời

## 🚀 QUICK START (Chạy nhanh)

### Cách 1: Tự động (Khuyên dùng)

**macOS/Linux:**
```bash
bash start_app.sh
```

**Windows:**
```cmd
start_app.bat
```
Hoặc double-click file `start_app.bat`

### Cách 2: Thủ công

**1. Khởi động MongoDB:**
```bash
# macOS:
brew services start mongodb-community

# Linux:
sudo systemctl start mongod

# Windows:
net start MongoDB
```

**2. Chạy Backend:**
```bash
cd backend
python -m venv venv

# Activate venv:
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows

# Install & Run:
pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**3. Chạy Frontend (terminal mới):**
```bash
cd frontend
yarn install
yarn start
```

**4. Mở trình duyệt:** http://localhost:3000

---

## 📋 YÊU CẦU

- Python 3.9+
- Node.js 18+
- MongoDB 4.4+
- Yarn

---

## 🌐 ĐƯỜNG DẪN

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8001
- **API Docs:** http://localhost:8001/docs

---

## ✨ TÍNH NĂNG

- ✅ Tạo email tạm tự động khi mở app
- ✅ Chọn dịch vụ: Mail.tm, Mail.gw, Guerrilla Mail
- ✅ **Chọn domain cụ thể** (Mail.tm & Mail.gw)
- ✅ Xem tin nhắn realtime
- ✅ Email tự động hết hạn sau 10 phút
- ✅ Làm mới thời gian email
- ✅ Lịch sử email đã hết hạn
- ✅ Lưu email quan trọng
- ✅ Dark mode / Light mode

---

## ⚠️ LƯU Ý QUAN TRỌNG

### Domain Selection:
- ✅ **Mail.tm & Mail.gw:** Email được tạo theo ĐÚNG domain bạn chọn
- ⚠️ **Guerrilla Mail:** API không hỗ trợ chọn domain (domain hiển thị trong dropdown chỉ mang tính tham khảo)

### Fix mới nhất:
- ✅ Sửa lỗi: Email không khớp với domain đã chọn
- ✅ Frontend luôn gửi domain đến backend
- ✅ Backend log chi tiết domain được sử dụng
- ✅ Response trả về domain đã chọn

---

## 🐛 SỬA LỖI THƯỜNG GẶP

### Backend không khởi động:
```bash
# Kiểm tra MongoDB đang chạy
mongosh  # hoặc mongo

# Nếu không chạy, khởi động MongoDB
```

### Frontend lỗi kết nối:
```bash
# Kiểm tra backend: http://localhost:8001
# Kiểm tra file frontend/.env:
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Port đã sử dụng:
```bash
# Kill process đang dùng port 8001 (backend)
# macOS/Linux:
lsof -ti:8001 | xargs kill -9

# Windows:
netstat -ano | findstr :8001
taskkill /PID <PID> /F
```

---

## 📖 HƯỚNG DẪN CHI TIẾT

Xem file: **`HUONG_DAN_CHAY_LOCAL.md`** để có hướng dẫn đầy đủ từng bước.

---

## 📂 CẤU TRÚC CODE

```
/app/
├── backend/              # FastAPI + Python
│   ├── server.py         # Main API
│   ├── requirements.txt  # Dependencies
│   └── .env              # Config
├── frontend/             # React
│   ├── src/App.js        # Main component
│   ├── package.json      # Dependencies
│   └── .env              # Config
├── start_app.sh          # Auto start (Mac/Linux)
├── start_app.bat         # Auto start (Windows)
└── README_LOCAL.md       # File này!
```

---

## 🔧 TECH STACK

- **Backend:** FastAPI, Python 3.9+, Motor (MongoDB driver)
- **Frontend:** React 18, Tailwind CSS, Axios
- **Database:** MongoDB
- **API Providers:** Mail.tm, Mail.gw, Guerrilla Mail

---

## 📞 HỖ TRỢ

### Logs:
- Backend: Xem terminal backend hoặc `backend.log`
- Frontend: Xem terminal frontend hoặc Browser Console (F12)

### Test API:
```bash
# Test backend
curl http://localhost:8001

# Test tạo email
curl -X POST http://localhost:8001/api/emails/create \
  -H "Content-Type: application/json" \
  -d '{"service": "mailtm", "domain": "2200freefonts.com"}'
```

---

## ✅ CHANGELOG (Domain Fix)

### Ngày 10/11/2025:
- ✅ Sửa lỗi: Email không được tạo theo domain đã chọn
- ✅ Frontend: Luôn gửi domain parameter (bỏ check domain đầu tiên)
- ✅ Backend: Thêm logging chi tiết khi chọn domain
- ✅ Backend: Response trả về domain & username
- ✅ Guerrilla Mail: Fix API call với domain parameter
- ⚠️ Note: Guerrilla Mail API có limitation - không thể đảm bảo domain

---

Made with ❤️ by Emergent AI
