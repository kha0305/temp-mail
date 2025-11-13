#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         KIỂM TRA CUỐI CÙNG - TEMPMAIL APP                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# Test 1: Backend API
echo "Test 1: Backend API"
API_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:8001/api/ -o /dev/null)
if [ "$API_RESPONSE" = "200" ]; then
    echo -e "   ${GREEN}✅ PASS${NC} - Backend API hoạt động"
    ((PASS++))
else
    echo -e "   ${RED}❌ FAIL${NC} - Backend API không hoạt động (HTTP: $API_RESPONSE)"
    ((FAIL++))
fi
echo ""

# Test 2: MySQL Connection
echo "Test 2: MySQL Connection"
MYSQL_TEST=$(mysql -u root -p190705 -e "SELECT 1" 2>&1 | grep -c "^1$")
if [ "$MYSQL_TEST" = "1" ]; then
    echo -e "   ${GREEN}✅ PASS${NC} - MySQL kết nối thành công"
    ((PASS++))
else
    echo -e "   ${RED}❌ FAIL${NC} - MySQL kết nối thất bại"
    ((FAIL++))
fi
echo ""

# Test 3: Create Email
echo "Test 3: Tạo Email"
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8001/api/emails/create \
  -H "Content-Type: application/json" \
  -d '{"service": "auto"}')
EMAIL_ID=$(echo $CREATE_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('id', ''))" 2>/dev/null)
if [ ! -z "$EMAIL_ID" ]; then
    EMAIL_ADDRESS=$(echo $CREATE_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('address', ''))")
    echo -e "   ${GREEN}✅ PASS${NC} - Email được tạo: $EMAIL_ADDRESS (ID: $EMAIL_ID)"
    ((PASS++))
else
    echo -e "   ${RED}❌ FAIL${NC} - Không thể tạo email"
    echo "   Response: $CREATE_RESPONSE"
    ((FAIL++))
    EMAIL_ID=""
fi
echo ""

# Test 4: Extend Time (Timer Reset)
if [ ! -z "$EMAIL_ID" ]; then
    echo "Test 4: Extend Time (Timer Reset)"
    sleep 2
    EXTEND_RESPONSE=$(curl -s -X POST http://localhost:8001/api/emails/$EMAIL_ID/extend-time)
    EXTEND_STATUS=$(echo $EXTEND_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('status', ''))" 2>/dev/null)
    if [ "$EXTEND_STATUS" = "extended" ]; then
        NEW_EXPIRES=$(echo $EXTEND_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('expires_at', ''))")
        echo -e "   ${GREEN}✅ PASS${NC} - Timer được reset: $NEW_EXPIRES"
        ((PASS++))
    else
        echo -e "   ${RED}❌ FAIL${NC} - Không thể reset timer"
        echo "   Response: $EXTEND_RESPONSE"
        ((FAIL++))
    fi
    echo ""
else
    echo "Test 4: Extend Time (Timer Reset)"
    echo -e "   ${YELLOW}⏭️  SKIP${NC} - Không có email để test"
    echo ""
fi

# Test 5: Refresh Messages
if [ ! -z "$EMAIL_ID" ]; then
    echo "Test 5: Refresh Messages"
    REFRESH_RESPONSE=$(curl -s -X POST http://localhost:8001/api/emails/$EMAIL_ID/refresh)
    MESSAGE_COUNT=$(echo $REFRESH_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('count', -1))" 2>/dev/null)
    if [ "$MESSAGE_COUNT" != "-1" ]; then
        echo -e "   ${GREEN}✅ PASS${NC} - Refresh messages thành công (Count: $MESSAGE_COUNT)"
        ((PASS++))
    else
        echo -e "   ${RED}❌ FAIL${NC} - Không thể refresh messages"
        echo "   Response: $REFRESH_RESPONSE"
        ((FAIL++))
    fi
    echo ""
else
    echo "Test 5: Refresh Messages"
    echo -e "   ${YELLOW}⏭️  SKIP${NC} - Không có email để test"
    echo ""
fi

# Test 6: Frontend
echo "Test 6: Frontend"
FRONTEND_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000 -o /dev/null)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "   ${GREEN}✅ PASS${NC} - Frontend hoạt động"
    ((PASS++))
else
    echo -e "   ${RED}❌ FAIL${NC} - Frontend không hoạt động (HTTP: $FRONTEND_RESPONSE)"
    ((FAIL++))
fi
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                      KẾT QUẢ CUỐI CÙNG                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "   ${GREEN}✅ PASS: $PASS${NC}"
echo -e "   ${RED}❌ FAIL: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 TẤT CẢ TEST ĐỀU THÀNH CÔNG!${NC}"
    echo ""
    echo "📱 Ứng dụng sẵn sàng sử dụng:"
    echo "   - Frontend: http://localhost:3000"
    echo "   - Backend API: http://localhost:8001/api"
    echo "   - API Docs: http://localhost:8001/docs"
    exit 0
else
    echo -e "${RED}⚠️  MỘT SỐ TEST THẤT BẠI!${NC}"
    echo ""
    echo "Vui lòng kiểm tra logs:"
    echo "   - Backend: tail -f /var/log/supervisor/backend.err.log"
    echo "   - Frontend: tail -f /var/log/supervisor/frontend.out.log"
    exit 1
fi
