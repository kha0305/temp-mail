# Temp Mail Backend (Node.js)

This is the Node.js version of the Temp Mail backend, replacing the Python/FastAPI version.

## Prerequisites

- Node.js (v16+)
- MySQL Database

## Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:
   Create a `.env` file in this directory with the following content:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=190705
   DB_NAME=temp_mail
   PORT=8001
   CORS_ORIGINS=*
   ```

## Running the Server

- Development mode (with hot reload):

  ```bash
  npm run dev
  ```

- Production mode:
  ```bash
  npm start
  ```

## API Documentation

The API runs on `http://localhost:8001/api`.
Endpoints match the previous Python backend to ensure frontend compatibility.

- `GET /api/` - Health check and provider status
- `POST /api/emails/create` - Create new email
- `GET /api/emails` - List emails
- `GET /api/emails/:id` - Get email details
- `POST /api/emails/:id/refresh` - Refresh messages
- `GET /api/emails/:id/messages/:messageId` - Get message details
- `POST /api/emails/:id/extend-time` - Extend email expiry
- `DELETE /api/emails/:id` - Delete email
- `GET /api/domains` - Get available domains
