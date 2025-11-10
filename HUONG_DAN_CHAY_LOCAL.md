# 🚀 HƯỚNG DẪN CHẠY ỨNG DỤNG TEMPMAIL TRÊN LOCAL

## 📋 YÊU CẦU HỆ THỐNG

### Phần mềm cần cài đặt:
- **Python 3.9+** (khuyến nghị Python 3.10 hoặc 3.11)
- **Node.js 18+** và **Yarn**
- **MongoDB 4.4+** (cho local development)
- **Git** (để clone code)

---

## 📥 BƯỚC 1: TẢI VÀ GIẢI NÉN CODE

### Cách 1: Download từ Emergent
1. Vào project của bạn trên Emergent
2. Click nút **"Save to Github"** hoặc **"Download"**
3. Giải nén file zip vào thư mục bạn muốn

### Cách 2: Clone từ Github (nếu đã push)
```bash
git clone <your-repo-url>
cd <project-folder>
```

---

## 🔧 BƯỚC 2: CÀI ĐẶT MONGODB

### Windows:
1. Download MongoDB Community Server: https://www.mongodb.com/try/download/community
2. Cài đặt với tùy chọn "Complete"
3. Chọn "Install MongoDB as a Service"
4. Kiểm tra MongoDB đã chạy:
```cmd
mongo --version
```

### macOS:
```bash
# Cài qua Homebrew
brew tap mongodb/brew
brew install mongodb-community

# Khởi động MongoDB
brew services start mongodb-community
```

### Linux (Ubuntu/Debian):
```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Thêm repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Cài đặt
sudo apt-get update
sudo apt-get install -y mongodb-org

# Khởi động
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Kiểm tra MongoDB đang chạy:
```bash
# Kết nối vào MongoDB shell
mongosh

# Hoặc
mongo
```

Nếu kết nối thành công, MongoDB đã sẵn sàng! Gõ `exit` để thoát.

---

## ⚙️ BƯỚC 3: CÀI ĐẶT BACKEND (Python/FastAPI)

### 1. Di chuyển vào thư mục backend:
```bash
cd backend
```

### 2. Tạo Python Virtual Environment:

**Windows:**
```cmd
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

Sau khi activate, bạn sẽ thấy `(venv)` ở đầu dòng lệnh.

### 3. Cài đặt dependencies:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Kiểm tra file .env:
File `/app/backend/.env` đã có sẵn với cấu hình MongoDB local:
```env
MONGO_URL=mongodb://localhost:27017
CORS_ORIGINS=*
```

**Lưu ý:** Không cần thay đổi gì! MongoDB local không cần username/password mặc định.

### 5. Khởi động Backend:
```bash
# Vẫn ở trong thư mục backend với venv đã activate
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Kiểm tra Backend:**
- Mở trình duyệt: http://localhost:8001
- API Docs: http://localhost:8001/docs
- Nếu thấy trang JSON hoặc Swagger UI → Backend đã chạy! ✅

**Giữ cửa sổ terminal này mở!**

---

## 🎨 BƯỚC 4: CÀI ĐẶT FRONTEND (React)

### 1. Mở terminal MỚI (đừng tắt terminal backend)

### 2. Di chuyển vào thư mục frontend:
```bash
cd frontend
```

### 3. Cài đặt Yarn (nếu chưa có):
```bash
npm install -g yarn
```

### 4. Cài đặt dependencies:
```bash
yarn install
```

### 5. Kiểm tra file .env:
File `/app/frontend/.env` đã có sẵn:
```env
REACT_APP_BACKEND_URL=http://localhost:8001
PORT=3000
```

**Lưu ý:** Nếu muốn đổi port frontend, sửa `PORT=3000` thành port khác (ví dụ `PORT=7050`).

### 6. Khởi động Frontend:
```bash
yarn start
```

Sau vài giây, trình duyệt sẽ tự động mở trang: **http://localhost:3000**

**Frontend đã chạy! ✅**

---

## 🎯 SỬ DỤNG ỨNG DỤNG

### Truy cập:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8001
- **API Documentation:** http://localhost:8001/docs

### Tính năng chính:
1. **Tạo email tự động:** App tự tạo email ngay khi mở
2. **Chọn Service:** Mail.tm, Mail.gw, Guerrilla Mail, Auto (random)
3. **Chọn Domain:** Dropdown domain theo service đã chọn
4. **Xem tin nhắn:** Click vào email để xem inbox
5. **Làm mới 10 phút:** Extend thời gian email
6. **Lịch sử:** Xem email đã hết hạn
7. **Lưu email:** Lưu email quan trọng vào tab "Mail đã lưu"

---

## 🐛 TROUBLESHOOTING (Xử lý lỗi)

### Lỗi 1: Backend không khởi động
**Lỗi:** `ModuleNotFoundError: No module named 'fastapi'`
**Giải pháp:**
```bash
# Đảm bảo venv đã activate (có dấu (venv) ở đầu dòng)
pip install -r requirements.txt
```

### Lỗi 2: Không kết nối được MongoDB
**Lỗi:** `ServerSelectionTimeoutError` hoặc `Connection refused`
**Giải pháp:**
```bash
# Kiểm tra MongoDB có chạy không
# Windows:
net start MongoDB

