const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// Trust proxy for rate limiting (needed when behind proxy)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection - Temporarily commented out for testing
// mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/codementor-ai')
// .then(() => console.log('✅ Connected to MongoDB'))
// .catch(err => {
//   console.error('❌ MongoDB connection error:', err.message);
//   console.log('💡 To fix this:');
//   console.log('   1. Install MongoDB locally: brew install mongodb-community');
//   console.log('   2. Or use MongoDB Atlas (cloud): Update MONGODB_URI in .env');
//   console.log('   3. Or comment out this connection to run without database');
// });
console.log('⚠️  MongoDB connection temporarily disabled for testing');

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  // Verify token here (you can use the same JWT verification logic)
  // For now, we'll just pass through
  socket.userId = 'temp'; // This should be the actual user ID from token
  next();
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-tutoring-session', (sessionId) => {
    socket.join(`tutoring-${sessionId}`);
    console.log(`User ${socket.id} joined tutoring session ${sessionId}`);
  });
  
  socket.on('join-interview-session', (sessionId) => {
    socket.join(`interview-${sessionId}`);
    console.log(`User ${socket.id} joined interview session ${sessionId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Routes - Temporarily commented out for testing
// app.use('/api/auth', require('./routes/auth'));
// app.use('/api/tutoring', require('./routes/tutoring'));
// app.use('/api/job-prep', require('./routes/jobPrep'));
// app.use('/api/interviews', require('./routes/interviews'));
// app.use('/api/users', require('./routes/users'));

// Temporary test route
app.post('/api/auth/register', (req, res) => {
  console.log('Registration attempt:', req.body);
  res.json({
    message: 'Registration successful (test mode)',
    token: 'test-token-123',
    user: {
      _id: 'test-user-id',
      name: req.body.name,
      email: req.body.email
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);
  res.json({
    message: 'Login successful (test mode)',
    token: 'test-token-123',
    user: {
      _id: 'test-user-id',
      name: 'Test User',
      email: req.body.email
    }
  });
});

app.get('/api/auth/me', (req, res) => {
  console.log('Fetch user profile request');
  res.json({
    user: {
      _id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      skillLevels: {
        python: { level: 7, lastUpdated: new Date() },
        javascript: { level: 5, lastUpdated: new Date() },
        algorithms: { level: 8, lastUpdated: new Date() },
        systemDesign: { level: 3, lastUpdated: new Date() }
      },
      statistics: {
        totalStudyTime: 120,
        lessonsCompleted: 12,
        challengesSolved: 25,
        interviewsCompleted: 3,
        streakDays: 5,
        lastActiveDate: new Date()
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});
