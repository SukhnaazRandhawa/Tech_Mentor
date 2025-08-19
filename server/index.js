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

// In-memory user database (email -> user mapping)
const userDatabase = new Map();

// Helper function to clean up and format names properly
function cleanupName(name) {
  if (!name || name.trim() === '') {
    return 'User';
  }
  const cleaned = name
    .replace(/[0-9]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return cleaned || 'User';
}

// Helper: create or fetch user by email
const createOrGetUserByEmail = (email, name = null) => {
  if (!userDatabase.has(email)) {
    const userId = 'user-' + Date.now();
    userDatabase.set(email, {
      _id: userId,
      name: cleanupName(name || 'User'),
      email,
      skillLevels: {}, // Start with empty skills - will be added dynamically
      activityLog: [],
      statistics: {
        totalStudyTime: 0,
        lessonsCompleted: 0,
        challengesSolved: 0,
        interviewsCompleted: 0,
        streakDays: 0,
        lastActiveDate: new Date(),
        jobPrepsCreated: 0
      }
    });
  }
  return userDatabase.get(email);
};

// Track current logged-in user (test mode substitute for JWT)
let currentUserEmail = null;

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
  const { name, email } = req.body;

  // Prevent duplicate registration for same email
  if (userDatabase.has(email)) {
    return res.status(400).json({ message: 'User with this email already exists' });
  }

  const newUser = createOrGetUserByEmail(email, name);
  currentUserEmail = email;

  res.json({
    message: 'Registration successful (test mode)',
    token: 'test-token-123',
    user: {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      skillLevels: newUser.skillLevels
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);
  const { email } = req.body;
  if (!userDatabase.has(email)) {
    return res.status(400).json({ message: 'Invalid credentials - User not found' });
  }
  const user = userDatabase.get(email);
  currentUserEmail = email;

  res.json({
    message: 'Login successful (test mode)',
    token: 'test-token-123',
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      skillLevels: user.skillLevels
    }
  });
});

app.get('/api/auth/me', (req, res) => {
  console.log('Fetch user profile request');
  if (!currentUserEmail) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  const user = userDatabase.get(currentUserEmail);
  
  res.json({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      skillLevels: user.skillLevels,
      statistics: user.statistics
    }
  });
});

// Update profile name (test mode)
app.put('/api/auth/update-profile', (req, res) => {
  console.log('Update profile request:', req.body);
  if (!currentUserEmail) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  const { name } = req.body;
  const user = userDatabase.get(currentUserEmail);
  if (name && name.trim() !== '') {
    user.name = cleanupName(name);
  }
  res.json({
    message: 'Profile updated successfully',
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      skillLevels: user.skillLevels
    }
  });
});

// Add endpoint to add/update a skill
app.post('/api/skills/add', (req, res) => {
  console.log('Add skill request:', req.body);
  
  if (!currentUserEmail) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const { skillName, level = 0 } = req.body;
  const user = userDatabase.get(currentUserEmail);
  
  if (!skillName || skillName.trim() === '') {
    return res.status(400).json({ message: 'Skill name is required' });
  }
  
  // Clean and normalize skill name
  const normalizedSkill = skillName.toLowerCase().trim();
  
  // Add or update the skill
  user.skillLevels[normalizedSkill] = {
    level: Math.max(0, Math.min(10, level)), // Ensure level is between 0-10
    lastUpdated: new Date()
  };
  
  console.log(`Skill added/updated: ${normalizedSkill} (Level ${level}) for ${user.name}`);
  
  res.json({
    message: 'Skill added/updated successfully',
    skill: user.skillLevels[normalizedSkill],
    skillName: normalizedSkill
  });
});

// Get all skills for current user
app.get('/api/skills', (req, res) => {
  if (!currentUserEmail) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const user = userDatabase.get(currentUserEmail);
  res.json({ skills: user.skillLevels });
});

