# CHANGELOG - Dual SMTP Keys + Integer ID

## Ngày cập nhật: 2025-01-07

---

## 🔑 TÓM TẮT THAY ĐỔI

### 1. **Hỗ trợ nhiều SMTP Labs API Keys (Song song & Dự phòng)**
   - ✅ Có thể cấu hình tối đa 9 API keys
   - ✅ Round-robin rotation: Phân bố tải đều giữa các keys
   - ✅ Auto-failover: Tự động chuyển sang key khác khi một key thất bại
   - ✅ Theo dõi stats riêng cho từng key

### 2. **Đổi ID từ UUID sang Integer (Auto-increment)**
   - ✅ ID ngắn gọn hơn (1, 2, 3... thay vì UUID dài)
   - ✅ Hiệu suất tốt hơn cho database queries
   - ✅ API endpoints vẫn giữ nguyên cấu trúc, chỉ thay đổi kiểu dữ liệu

---

## 📋 CHI TIẾT THAY ĐỔI

### Backend Changes

#### 1. **File: `/app/backend/.env`**
```env
# CŨ (Single key):
SMTPLABS_API_KEY=smtplabs_DEkL4DqWAxMR76XBkN7n3G2yVPeoqusnG8qukhEBXN3meASm

# MỚI (Multiple keys):
SMTPLABS_API_KEY_1=smtplabs_DEkL4DqWAxMR76XBkN7n3G2yVPeoqusnG8qukhEBXN3meASm
SMTPLABS_API_KEY_2=smtplabs_DEkL4DqWAxMR76XBkN7n3G2yVPeoqusnG8qukhEBXN3meASm
# SMTPLABS_API_KEY_3=... (có thể thêm tối đa 9 keys)
```

**Lưu ý**: Vẫn hỗ trợ format cũ `SMTPLABS_API_KEY` để backward compatible.

---

#### 2. **File: `/app/backend/models.py`**

**Thay đổi TempEmail model:**
```python
# CŨ:
id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

# MỚI:
id = Column(Integer, primary_key=True, autoincrement=True)
```

**Thay đổi EmailHistory model:**
```python
# CŨ:
id = Column(String(36), primary_key=True)

# MỚI:
id = Column(Integer, primary_key=True, autoincrement=True)
```

---

#### 3. **File: `/app/backend/server.py`**

**Cập nhật API key loading (line ~35-55):**
```python
# Load multiple SMTP keys
SMTPLABS_API_KEYS = []
for i in range(1, 10):  # Support up to 9 keys
    key = os.environ.get(f'SMTPLABS_API_KEY_{i}', '').strip()
    if key:
        SMTPLABS_API_KEYS.append(key)
        logging.info(f"✅ Loaded SMTPLABS_API_KEY_{i}")
```

**Thêm round-robin key selector:**
```python
def get_next_smtp_key():
    """Get next SMTP key using round-robin selection"""
    global _current_smtp_key_index
    
    if not SMTPLABS_API_KEYS:
        return None, -1
    
    key_index = _current_smtp_key_index % len(SMTPLABS_API_KEYS)
    _current_smtp_key_index += 1
    
    return SMTPLABS_API_KEYS[key_index], key_index
```

**Cập nhật SMTP functions để nhận api_key parameter:**
- `smtplabs_create_account(address, password, api_key, key_index)`
- `smtplabs_get_mailboxes(account_id, api_key)`
- `smtplabs_get_messages(account_id, mailbox_id, api_key)`
- `smtplabs_get_message_detail(account_id, mailbox_id, message_id, api_key)`

**Cập nhật Pydantic schemas (line ~60-100):**
```python
# CŨ:
class TempEmailSchema(BaseModel):
    id: str
    # ...

class CreateEmailResponse(BaseModel):
    id: str
    # ...

# MỚI:
class TempEmailSchema(BaseModel):
    id: int
    # ...

class CreateEmailResponse(BaseModel):
    id: int
    # ...
```

**Cập nhật tất cả API endpoints:**
```python
# CŨ:
@api_router.get("/emails/{email_id}")
async def get_email(email_id: str, db: Session = Depends(get_db)):
    # ...

# MỚI:
@api_router.get("/emails/{email_id}")
async def get_email(email_id: int, db: Session = Depends(get_db)):
    # ...
```

**Cập nhật fallback logic với multi-key support:**
```python
async def create_email_with_fallback(username: str = None):
    # Try Mail.tm first
    # ...
    
    # Fallback to SMTPLabs with multiple keys
    if SMTPLABS_API_KEYS:
        for key_attempt in range(len(SMTPLABS_API_KEYS)):
            try:
                api_key, key_index = get_next_smtp_key()
                # Try with this key
                # ...
                return result
            except Exception as e:
                # Log error and continue to next key
                continue
```

---

#### 4. **File: `/app/backend/init_db.py`**

