# TempMail - Temporary Email Generator

A full-stack web application for generating temporary email addresses with multiple service providers support. Built with FastAPI (Python) backend, React frontend, and MySQL database.

## 🌟 Features

- ✉️ **Auto-create temporary emails** - Automatically creates a new email when you open the app
- ⏰ **10-minute expiration** - Emails automatically expire after 10 minutes
- 🔄 **Auto-refresh** - New email is created automatically when the current one expires
- 📧 **Multiple providers**: Mail.tm, 1secmail, Mail.gw, Guerrilla Mail
- 💾 **Save emails** - Save important emails for later viewing
- 📜 **Email history** - View expired emails with full message history
- 🎨 **Modern UI** - Beautiful dark theme with smooth animations
- 🔐 **View HTML/Text content** - Full support for HTML and plain text emails

## 🛠️ Tech Stack

**Backend:**
- FastAPI (Python 3.9+)
- MySQL 8.0+ with SQLAlchemy ORM
- httpx for async API calls
- Background tasks for email expiration

**Frontend:**
- React 18
- Tailwind CSS
- Axios for API calls
- Lucide React icons
- Sonner for toast notifications

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

1. **Python 3.9 or higher**
   - Download from: https://www.python.org/downloads/
   - Verify: `python --version` or `python3 --version`

2. **Node.js 18 or higher & Yarn**
   - Download Node.js from: https://nodejs.org/
   - Install Yarn: `npm install -g yarn`
   - Verify: `node --version` && `yarn --version`

3. **MySQL 8.0 or higher**
   - Download from: https://dev.mysql.com/downloads/mysql/
   - Or use package manager:
     - macOS: `brew install mysql`
     - Ubuntu/Debian: `sudo apt install mysql-server`
     - Windows: Download installer from MySQL website

## 🚀 Quick Start

### Step 1: Configure MySQL

1. Start MySQL service:
```bash
# macOS
brew services start mysql

# Ubuntu/Debian
sudo systemctl start mysql

# Windows
# Start MySQL from Services or MySQL Workbench
```

2. Create database and user:
```bash
mysql -u root -p
```

```sql
CREATE DATABASE temp_mail CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- If using different credentials, update backend/.env file
-- Default credentials: root / 190705
```

### Step 2: Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create and activate virtual environment:
```bash
# macOS/Linux
python3 -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Verify environment variables in `.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=190705
DB_NAME=temp_mail
CORS_ORIGINS=http://localhost:3000
```

5. Initialize database:
```bash
python init_db.py
```

6. Start backend server:
```bash
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Backend will be running at: **http://localhost:8001**  
API documentation: **http://localhost:8001/docs**

### Step 3: Frontend Setup