// Dynamic Dashboard API endpoints
app.get('/api/dashboard/recent-activity', (req, res) => {
  console.log('Fetch recent activity request');
  const user = currentUserEmail ? userDatabase.get(currentUserEmail) : null;
  if (!user) return res.json({ activities: [] });
  const activities = user.activityLog.slice(-5).reverse().map(activity => ({
    id: activity.id || Date.now(),
    type: activity.type,
    title: activity.title,
    timestamp: formatTimestamp(activity.timestamp),
    icon: getActivityIcon(activity.type),
    color: getActivityColor(activity.type)
  }));
  res.json({ activities: activities.length > 0 ? activities : [] });
});

app.get('/api/dashboard/today-goal', (req, res) => {
  console.log('Fetch today goal request');
  const user = currentUserEmail ? userDatabase.get(currentUserEmail) : null;
  const goal = user ? generateTodaysGoal(user) : {
    title: 'Start Python Basics',
    description: 'Learn variables and data types',
    estimatedTime: 30
  };
  res.json({ goal });
});

app.get('/api/dashboard/stats', (req, res) => {
  console.log('Fetch dashboard stats request');
  const user = currentUserEmail ? userDatabase.get(currentUserEmail) : null;
  if (!user) {
    return res.json({ stats: { lessonsCompleted: 0, overallProgress: 0, mockInterviews: 0, jobPreps: 0 } });
  }
  const stats = {
    lessonsCompleted: user.statistics.lessonsCompleted || 0,
    overallProgress: calculateOverallProgress(user.skillLevels),
    mockInterviews: user.statistics.interviewsCompleted || 0,
    jobPreps: user.statistics.jobPrepsCreated || 0
  };
  res.json({ stats });
});

// Add activity endpoint for testing
app.post('/api/dashboard/add-activity', (req, res) => {
  console.log('Add activity request:', req.body);
  const user = currentUserEmail ? userDatabase.get(currentUserEmail) : null;
  if (!user) return res.status(401).json({ message: 'Please login first' });
  const { type, title } = req.body;
  
  // Add activity to user's log
  user.activityLog.push({
    id: Date.now(),
    type,
    title,
    timestamp: new Date()
  });
  
  // Update relevant statistics
  switch (type) {
    case 'lesson':
      user.statistics.lessonsCompleted = (user.statistics.lessonsCompleted || 0) + 1;
      break;
    case 'challenge':
      user.statistics.challengesSolved = (user.statistics.challengesSolved || 0) + 1;
      break;
    case 'interview':
      user.statistics.interviewsCompleted = (user.statistics.interviewsCompleted || 0) + 1;
      break;
  }
  
  res.json({ message: 'Activity added successfully' });
});

// Update skill endpoint for testing
app.post('/api/dashboard/update-skill', (req, res) => {
  console.log('Update skill request:', req.body);
  const user = currentUserEmail ? userDatabase.get(currentUserEmail) : null;
  if (!user) return res.status(401).json({ message: 'Please login first' });
  const { skill, level } = req.body;
  
  if (user.skillLevels[skill]) {
    user.skillLevels[skill].level = Math.min(Math.max(level, 0), 10);
    user.skillLevels[skill].lastUpdated = new Date();
  }
  
  res.json({ 
    message: 'Skill updated successfully',
    skillLevels: user.skillLevels 
  });
});

// Helper functions
function formatTimestamp(date) {
  const now = new Date();
  const activityDate = new Date(date);
  const diffInMinutes = Math.floor((now - activityDate) / (1000 * 60));

  if (diffInMinutes < 60) {
    return `${diffInMinutes} minutes ago`;
  } else if (diffInMinutes < 1440) { // 24 hours
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInMinutes / 1440);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}

function getActivityIcon(type) {
  const iconMap = {
    'lesson': 'CheckCircle',
    'challenge': 'CheckCircle',
    'interview': 'MessageSquare',
    'job_prep': 'Briefcase',
    'skill_update': 'TrendingUp'
  };
  return iconMap[type] || 'CheckCircle';
}

