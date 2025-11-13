#!/bin/bash

echo "=========================================="
echo "TEST NHẬN THƯ"
echo "=========================================="
echo ""

# Create email
echo "1. Tạo email mới..."
EMAIL_RESPONSE=$(curl -s -X POST http://localhost:8001/api/emails/create \
  -H "Content-Type: application/json" \
  -d '{"service": "1secmail"}')

EMAIL_ID=$(echo $EMAIL_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
EMAIL_ADDRESS=$(echo $EMAIL_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['address'])")

echo "   ✅ Email ID: $EMAIL_ID"
echo "   ✅ Address: $EMAIL_ADDRESS"
echo ""

echo "2. Gửi email test đến $EMAIL_ADDRESS"
echo "   📧 Bạn có thể gửi email test từ Gmail/Outlook đến địa chỉ này"
echo "   📧 Hoặc sử dụng service khác để test"
echo ""

echo "3. Chờ 10 giây để email đến..."
for i in {10..1}; do
    echo -ne "   ⏳ $i giây...\r"
    sleep 1
done
echo ""
echo ""

echo "4. Kiểm tra inbox..."
for attempt in {1..3}; do
    echo "   🔄 Lần thử $attempt/3..."
    MESSAGES=$(curl -s -X POST http://localhost:8001/api/emails/$EMAIL_ID/refresh)
    COUNT=$(echo $MESSAGES | python3 -c "import sys, json; print(json.load(sys.stdin)['count'])")
    
    echo "   📬 Tìm thấy $COUNT tin nhắn"
    
    if [ "$COUNT" -gt 0 ]; then
        echo ""
        echo "   ✅ THÀNH CÔNG: Đã nhận được email!"
        echo ""
        echo "   Chi tiết tin nhắn:"
        echo $MESSAGES | python3 -m json.tool | head -30
        exit 0
    fi
    
    if [ $attempt -lt 3 ]; then
        echo "   ⏳ Chờ 5 giây trước khi thử lại..."
        sleep 5
    fi
done

echo ""
echo "   ⚠️  Chưa có email nào đến"
echo "   💡 Để test, hãy gửi email đến: $EMAIL_ADDRESS"
echo ""

echo "=========================================="
echo "TEST COMPLETED"
echo "=========================================="
