#!/bin/bash

echo "🚀 Đang khởi động Backend Server..."
echo "================================="

cd backend

# Kiểm tra Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 chưa được cài đặt!"
    echo "Vui lòng cài đặt Python 3.11 hoặc cao hơn"
    exit 1
fi

echo "✅ Python version: $(python3 --version)"

# Cài đặt dependencies nếu cần
if [ ! -d "venv" ]; then
    echo "📦 Tạo virtual environment..."
    python3 -m venv venv
fi

echo "📦 Kích hoạt virtual environment..."
source venv/bin/activate

echo "📦 Cài đặt dependencies..."
pip install -q -r requirements.txt

echo "🔌 Kiểm tra kết nối MySQL..."
python3 init_db.py

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Backend sẵn sàng!"
    echo "📡 Server đang chạy tại: http://localhost:8001"
    echo "📚 API Docs: http://localhost:8001/docs"
    echo "================================="
    echo ""
    
    # Chạy server
    uvicorn server:app --host 0.0.0.0 --port 8001 --reload
else
    echo "❌ Không thể khởi động backend. Vui lòng kiểm tra lỗi ở trên."
    exit 1
fi