**Thêm chế độ reset:**
```python
def drop_tables():
    """Xóa tất cả các tables (nếu muốn reset lại từ đầu)"""
    Base.metadata.drop_all(bind=engine)

def main():
    reset_mode = "--reset" in sys.argv or "--drop" in sys.argv
    
    if reset_mode:
        confirm = input("⚠️  Xóa tất cả dữ liệu và tạo lại tables? (yes/no): ")
        if confirm.lower() in ['yes', 'y']:
            drop_tables()
    
    create_tables()
```

**Sử dụng:**
```bash
# Tạo tables mới
python init_db.py

# Reset database (xóa + tạo lại)
python init_db.py --reset
```

---

## 🔧 MIGRATION GUIDE

### Bước 1: Backup dữ liệu cũ (nếu cần)
```bash
# Backup MySQL database
mysqldump -u root -p190705 temp_mail > backup_before_migration.sql
```

### Bước 2: Cập nhật code
```bash
cd /path/to/project
git pull  # hoặc download files mới
```

### Bước 3: Cập nhật .env
```bash
cd backend
nano .env

# Thêm các dòng:
SMTPLABS_API_KEY_1=your_first_key
SMTPLABS_API_KEY_2=your_second_key
```

### Bước 4: Reset database
```bash
cd backend
python init_db.py --reset
# Nhập "yes" khi được hỏi
```

### Bước 5: Restart backend
```bash
# Container:
sudo supervisorctl restart backend

# Local:
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

---

## 📊 PROVIDER STATS TRACKING

Stats được theo dõi cho từng key riêng biệt:

```python
_provider_stats = {
    "mailtm": {"success": 0, "failures": 0, "last_failure": 0},
    "smtplabs_key1": {"success": 0, "failures": 0, "last_failure": 0, "last_success": 0},
    "smtplabs_key2": {"success": 0, "failures": 0, "last_failure": 0, "last_success": 0},
    # ...
}
```

**Logs ví dụ:**
```
✅ Loaded SMTPLABS_API_KEY_1
✅ Loaded SMTPLABS_API_KEY_2
📧 SMTPLabs: 2 API key(s) loaded
🔄 Attempting to create email via Mail.tm...
❌ Mail.tm failed: Rate limit exceeded
🔄 Falling back to SMTPLabs key1... (attempt 1/2)
✅ SMTPLabs account created with key1: test123@test.smtp.dev
```

---

## 🎯 LOAD BALANCING STRATEGY

### Round-Robin Distribution
1. Request 1 → Key 1
2. Request 2 → Key 2
3. Request 3 → Key 1 (quay lại)
4. Request 4 → Key 2
5. ...

### Failover Logic
```
Mail.tm (primary) → FAIL
  ↓
SMTPLabs Key1 → FAIL (rate limit)
  ↓
SMTPLabs Key2 → SUCCESS ✅
```

---

## ⚠️ LƯU Ý QUAN TRỌNG

### 1. **Breaking Changes**
- ❗ **ID format changed**: UUID → Integer
- ❗ **Cần reset database** để áp dụng thay đổi schema
- ❗ **Frontend có thể cần cập nhật** nếu có logic phụ thuộc vào UUID format

### 2. **Data Loss Warning**
- Reset database sẽ **XÓA TẤT CẢ** emails và history hiện tại
- Backup trước khi migrate nếu cần giữ dữ liệu

### 3. **API Compatibility**
- URL endpoints không thay đổi
- Response format không thay đổi (chỉ thay `id` từ string → number)
- Frontend cần check logic parse `id` as integer

---

## 🧪 TESTING

### Test Multiple Keys
```bash
# Terminal 1: Start backend
cd backend
python -m uvicorn server:app --reload

# Terminal 2: Test API
curl -X POST http://localhost:8001/api/emails/create \
  -H "Content-Type: application/json" \
  -d '{}'

# Kiểm tra logs để thấy key nào được sử dụng
```

### Test ID Format
```bash
# Get emails
curl http://localhost:8001/api/emails

# Response should have integer IDs:
# [{"id": 1, "address": "..."}]  ← NOT "id": "uuid-string"
```

---

## 📝 FRONTEND COMPATIBILITY

### Check & Update Frontend
```javascript
// Frontend có thể cần cập nhật type definitions
interface Email {
  id: number;  // CŨ: string
  address: string;
  // ...
}

// URL params vẫn hoạt động tự động
fetch(`${API}/emails/${emailId}/messages`)  // emailId = 1, 2, 3...
```

---

## ✅ CHECKLIST

- [ ] Backup database cũ (nếu cần)
- [ ] Cập nhật `.env` với multiple SMTP keys
- [ ] Chạy `python init_db.py --reset`
- [ ] Restart backend service
- [ ] Test tạo email mới (check logs cho key usage)
- [ ] Kiểm tra frontend hoạt động với integer IDs
- [ ] Test failover: Disable key1 → verify key2 được sử dụng

---

## 📞 SUPPORT

Nếu gặp vấn đề:
1. Kiểm tra logs: `tail -f /var/log/supervisor/backend.*.log`
2. Verify MySQL connection: `mysql -u root -p190705`
3. Check API keys format trong `.env`
4. Verify init_db.py output có lỗi không

---

**Generated:** 2025-01-07  
**Version:** 2.2  
**Author:** AI Assistant