1. Open a new terminal and navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
yarn install
```

3. Verify environment variables in `.env`:
```env
REACT_APP_BACKEND_URL=http://localhost:8001
PORT=3000
```

4. Start frontend development server:
```bash
yarn start
```

Frontend will be running at: **http://localhost:3000**

### Step 4: Use the Application

1. Open your browser and go to: **http://localhost:3000**
2. A temporary email will be created automatically
3. Copy the email address and use it for testing/registration
4. Refresh to check for new messages
5. Click on messages to view HTML/text content

## 📁 Project Structure

```
/app/
├── backend/
│   ├── server.py              # Main FastAPI application
│   ├── database.py            # MySQL connection & session
│   ├── models.py              # SQLAlchemy models (TempEmail, EmailHistory, SavedEmail)
│   ├── background_tasks.py   # Auto-expiration background task
│   ├── init_db.py            # Database initialization script
│   ├── requirements.txt      # Python dependencies
│   └── .env                  # Backend configuration
├── frontend/
│   ├── src/
│   │   ├── App.js           # Main React component
│   │   ├── App.css          # Styles
│   │   └── index.js         # Entry point
│   ├── public/              # Static assets
│   ├── package.json         # Node dependencies
│   └── .env                 # Frontend configuration
├── README.md                # This file (English)
└── HUONG_DAN.md            # Vietnamese documentation
```

## 🗄️ Database Schema

### Table: `temp_emails`
```sql
CREATE TABLE temp_emails (
    id INT AUTO_INCREMENT PRIMARY KEY,
    address VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    token TEXT,
    account_id VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    message_count INT DEFAULT 0,
    provider VARCHAR(50),
    username VARCHAR(100),
    domain VARCHAR(100)
);
```

### Table: `email_history`
```sql
CREATE TABLE email_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    address VARCHAR(255) NOT NULL,
    password VARCHAR(255),
    token TEXT,
    account_id VARCHAR(255),
    created_at DATETIME,
    expired_at DATETIME NOT NULL,
    message_count INT DEFAULT 0,
    provider VARCHAR(50),
    username VARCHAR(100),
    domain VARCHAR(100)
);
```

### Table: `saved_emails`
```sql
CREATE TABLE saved_emails (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email_id INT NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    from_address VARCHAR(255),
    from_name VARCHAR(255),
    subject TEXT,
    html_content LONGTEXT,
    text_content LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔌 API Endpoints

### Active Emails
- `POST /api/emails/create` - Create new temporary email
- `GET /api/emails` - List active emails
- `GET /api/emails/{id}` - Get email details
- `GET /api/emails/{id}/messages` - Get messages for email
- `POST /api/emails/{id}/refresh` - Refresh messages
- `DELETE /api/emails/{id}` - Delete email
- `POST /api/emails/{id}/extend-time` - Extend email lifetime by 10 minutes

### History
- `GET /api/emails/history/list` - List expired emails
- `GET /api/emails/history/{id}/messages` - Get messages from history
- `DELETE /api/emails/history/delete` - Delete history emails (selective or all)

### Saved Emails
- `POST /api/emails/{id}/messages/{msg_id}/save` - Save a message
- `GET /api/emails/saved/list` - List saved emails
- `GET /api/emails/saved/{id}` - Get saved email details
- `DELETE /api/emails/saved/delete` - Delete saved emails

### Domains
- `GET /api/domains?service={service}` - Get available domains for service

## 🐛 Troubleshooting

### Backend won't start

**Error: "Can't connect to MySQL server"**
```bash
# Check if MySQL is running
mysql -u root -p

# Verify credentials in backend/.env
# Check if database exists
mysql -u root -p -e "SHOW DATABASES;"
```

**Error: "No module named 'httpx'"**
```bash
# Ensure virtual environment is activated
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

### Frontend won't start

**Error: "Cannot find module"**
```bash
# Delete node_modules and reinstall
rm -rf node_modules yarn.lock
yarn install
```

**Error: "Port 3000 already in use"**
```bash
# Change port in frontend/.env
PORT=7050
```

### Database issues

**Reset database:**
```bash
cd backend
python init_db.py --reset
# Type 'yes' to confirm
```

**Manual database reset:**
```sql
mysql -u root -p

DROP DATABASE temp_mail;
CREATE DATABASE temp_mail CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE temp_mail;
```

## 🔧 Development Tips

### Hot Reload
- Backend: Automatically reloads when you edit Python files (uvicorn --reload)
- Frontend: Automatically reloads when you edit React files

### Viewing Logs
```bash
# Backend logs (if running in foreground)
# Logs appear in terminal

# Check background task logs
# Logs appear in backend terminal with timestamp
```

### Testing API
- Use the built-in Swagger UI: http://localhost:8001/docs
- Or use curl:
```bash
# Create email
curl -X POST http://localhost:8001/api/emails/create

# Get emails
curl http://localhost:8001/api/emails
```

## 🎯 Features Explained

### Auto-create on First Visit
When you open the app for the first time, it automatically creates a temporary email without requiring you to click any button.

### 10-Minute Timer
Each email has a 10-minute lifespan. The timer is displayed at the top and counts down in real-time.

### Extend Time Button
Click "Làm mới 10 phút" to reset the timer back to 10 minutes (not cumulative - always resets to 10 minutes).

### Auto-create on Expiry
When the timer reaches 0, the old email is automatically moved to history and a new email is created.

### Email History
View all expired emails in the "Lịch sử" tab. You can still view messages from expired emails. Use checkboxes to select and delete history.

### Save Important Emails
Click the "Lưu" button when viewing a message to save it permanently. Saved emails appear in the "Mail đã lưu" tab.

## 📞 Support

For issues or questions:
1. Check this README and HUONG_DAN.md (Vietnamese version)
2. Verify all prerequisites are installed
3. Check the troubleshooting section
4. Review backend logs for error messages

## 📄 License

This project is provided as-is for personal and educational use.

---

**Made with ❤️ using FastAPI + React + MySQL**
