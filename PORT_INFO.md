# ⚠️ QUAN TRỌNG - ĐỌC FILE NÀY!

## 🔴 VẤN ĐỀ: Frontend Vẫn Chạy Port 3000

### Tại Sao?

Có 2 môi trường khác nhau:

---

## 🐳 TRONG CONTAINER EMERGENT (Hiện Tại)

**Supervisor Config (READONLY):**
```
Port: 3000 (hardcoded)
URL: https://modest-neumann.preview.emergentagent.com
```

⚠️ **File `/etc/supervisor/conf.d/supervisord.conf` là READONLY**
- Không thể sửa port trong container
- Kubernetes ingress đã map port 3000 ra ngoài
- Frontend chạy trên port 3000 nhưng truy cập qua URL emergentagent.com

**Trong container, frontend SẼ LUÔN chạy port 3000!**

---

## 💻 TRÊN MÁY LOCAL (Sau Khi Pull Code)

**Khi chạy trên máy local:**
```bash
cd temp-mail
bash start_app.sh
```

✅ Frontend sẽ chạy **PORT 7050** vì:
- File `frontend/.env.local` có `PORT=7050`
- Script `start_frontend.sh` dùng `PORT=7050 yarn start`
- Không có supervisor config override

**URL:** http://localhost:7050

---

## 🎯 KẾT LUẬN

### Trong Container Emergent:
```
Frontend: https://...emergentagent.com (port 3000 internal)
Backend: https://...emergentagent.com/api (port 8001 internal)
```

### Trên Máy Local (Sau khi pull):
```
Frontend: http://localhost:7050 ✅
Backend: http://localhost:8001 ✅
```

---

## 🚀 HƯỚNG DẪN SỬ DỤNG

### Nếu Đang Phát Triển Trong Container:
- Port 3000 là bình thường
- Truy cập qua URL emergentagent.com
- Kubernetes tự động xử lý routing

### Nếu Muốn Chạy Trên Máy Local:
1. **Push code lên GitHub:**
   ```bash
   cd /d/tool_mail/temp-mail
   git add .
   git commit -m "Add local config"
   git push origin main
   ```

2. **Pull về máy local:**
   ```bash
   git clone https://github.com/kha0305/temp-mail.git
   cd temp-mail
   ```

3. **Setup MySQL** (xem README_LOCAL.md)

4. **Chạy:**
   ```bash
   bash start_app.sh
   # Chọn: 1 (Init DB) → 4 (Run All)
   ```

5. **Truy cập:**
   - Frontend: http://localhost:7050 ✅
   - Backend: http://localhost:8001 ✅

---

## 💡 TÓM TẮT

| Môi Trường | Frontend Port | Backend Port | Cách Truy Cập |
|------------|---------------|--------------|---------------|
| **Container Emergent** | 3000 (internal) | 8001 (internal) | URL emergentagent.com |
| **Máy Local** | **7050** ✅ | 8001 | localhost:7050 |

---

## ✅ FILES ĐÃ CHUẨN BỊ CHO LOCAL

Tất cả files config đã được setup cho máy local:
- ✅ `frontend/.env` → Backend URL = localhost:8001
- ✅ `frontend/.env.local` → PORT = 7050
- ✅ `backend/.env` → MySQL localhost
- ✅ `start_frontend.sh` → Dùng PORT=7050
- ✅ Favicon và icons đầy đủ

**Khi bạn pull code về máy local và chạy, nó SẼ chạy port 7050!**

---

## 🔧 NẾU VẪN MUỐN TEST PORT 7050 TRONG CONTAINER

Bạn có thể test thủ công:

```bash
# Stop supervisor frontend
sudo supervisorctl stop frontend

# Chạy thủ công với port 7050
cd /app/frontend
PORT=7050 yarn start
```

**Lưu ý:** Kubernetes ingress chỉ route port 3000, nên port 7050 sẽ không truy cập được từ bên ngoài. Chỉ test được trong container.

---

## 📚 XEM THÊM

- **README_LOCAL.md** - Hướng dẫn chi tiết chạy trên local
- **START_HERE.md** - Quick start
- **HUONG_DAN_PUSH_PULL.md** - Push/Pull GitHub

---

**🎯 Kết luận: Port 3000 trong container là ĐÚNG. Port 7050 sẽ hoạt động khi chạy trên máy local!**