# macOS:
brew services start mongodb-community

# Linux:
sudo systemctl start mongod

# Test connection:
mongosh  # hoặc mongo
```

### Lỗi 3: Frontend không tìm thấy backend
**Lỗi:** `Network Error` hoặc `ERR_CONNECTION_REFUSED`
**Giải pháp:**
1. Kiểm tra backend đang chạy: http://localhost:8001
2. Kiểm tra file `frontend/.env`:
   ```env
   REACT_APP_BACKEND_URL=http://localhost:8001
   ```
3. Restart frontend sau khi sửa .env

### Lỗi 4: Port đã được sử dụng
**Lỗi:** `Address already in use`
**Giải pháp:**

**Cho Backend (port 8001):**
```bash
# Windows:
netstat -ano | findstr :8001
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:8001 | xargs kill -9
```

**Cho Frontend (port 3000):**
```bash
# Sửa file frontend/.env
PORT=3001  # Đổi sang port khác
```

### Lỗi 5: Yarn command not found
**Giải pháp:**
```bash
npm install -g yarn
```

### Lỗi 6: Python không tìm thấy
**Giải pháp:**
- Download Python: https://www.python.org/downloads/
- Khi cài, **NHỚ TICK** "Add Python to PATH"
- Restart terminal sau khi cài

---

## 🔄 RESTART ỨNG DỤNG

### Tắt ứng dụng:
- Nhấn **Ctrl+C** trong terminal backend
- Nhấn **Ctrl+C** trong terminal frontend

### Chạy lại:

**Backend:**
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Frontend:**
```bash
cd frontend
yarn start
```

---

## 📂 CẤU TRÚC THỨ MỤC

```
/app/
├── backend/
│   ├── server.py              # Main FastAPI application
│   ├── models.py              # Database models (không dùng cho MongoDB)
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Backend configuration
│   └── venv/                  # Virtual environment (sau khi tạo)
│
├── frontend/
│   ├── src/
│   │   ├── App.js            # Main React component
│   │   ├── App.css           # Styles
│   │   └── index.js          # Entry point
│   ├── public/               # Static files
│   ├── package.json          # Node dependencies
│   ├── .env                  # Frontend configuration
│   └── node_modules/         # Dependencies (sau khi yarn install)
│
└── HUONG_DAN_CHAY_LOCAL.md   # File này!
```

---

## 🆘 CẦN GIÚP ĐỠ?

### Kiểm tra logs:
**Backend logs:** Xem trong terminal đang chạy backend
**Frontend logs:** Xem trong terminal frontend hoặc Browser Console (F12)

### Các lệnh hữu ích:

**Kiểm tra Python version:**
```bash
python --version
# hoặc
python3 --version
```

**Kiểm tra Node.js version:**
```bash
node --version
yarn --version
```

**Kiểm tra MongoDB:**
```bash
mongosh --version
```

**Xem tất cả processes đang chạy port:**
```bash
# Windows:
netstat -ano

# macOS/Linux:
lsof -i -P -n | grep LISTEN
```

---

## ✅ CHECKLIST TRƯỚC KHI CHẠY

- [ ] Python 3.9+ đã cài đặt
- [ ] Node.js 18+ và Yarn đã cài đặt
- [ ] MongoDB đã cài đặt và đang chạy
- [ ] Code đã download/clone về máy
- [ ] Backend dependencies đã cài (`pip install -r requirements.txt`)
- [ ] Frontend dependencies đã cài (`yarn install`)
- [ ] File `.env` đã kiểm tra (backend và frontend)
- [ ] Port 8001 và 3000 chưa bị sử dụng

---

## 🎉 CHÚC BẠN THÀNH CÔNG!

Nếu làm theo đúng các bước trên, ứng dụng TempMail sẽ chạy mượt mà trên máy local của bạn!

**Lưu ý quan trọng:**
- ✅ **Mail.tm và Mail.gw:** Tạo email theo đúng domain đã chọn
- ⚠️ **Guerrilla Mail:** API không cho phép chọn domain cụ thể (domain hiển thị trong UI chỉ mang tính tham khảo)

**Có thắc mắc?** Hãy kiểm tra phần Troubleshooting hoặc xem logs để debug!
