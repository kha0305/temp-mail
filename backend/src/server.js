const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const { sequelize, TempEmail, EmailHistory } = require('./models');
const apiRoutes = require('./routes/api');
const emailService = require('./services/emailService');
const { Op } = require('sequelize');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8001;

// Middleware
app.use(express.json());

// CORS Configuration
const corsOrigins = process.env.CORS_ORIGINS || '*';
const allowedOrigins = corsOrigins === '*' 
  ? '*' 
  : corsOrigins.split(',').map(origin => origin.trim());

console.log('Allowed Origins:', allowedOrigins);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiting to API routes
app.use('/api', apiLimiter);

// Health Check Route
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Temp Mail Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api', apiRoutes);

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["my-custom-header"],
  },
  transports: ['polling', 'websocket'], // Force polling first for Vercel compatibility
  allowEIO3: true
});

// Store active intervals for sockets
const socketIntervals = new Map();

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.on('watch_email', async (data) => {
    const { email, token, service, account_id } = data;
    console.log(`👀 Watching email for ${socket.id}: ${email}`);

    // Clear existing interval if any
    if (socketIntervals.has(socket.id)) {
      clearInterval(socketIntervals.get(socket.id));
    }

    // Immediate check
    try {
      const messages = await emailService.getMessages(service, account_id || email, token);
      socket.emit('messages_update', messages);
    } catch (error) {
      console.error(`Error fetching initial messages for ${email}:`, error.message);
    }

    // Set up polling interval (every 5 seconds)
    const intervalId = setInterval(async () => {
      try {
        const messages = await emailService.getMessages(service, account_id || email, token);
        // We emit every time, frontend can check if there are new ones
        socket.emit('messages_update', messages);
      } catch (error) {
        if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
          console.warn(`🛑 Stopping polling for ${email} due to auth error: ${error.message}`);
          clearInterval(intervalId);
          socketIntervals.delete(socket.id);
          socket.emit('error', { message: 'Session expired or invalid' });
        } else {
          // Only log other errors occasionally or if not auth related
          console.error(`Error polling messages for ${email}:`, error.message);
        }
      }
    }, 5000); // Check every 5 seconds

    socketIntervals.set(socket.id, intervalId);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
    if (socketIntervals.has(socket.id)) {
      clearInterval(socketIntervals.get(socket.id));
      socketIntervals.delete(socket.id);
    }
  });
});

// Background Task: Cleanup expired emails
const CHECK_INTERVAL = 30 * 1000; // 30 seconds

const cleanupExpiredEmails = async () => {
  try {
    const now = new Date();
    const expiredEmails = await TempEmail.findAll({
      where: {
        expires_at: {
          [Op.lte]: now
        }
      }
    });

    if (expiredEmails.length > 0) {
      console.log(`Found ${expiredEmails.length} expired emails`);

      for (const email of expiredEmails) {
        try {
          await EmailHistory.create({
            address: email.address,
            password: email.password,
            token: email.token,
            account_id: email.account_id,
            created_at: email.created_at,
            expired_at: email.expires_at,
            message_count: email.message_count
          });

          await email.destroy();
          console.log(`Moved email to history: ${email.address}`);
        } catch (error) {
          console.error(`Error moving email ${email.address} to history: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error in background task loop: ${error.message}`);
  }
};

// Start Server
const startServer = async () => {
  try {
    // Connect to Database
    await sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');

    // Sync models (create tables if not exist)
    await sequelize.sync();
    console.log('✅ Database synced');

    // Start background task (Only if not in Vercel environment to avoid freezing)
    if (!process.env.VERCEL) {
        setInterval(cleanupExpiredEmails, CHECK_INTERVAL);
        console.log(`🚀 Background task started - checking every ${CHECK_INTERVAL / 1000}s`);
        
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`API Docs: http://localhost:${PORT}/api`);
            console.log(`Socket.io enabled`);
        });
    } else {
        console.log('ℹ️ Running in Vercel environment - Background tasks disabled');
    }

  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

startServer();

// Export for Vercel
module.exports = app;
