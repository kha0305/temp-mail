#!/bin/bash

echo "🚀 Đang khởi động Frontend..."
echo "================================="

cd frontend

# Kiểm tra Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js chưa được cài đặt!"
    echo "Vui lòng cài đặt Node.js 16 hoặc cao hơn"
    exit 1
fi

echo "✅ Node version: $(node --version)"

# Kiểm tra yarn
if ! command -v yarn &> /dev/null; then
    echo "⚠️  Yarn chưa được cài đặt. Đang cài đặt..."
    npm install -g yarn
fi

echo "✅ Yarn version: $(yarn --version)"

# Cài đặt dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Cài đặt dependencies..."
    yarn install
else
    echo "✅ Dependencies đã được cài đặt"
fi

echo ""
echo "✅ Frontend sẵn sàng!"
echo "🌐 Ứng dụng đang chạy tại: http://localhost:3000"
echo "================================="
echo ""

# Chạy frontend
yarn start