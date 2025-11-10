@echo off
REM Script tự động chạy TempMail App cho Windows
REM Sử dụng: Double-click file này hoặc chạy: start_app.bat

echo.
echo ========================================
echo    STARTING TEMPMAIL APP (Windows)
echo ========================================
echo.

REM Kiểm tra MongoDB
echo [1/5] Checking MongoDB...
where mongod >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] MongoDB chua cai dat!
    echo Vui long cai MongoDB: https://www.mongodb.com/try/download/community
    pause
    exit /b 1
)
echo [OK] MongoDB da cai dat
echo.

REM Khởi động MongoDB nếu chưa chạy
echo [2/5] Starting MongoDB service...
net start MongoDB >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] MongoDB dang chay
) else (
    echo [INFO] MongoDB da chay tu truoc
)
echo.

REM Kiểm tra Python
echo [3/5] Checking Python...
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python chua cai dat!
    echo Download tai: https://www.python.org/downloads/
    pause
    exit /b 1
)
python --version
echo.

REM Kiểm tra Node.js và Yarn
echo [4/5] Checking Node.js and Yarn...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js chua cai dat!
    echo Download tai: https://nodejs.org/
    pause
    exit /b 1
)
node --version

where yarn >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Yarn chua cai. Dang cai dat...
    npm install -g yarn
)
yarn --version
echo.

REM ============================================
REM BACKEND
REM ============================================
echo [5/5] Starting BACKEND...
cd backend

REM Tạo virtual environment nếu chưa có
if not exist "venv\" (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Cài đặt dependencies
echo Installing Python dependencies...
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

REM Khởi động backend trong window mới
echo Starting FastAPI server...
start "TempMail Backend" cmd /k "venv\Scripts\activate.bat && python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload"

REM Đợi backend khởi động
timeout /t 5 /nobreak >nul

cd ..

REM ============================================
REM FRONTEND
REM ============================================
echo.
echo Starting FRONTEND...
cd frontend

REM Cài đặt dependencies
echo Installing Node dependencies...
call yarn install --silent

REM Khởi động frontend trong window mới
echo Starting React app...
start "TempMail Frontend" cmd /k "yarn start"

cd ..

REM Thông báo hoàn tất
echo.
echo ========================================
echo    UNG DUNG DA KHOI DONG THANH CONG!
echo ========================================
echo.
echo Frontend:  http://localhost:3000
echo Backend:   http://localhost:8001
echo API Docs:  http://localhost:8001/docs
echo.
echo Hai cua so terminal moi da mo:
echo - TempMail Backend (port 8001)
echo - TempMail Frontend (port 3000)
echo.
echo De dung ung dung, dong ca hai cua so do.
echo.

REM Mở trình duyệt
timeout /t 3 /nobreak >nul
start http://localhost:3000

pause
