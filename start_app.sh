#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║       🚀 TEMPMAIL APPLICATION - LOCAL SETUP 🚀            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Kiểm tra các yêu cầu hệ thống
echo "📋 Kiểm tra yêu cầu hệ thống..."
echo "================================="

ERRORS=0

# Kiểm tra Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 chưa được cài đặt"
    ERRORS=$((ERRORS+1))
else
    echo "✅ Python: $(python3 --version)"
fi

# Kiểm tra Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js chưa được cài đặt"
    ERRORS=$((ERRORS+1))
else
    echo "✅ Node.js: $(node --version)"
fi

# Kiểm tra MySQL
if ! command -v mysql &> /dev/null; then
    echo "⚠️  MySQL client chưa được cài đặt (không bắt buộc)"
else
    echo "✅ MySQL: $(mysql --version | cut -d' ' -f6)"
fi

echo ""

if [ $ERRORS -gt 0 ]; then
    echo "❌ Vui lòng cài đặt các yêu cầu còn thiếu trước khi tiếp tục."
    echo "📖 Xem file SETUP_GUIDE.md để biết hướng dẫn chi tiết."
    exit 1
fi

echo "✅ Tất cả yêu cầu hệ thống đã đủ!"
echo ""

# Hỏi người dùng muốn chạy gì
echo "Bạn muốn chạy:"
echo "  1) Backend only (Port 8001)"
echo "  2) Frontend only (Port 3000)"
echo "  3) Cả Backend và Frontend (Khuyến nghị)"
echo "  4) Khởi tạo Database"
echo ""
read -p "Chọn (1-4): " choice

case $choice in
    1)
        bash start_backend.sh
        ;;
    2)
        bash start_frontend.sh
        ;;
    3)
        echo ""
        echo "🚀 Đang khởi động cả Backend và Frontend..."
        echo "================================="
        echo "⚠️  Backend sẽ chạy ở terminal này"
        echo "⚠️  Frontend sẽ chạy ở terminal mới (nếu có)"
        echo ""
        
        # Chạy backend trong nền
        bash start_backend.sh &
        BACKEND_PID=$!
        
        # Đợi backend khởi động
        echo "⏳ Đợi backend khởi động..."
        sleep 5
        
        # Chạy frontend
        bash start_frontend.sh
        
        # Cleanup khi thoát
        trap "kill $BACKEND_PID 2>/dev/null" EXIT
        ;;
    4)
        cd backend
        python3 init_db.py
        ;;
    *)
        echo "❌ Lựa chọn không hợp lệ"
        exit 1
        ;;
esac