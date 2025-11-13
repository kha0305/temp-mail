#!/bin/bash

echo "=========================================="
echo "TEST TIMER FIX"
echo "=========================================="
echo ""

# Test 1: Create email
echo "1. Tạo email mới..."
EMAIL_RESPONSE=$(curl -s -X POST http://localhost:8001/api/emails/create \
  -H "Content-Type: application/json" \
  -d '{"service": "auto"}')

EMAIL_ID=$(echo $EMAIL_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
EMAIL_ADDRESS=$(echo $EMAIL_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['address'])")
EXPIRES_AT=$(echo $EMAIL_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['expires_at'])")

echo "   ✅ Email ID: $EMAIL_ID"
echo "   ✅ Address: $EMAIL_ADDRESS"
echo "   ✅ Expires at: $EXPIRES_AT"
echo ""

# Test 2: Extend time
echo "2. Test extend time..."
sleep 2
EXTEND_RESPONSE=$(curl -s -X POST http://localhost:8001/api/emails/$EMAIL_ID/extend-time)
NEW_EXPIRES_AT=$(echo $EXTEND_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['expires_at'])")

echo "   ✅ New expires at: $NEW_EXPIRES_AT"
echo ""

# Test 3: Get email details
echo "3. Kiểm tra email details..."
EMAIL_DETAILS=$(curl -s http://localhost:8001/api/emails/$EMAIL_ID)
CURRENT_EXPIRES=$(echo $EMAIL_DETAILS | python3 -c "import sys, json; print(json.load(sys.stdin)['expires_at'])")

echo "   ✅ Current expires at: $CURRENT_EXPIRES"
echo ""

# Test 4: Refresh messages
echo "4. Test refresh messages..."
MESSAGES_RESPONSE=$(curl -s -X POST http://localhost:8001/api/emails/$EMAIL_ID/refresh)
MESSAGE_COUNT=$(echo $MESSAGES_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['count'])")

echo "   ✅ Message count: $MESSAGE_COUNT"
echo ""

# Test 5: Check if expires_at was properly updated
echo "5. Kiểm tra expires_at đã được update..."
if [ "$EXPIRES_AT" != "$NEW_EXPIRES_AT" ]; then
    echo "   ✅ PASS: Expires time đã được cập nhật"
else
    echo "   ❌ FAIL: Expires time không được cập nhật"
fi
echo ""

echo "=========================================="
echo "TEST COMPLETED"
echo "=========================================="