function getActivityColor(type) {
  const colorMap = {
    'lesson': 'text-accent-600',
    'challenge': 'text-accent-600', 
    'interview': 'text-secondary-600',
    'job_prep': 'text-primary-600',
    'skill_update': 'text-yellow-600'
  };
  return colorMap[type] || 'text-accent-600';
}

function calculateOverallProgress(skillLevels) {
  const levels = Object.values(skillLevels || {});
  if (levels.length === 0) return 0;
  
  const totalLevel = levels.reduce((sum, skill) => sum + skill.level, 0);
  return Math.round((totalLevel / (levels.length * 10)) * 100);
}

function generateTodaysGoal(user) {
  const skillLevels = user.skillLevels || {};
  const skills = Object.keys(skillLevels);
  
  if (skills.length === 0) {
    return {
      title: 'Start Your Learning Journey',
      description: 'Choose your first skill to learn',
      estimatedTime: 30,
      skill: 'general',
      targetLevel: 1
    };
  }
  
  // Find the skill with the lowest level
  let lowestSkill = skills[0];
  let lowestLevel = skillLevels[lowestSkill]?.level || 0;
  
  for (const skill of skills) {
    const level = skillLevels[skill]?.level || 0;
    if (level < lowestLevel) {
      lowestLevel = level;
      lowestSkill = skill;
    }
  }

  // Generate appropriate goal based on skill level and type
  const goalTemplates = {
    'python': {
      0: { title: 'Start Python Basics', description: 'Learn variables and data types', time: 30 },
      1: { title: 'Python Control Flow', description: 'Master if statements and loops', time: 45 },
      2: { title: 'Python Functions', description: 'Learn to write and use functions', time: 45 },
      3: { title: 'Python Data Structures', description: 'Work with lists and dictionaries', time: 60 },
      default: { title: 'Advanced Python Concepts', description: 'Explore OOP and advanced topics', time: 60 }
    },
    'javascript': {
      0: { title: 'JavaScript Fundamentals', description: 'Learn variables and basic syntax', time: 30 },
      1: { title: 'JavaScript Functions', description: 'Master function declarations', time: 45 },
      2: { title: 'DOM Manipulation', description: 'Learn to interact with web pages', time: 45 },
      3: { title: 'Async JavaScript', description: 'Understand promises and async/await', time: 60 },
      default: { title: 'Modern JavaScript', description: 'Explore ES6+ features', time: 60 }
    },
    'algorithms': {
      0: { title: 'Algorithm Basics', description: 'Understand time and space complexity', time: 30 },
      1: { title: 'Sorting Algorithms', description: 'Learn bubble sort and selection sort', time: 45 },
      2: { title: 'Search Algorithms', description: 'Master binary search techniques', time: 45 },
      3: { title: 'Data Structures', description: 'Work with arrays and linked lists', time: 60 },
      default: { title: 'Advanced Algorithms', description: 'Explore dynamic programming', time: 60 }
    },
    'data structures': {
      0: { title: 'Data Structure Basics', description: 'Learn arrays and linked lists', time: 30 },
      1: { title: 'Stacks and Queues', description: 'Master LIFO and FIFO structures', time: 45 },
      2: { title: 'Trees and Graphs', description: 'Understand hierarchical structures', time: 60 },
      3: { title: 'Hash Tables', description: 'Learn key-value storage', time: 45 },
      default: { title: 'Advanced Data Structures', description: 'Explore complex structures', time: 60 }
    },
    'system design': {
      0: { title: 'System Design Intro', description: 'Learn basic system components', time: 30 },
      1: { title: 'Scalability Concepts', description: 'Understand load balancing', time: 45 },
      2: { title: 'Database Design', description: 'Learn SQL vs NoSQL choices', time: 45 },
      3: { title: 'Caching Strategies', description: 'Explore Redis and CDNs', time: 60 },
      default: { title: 'Advanced System Design', description: 'Design complex systems', time: 90 }
    },
    'machine learning': {
      0: { title: 'ML Fundamentals', description: 'Learn basic ML concepts', time: 30 },
      1: { title: 'Supervised Learning', description: 'Understand classification and regression', time: 45 },
      2: { title: 'Feature Engineering', description: 'Learn data preprocessing', time: 60 },
      3: { title: 'Model Evaluation', description: 'Master metrics and validation', time: 45 },
      default: { title: 'Advanced ML', description: 'Explore deep learning', time: 90 }
    },
    'database design': {
      0: { title: 'Database Basics', description: 'Learn SQL fundamentals', time: 30 },
      1: { title: 'Normalization', description: 'Understand database design principles', time: 45 },
      2: { title: 'Indexing', description: 'Learn query optimization', time: 45 },
      3: { title: 'Advanced Queries', description: 'Master complex SQL operations', time: 60 },
      default: { title: 'Database Architecture', description: 'Design scalable databases', time: 90 }
    },
    'web development': {
      0: { title: 'Web Fundamentals', description: 'Learn HTML and CSS basics', time: 30 },
      1: { title: 'Frontend Development', description: 'Master JavaScript and frameworks', time: 60 },
      2: { title: 'Backend Development', description: 'Learn server-side programming', time: 60 },
      3: { title: 'Full Stack Integration', description: 'Connect frontend and backend', time: 90 },
      default: { title: 'Advanced Web Dev', description: 'Explore modern web technologies', time: 90 }
    }
  };

  // Try to find a template for the skill, fallback to a generic one
  const skillGoals = goalTemplates[lowestSkill.toLowerCase()] || goalTemplates['python'];
  const goal = skillGoals[lowestLevel] || skillGoals.default;

  return {
    title: goal.title,
    description: goal.description,
    estimatedTime: goal.time,
    skill: lowestSkill,
    targetLevel: lowestLevel + 1
  };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test endpoints for adding data
app.get('/api/test/populate-data', (req, res) => {
  console.log('Populating test data for current user...');
  if (!currentUserEmail) {
    return res.status(401).json({ message: 'Please login first' });
  }
  const user = userDatabase.get(currentUserEmail);
  
  // Add some sample activities
  user.activityLog = [
    {
      id: 1,
      type: 'lesson',
      title: 'Completed Binary Trees lesson',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    },
    {
      id: 2,
      type: 'challenge',
      title: 'Solved 5 coding challenges',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
    },
    {
      id: 3,
      type: 'job_prep',
      title: 'Analyzed Software Engineer job at Google',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    }
  ];
  
  // Add dynamic skills based on common CS concepts
  user.skillLevels = {
    'python': { level: 7, lastUpdated: new Date() },
    'javascript': { level: 5, lastUpdated: new Date() },
    'algorithms': { level: 8, lastUpdated: new Date() },
    'data structures': { level: 6, lastUpdated: new Date() },
    'system design': { level: 3, lastUpdated: new Date() },
    'machine learning': { level: 2, lastUpdated: new Date() },
    'database design': { level: 4, lastUpdated: new Date() },
    'web development': { level: 6, lastUpdated: new Date() }
  };
  
  // Update statistics
  user.statistics = {
    lessonsCompleted: 12,
    challengesSolved: 25,
    interviewsCompleted: 8,
    jobPrepsCreated: 3,
    streakDays: 5,
    lastActiveDate: new Date()
  };
  
  res.json({ 
    message: `Test data populated successfully for ${user.name}!`,
    user: {
      name: user.name,
      email: user.email,
      activities: user.activityLog.length,
      skills: Object.keys(user.skillLevels).length,
      stats: user.statistics
    }
  });
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
  console.log(`Test data endpoint: http://localhost:${PORT}/api/test/populate-data`);
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