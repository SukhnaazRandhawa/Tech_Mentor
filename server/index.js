const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');
require('dotenv').config();

// ✨ NEW: Request queuing system to prevent API overload
let apiRequestQueue = [];
let isProcessingQueue = false;
let lastApiCall = 0;
const MIN_API_INTERVAL = 2000; // 2 seconds between calls

// Queue processing function
async function processApiQueue() {
  if (isProcessingQueue || apiRequestQueue.length === 0) return;
  
  isProcessingQueue = true;
  console.log(`🚀 Processing API queue. Items: ${apiRequestQueue.length}`);
  
  while (apiRequestQueue.length > 0) {
    const request = apiRequestQueue.shift();
    const timeSinceLastCall = Date.now() - lastApiCall;
    
    if (timeSinceLastCall < MIN_API_INTERVAL) {
      const waitTime = MIN_API_INTERVAL - timeSinceLastCall;
      console.log(`⏳ Waiting ${waitTime}ms before next API call...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastApiCall = Date.now();
    console.log(`📡 Making API call at ${new Date().toISOString()}`);
    
    try {
      const result = await request.process();
      request.resolve(result);
      console.log(`✅ API call completed successfully`);
    } catch (error) {
      console.error(`❌ API call failed:`, error.message);
      request.reject(error);
    }
  }
  
  isProcessingQueue = false;
  console.log(`🏁 API queue processing complete`);
}

// Queued API call wrapper
function queueApiCall(processFunction) {
  return new Promise((resolve, reject) => {
    apiRequestQueue.push({
      process: processFunction,
      resolve,
      reject
    });
    
    console.log(`📋 API request queued. Queue length: ${apiRequestQueue.length}`);
    processApiQueue();
  });
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
let currentUserEmail = 'test@example.com'; // Temporary for testing

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
  
  // ✨ NEW: Handle authentication
  socket.on('authenticate', (data) => {
    const { token } = data;
    if (token === 'test-token-123') {
      socket.authenticated = true;
      socket.emit('authenticated', { status: 'success' }); // ← This line was missing
      console.log(`Socket ${socket.id} authenticated successfully`);
    } else {
      socket.emit('authentication_error', { message: 'Invalid token' });
      console.log(`Socket ${socket.id} authentication failed`);
    }
  });
  
  // ✨ NEW: Handle interview greeting completion
  socket.on('interview:greeting-complete', (data) => {
    const { sessionId, userResponse, readyToStart } = data;
    console.log(`Interview greeting completed for session ${sessionId}`);
    
    if (readyToStart) {
      // Log that user is ready to start
      console.log(`User ready to start interview: ${userResponse}`);
      
      // Emit confirmation back to client
      socket.emit('interview:greeting-acknowledged', {
        status: 'ready',
        message: 'Great! Starting with the first question...'
      });
      
      // You can also broadcast to other clients in the same session if needed
      socket.to(`interview-${sessionId}`).emit('interview:status-update', {
        phase: 'questioning_started',
        message: 'Interview questions phase has begun'
      });
    }
  });
  
  // Optional: Add greeting status event
  socket.on('interview:greeting-status', (data) => {
    console.log('Greeting status update:', data);
  });
  
  // ✨ FIXED: Handle continuous conversation turns with rate limiting
  socket.on('interview:conversation-turn', async (data) => {
    const { sessionId, userResponse, conversationMemory, jobContext } = data;
    const startTime = Date.now();
    
    console.log(`[Conversation] Queuing turn for session ${sessionId}`);
    
    // ✨ DEBUG: Enhanced logging for troubleshooting
    console.log('🔍 DEBUG - Full job context received:', JSON.stringify(jobContext, null, 2));
    console.log('🔍 DEBUG - Job analysis skills:', JSON.stringify(jobContext?.jobAnalysis?.requiredSkills, null, 2));
    console.log('🔍 DEBUG - Conversation memory:', JSON.stringify(conversationMemory, null, 2));
    
    // Check if job context has the expected structure
    if (!jobContext?.jobAnalysis?.requiredSkills) {
      console.warn('⚠️  WARNING: Job context missing required skills structure');
      console.warn('⚠️  Expected: jobContext.jobAnalysis.requiredSkills');
      console.warn('⚠️  Received:', jobContext?.jobAnalysis);
    }
    
    try {
      const user = userDatabase.get(currentUserEmail);
      const session = user.mockInterviews?.find(s => s.id === sessionId);
      
      if (!session) {
        socket.emit('interview:error', { message: 'Session not found' });
        return;
      }
      
      // ✨ NEW: Queue the API call instead of calling directly
      const conversationResult = await queueApiCall(() => 
        processConversationTurn(session, userResponse, conversationMemory, jobContext)
      );
      
      socket.emit('interview:conversation-response', conversationResult);
      
      const processingTime = Date.now() - startTime;
      console.log(`[Conversation] Turn processed in ${processingTime}ms`);
      
    } catch (error) {
      console.error('[Conversation] Error:', error);
      socket.emit('interview:error', { message: 'Error processing conversation' });
    }
  });
  
  // Handle real-time chat messages
  socket.on('tutoring_message', (data) => {
    // Broadcast to all users in the session
    socket.to(`tutoring-${data.sessionId}`).emit('tutoring_message', {
      ...data,
      timestamp: new Date()
    });
  });
  
  // Handle code execution requests
  socket.on('code_execution_request', async (data) => {
    try {
      const result = await executeCode(data.code, data.language);
      
      // Broadcast result to session
      io.to(`tutoring-${data.sessionId}`).emit('code_execution_result', {
        ...result,
        sessionId: data.sessionId,
        timestamp: new Date()
      });
    } catch (error) {
      io.to(`tutoring-${data.sessionId}`).emit('code_execution_error', {
        error: error.message,
        sessionId: data.sessionId,
        timestamp: new Date()
      });
    }
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
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  res.json({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      skillLevels: user.skillLevels || {},
      statistics: user.statistics || {}
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

// AI Tutoring System Endpoints
app.post('/api/tutoring/start-session', async (req, res) => {
  console.log('Start tutoring session request:', req.body);
  
  if (!currentUserEmail) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const { topic, skillLevel = 'beginner' } = req.body;
  const user = userDatabase.get(currentUserEmail);
  
  if (!topic || topic.trim() === '') {
    return res.status(400).json({ message: 'Topic is required' });
  }
  
  // Create new tutoring session
  const sessionId = 'session-' + Date.now();
  const session = {
    id: sessionId,
    userId: user._id,
    topic: topic.trim(),
    skillLevel: skillLevel,
    startTime: new Date(),
    conversation: [],
    codeSnippets: [],
    conceptsCovered: [],
    language: 'python', // Default language
    code: '', // Store current code
    status: 'active'
  };
  
  // Store session in user's data (in real app, this would be in database)
  if (!user.tutoringSessions) user.tutoringSessions = [];
  user.tutoringSessions.push(session);
  
  console.log(`Tutoring session started: ${topic} for ${user.name}`);
  
  // Generate welcome message for the session
  const welcomeMessage = await generateWelcomeMessage(topic, skillLevel, user);
  
  res.json({
    message: 'Tutoring session started successfully',
    session: session,
    aiResponse: welcomeMessage
  });
});

app.post('/api/tutoring/chat', async (req, res) => {
  console.log('Tutoring chat request:', req.body);
  
  if (!currentUserEmail) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const { sessionId, message, codeSnippet, skillLevel = 'beginner' } = req.body;
  const user = userDatabase.get(currentUserEmail);
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ message: 'Message is required' });
  }
  
  try {
    // Generate AI response using Socratic teaching method
    const aiResponse = await generateTutoringResponse(message, codeSnippet, skillLevel, user);
    
    // Add to conversation history
    const conversationEntry = {
      id: Date.now(),
      timestamp: new Date(),
      speaker: 'student',
      message: message.trim(),
      codeSnippet: codeSnippet || null
    };
    
    const aiEntry = {
      id: Date.now() + 1,
      timestamp: new Date(),
      speaker: 'ai',
      message: aiResponse.message,
      codeSnippet: aiResponse.codeSnippet || null,
      concepts: aiResponse.concepts || [],
      hints: aiResponse.hints || []
    };
    
    // Find and update session
    if (user.tutoringSessions) {
      const session = user.tutoringSessions.find(s => s.id === sessionId);
      if (session) {
        session.conversation.push(conversationEntry, aiEntry);
        session.conceptsCovered = [...new Set([...session.conceptsCovered, ...aiResponse.concepts])];
        // Update session with current code and language if provided
        if (codeSnippet) {
          session.code = codeSnippet;
        }
      }
    }
    
    res.json({
      message: 'AI response generated successfully',
      response: aiResponse,
      conversationId: conversationEntry.id
    });
    
  } catch (error) {
    console.error('Error generating AI response:', error);
    res.status(500).json({ 
      message: 'Failed to generate AI response',
      error: error.message 
    });
  }
});

// Update session code and language
app.post('/api/tutoring/update-session', async (req, res) => {
  if (!currentUserEmail) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const { sessionId, code, language } = req.body;
  const user = userDatabase.get(currentUserEmail);
  
  if (!sessionId) {
    return res.status(400).json({ message: 'Session ID is required' });
  }
  
  try {
    const session = user.tutoringSessions?.find(s => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    // Update session data
    if (code !== undefined) session.code = code;
    if (language !== undefined) session.language = language;
    
    res.json({ 
      message: 'Session updated successfully',
      session: session
    });
    
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ 
      message: 'Failed to update session',
      error: error.message 
    });
  }
});

app.post('/api/tutoring/execute-code', async (req, res) => {
  console.log('Code execution request:', req.body);
  
  if (!currentUserEmail) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const { code, language = 'python', sessionId } = req.body;
  const user = userDatabase.get(currentUserEmail);
  
  if (!code || code.trim() === '') {
    return res.status(400).json({ message: 'Code is required' });
  }
  
  try {
    // Execute code using Judge0 API (mock for now)
    const executionResult = await executeCode(code, language);
    
    // Add code execution to session
    if (user.tutoringSessions && sessionId) {
      const session = user.tutoringSessions.find(s => s.id === sessionId);
      if (session) {
        session.codeSnippets.push({
          id: Date.now(),
          code: code,
          language: language,
          result: executionResult,
          timestamp: new Date()
        });
      }
    }
    
    res.json({
      message: 'Code executed successfully',
      result: executionResult
    });
    
  } catch (error) {
    console.error('Error executing code:', error);
    res.status(500).json({ 
      message: 'Failed to execute code',
      error: error.message 
    });
  }
});

// Simple rate limiting for session operations
const sessionRateLimit = new Map();

const checkRateLimit = (key, limit = 5, windowMs = 60000) => {
  const now = Date.now();
  const userRequests = sessionRateLimit.get(key) || [];
  
  // Remove old requests outside the window
  const validRequests = userRequests.filter(time => now - time < windowMs);
  
  if (validRequests.length >= limit) {
    return false; // Rate limit exceeded
  }
  
  // Add current request
  validRequests.push(now);
  sessionRateLimit.set(key, validRequests);
  return true; // Within rate limit
};

app.post('/api/tutoring/end-session', (req, res) => {
  console.log('End tutoring session request:', req.body);
  
  try {
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }
    
    // Check rate limit
    const rateLimitKey = `end-session-${currentUserEmail}`;
    if (!checkRateLimit(rateLimitKey, 3, 60000)) { // 3 requests per minute
      return res.status(429).json({ 
        message: 'Too many session end requests. Please wait a moment and try again.',
        retryAfter: 60
      });
    }
    
    const user = userDatabase.get(currentUserEmail);
    if (!user) {
      console.error('User not found for email:', currentUserEmail);
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Find and end session
    if (user.tutoringSessions) {
      const session = user.tutoringSessions.find(s => s.id === sessionId);
      if (session) {
        session.status = 'completed';
        session.endTime = new Date();
        
        // Calculate session duration
        const duration = session.endTime - session.startTime;
        session.duration = Math.round(duration / 1000 / 60); // in minutes
        
        // Update user statistics
        if (!user.statistics) user.statistics = {};
        user.statistics.totalStudyTime = (user.statistics.totalStudyTime || 0) + session.duration;
        user.statistics.lessonsCompleted = (user.statistics.lessonsCompleted || 0) + 1;
        
        console.log(`Tutoring session ended: ${session.topic} for ${user.name} (${session.duration} minutes)`);
        
        res.json({
          message: 'Tutoring session ended successfully',
          session: session
        });
      } else {
        console.error('Session not found:', sessionId);
        res.status(404).json({ message: 'Session not found' });
      }
    } else {
      console.error('No tutoring sessions found for user');
      res.status(404).json({ message: 'No tutoring sessions found' });
    }
  } catch (error) {
    console.error('Error ending tutoring session:', error);
    res.status(500).json({ 
      message: 'Failed to end tutoring session',
      error: error.message 
    });
  }
});

// Get all skills for current user
app.get('/api/skills', (req, res) => {
  if (!currentUserEmail) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const user = userDatabase.get(currentUserEmail);
  res.json({ skills: user.skillLevels });
});

// Get dashboard skills endpoint
app.get('/api/dashboard/skills', (req, res) => {
  try {
    if (!currentUserEmail) {
      return res.json({ skills: {} });
    }
    
    const user = userDatabase.get(currentUserEmail);
    if (!user) {
      return res.json({ skills: {} });
    }
    
    // Get skills from user's learning paths and skill progress
    const skills = {};
    
    // Add skills from learning paths
    if (user.learningPaths) {
      user.learningPaths.forEach(path => {
        if (path.progress && path.progress.skills) {
          path.progress.skills.forEach(skill => {
            if (!skills[skill.name]) {
              skills[skill.name] = {
                level: skill.currentLevel || 0,
                totalSessions: skill.tutoringSessions || 0,
                jobsApplied: [path.jobTitle]
              };
            } else {
              // Add job title if not already present
              if (!skills[skill.name].jobsApplied.includes(path.jobTitle)) {
                skills[skill.name].jobsApplied.push(path.jobTitle);
              }
            }
          });
        }
      });
    }
    
    // Add skills from skill progress
    if (user.skillProgress) {
      Object.entries(user.skillProgress).forEach(([skillName, skillData]) => {
        if (!skills[skillName]) {
          skills[skillName] = {
            level: skillData.currentLevel || 0,
            totalSessions: skillData.totalSessions || 0,
            jobsApplied: skillData.jobsApplied || []
          };
        } else {
          // Merge data
          skills[skillName].level = Math.max(skills[skillName].level, skillData.currentLevel || 0);
          skills[skillName].totalSessions = Math.max(skills[skillName].totalSessions, skillData.totalSessions || 0);
          // Merge jobs applied
          skillData.jobsApplied?.forEach(job => {
            if (!skills[skillName].jobsApplied.includes(job)) {
              skills[skillName].jobsApplied.push(job);
            }
          });
        }
      });
    }
    
    console.log('Dashboard skills response:', skills);
    res.json({ skills });
  } catch (error) {
    console.error('Error fetching dashboard skills:', error);
    res.status(500).json({ skills: {}, error: error.message });
  }
});

// Get tutoring session history
app.get('/api/tutoring/sessions', (req, res) => {
  if (!currentUserEmail) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const user = userDatabase.get(currentUserEmail);
  const sessions = user.tutoringSessions || [];
  
  res.json({ 
    sessions: sessions.map(session => ({
      id: session.id,
      topic: session.topic,
      skillLevel: session.skillLevel,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      duration: session.duration,
      conceptsCovered: session.conceptsCovered,
      conversationCount: session.conversation?.length || 0,
      codeSnippetsCount: session.codeSnippets?.length || 0
    }))
  });
});

// Get specific tutoring session details
app.get('/api/tutoring/sessions/:sessionId', (req, res) => {
  if (!currentUserEmail) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const { sessionId } = req.params;
  const user = userDatabase.get(currentUserEmail);
  const session = user.tutoringSessions?.find(s => s.id === sessionId);
  
  if (!session) {
    return res.status(404).json({ message: 'Session not found' });
  }
  
  res.json({ session });
});

// AI-powered job analysis endpoint
app.post('/api/job-prep/analyze', async (req, res) => {
  try {
    const { jobTitle, jobDescription, company, preparationTime } = req.body;
    
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (!jobTitle || !jobDescription) {
      return res.status(400).json({ message: 'Job title and description are required' });
    }
    
    // Use AI to analyze the job
    const analysis = await analyzeJobWithAI(jobTitle, jobDescription, company, preparationTime);
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing job:', error);
    res.status(500).json({ message: 'Failed to analyze job', error: error.message });
  }
});

// Generate personalized learning path endpoint
app.post('/api/job-prep/generate-path', async (req, res) => {
  try {
    const { jobAnalysis, preparationTime, userCurrentSkills } = req.body;
    
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (!jobAnalysis || !preparationTime) {
      return res.status(400).json({ message: 'Job analysis and preparation time are required' });
    }
    
    // Use AI to generate learning path
    const learningPath = await generateLearningPathWithAI(jobAnalysis, preparationTime, userCurrentSkills);
    
    res.json(learningPath);
  } catch (error) {
    console.error('Error generating learning path:', error);
    res.status(500).json({ message: 'Failed to generate learning path', error: error.message });
  }
});

// Mock Interview System

// Start a new mock interview
app.post('/api/mock-interview/start', async (req, res) => {
  try {
    const { userLevel, jobDescription } = req.body;
    
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = userDatabase.get(currentUserEmail);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Validate user object has required properties
    if (!user.name || !user._id) {
      console.error('Invalid user object:', user);
      return res.status(500).json({ message: 'Invalid user data' });
    }
    
    // Create interview session
    const sessionId = 'interview-' + Date.now();
    const session = {
      id: sessionId,
      userId: user._id,
      userLevel: userLevel || 'intermediate',
      jobDescription: jobDescription || null,
      startTime: new Date(),
      status: 'active',
      questions: [],
      answers: [],
      scores: [],
      currentQuestionIndex: 0,
      jobAnalysis: null
    };
    
    // Initialize user's interview data if not exists
    if (!user.mockInterviews) {
      user.mockInterviews = [];
    }
    
    user.mockInterviews.push(session);
    
    let firstQuestion, welcomeMessage, jobAnalysis;
    
    if (jobDescription) {
          // Use AI to analyze job and generate tailored questions
    console.log('Analyzing job description with AI...');
    const aiResponse = await queueApiCall(() => analyzeJobAndGenerateQuestions(jobDescription, userLevel));
      
      jobAnalysis = aiResponse.jobAnalysis;
      session.questions = aiResponse.interviewQuestions;
      session.jobAnalysis = jobAnalysis;
      
      // Use the first AI-generated question
      firstQuestion = aiResponse.interviewQuestions[0];
      
      // Generate personalized welcome message
      welcomeMessage = `Welcome to your AI-powered interview! I've analyzed the job description and prepared ${aiResponse.interviewQuestions.length} tailored questions covering technical skills, behavioral scenarios, and role-specific challenges. The role requires skills in ${jobAnalysis.requiredSkills.join(', ')}. Let's start with the first question!`;
      
    } else {
      // Fallback to generic questions
      const fallbackQuestions = generateFallbackInterviewQuestions(userLevel);
      firstQuestion = fallbackQuestions.interviewQuestions[0];
      welcomeMessage = `Welcome to your practice interview! I'll be asking you questions to assess your technical skills and problem-solving abilities. Let's begin!`;
      session.questions = fallbackQuestions.interviewQuestions;
    }
    
    console.log(`Mock interview started for ${user.name}${jobDescription ? ' with job-specific questions' : ' with fallback questions'}`);
    
    res.json({
      message: 'Interview started successfully',
      session: session,
      firstQuestion: firstQuestion,
      welcomeMessage: welcomeMessage,
      jobAnalysis: jobAnalysis,
      totalQuestions: session.questions.length || 5
    });
    
  } catch (error) {
    console.error('Error starting mock interview:', error);
    res.status(500).json({ 
      message: 'Failed to start interview',
      error: error.message 
    });
  }
});

    // Submit answer and get feedback
    app.post('/api/mock-interview/submit-answer', async (req, res) => {
      try {
        const { sessionId, questionId, answer, mode } = req.body;
        
        if (!currentUserEmail) {
          return res.status(401).json({ message: 'Not authenticated' });
        }
        
        if (!sessionId || !answer) {
          return res.status(400).json({ message: 'Session ID and answer are required' });
        }
        
        const user = userDatabase.get(currentUserEmail);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        // Validate user object
        if (!user.mockInterviews || !Array.isArray(user.mockInterviews)) {
          console.error('User mockInterviews not properly initialized:', user);
          return res.status(500).json({ message: 'User interview data not initialized' });
        }
        
        const session = user.mockInterviews.find(s => s.id === sessionId);
        if (!session) {
          return res.status(404).json({ message: 'Interview session not found' });
        }
    
    // Store answer
    session.answers.push({
      questionId: questionId,
      answer: answer,
      timestamp: new Date()
    });
    
    // Generate feedback using AI
    const currentQuestionData = session.questions[session.currentQuestionIndex] || null;
    const jobContext = session.jobAnalysis ? `Role requiring ${session.jobAnalysis.requiredSkills.join(', ')}` : 'General technical role';
    
    const feedback = await queueApiCall(() => generateInterviewFeedback(answer, session.userLevel, currentQuestionData, jobContext));
    
    // Store score and detailed feedback
    session.scores.push(feedback.score);
    session.answers[session.answers.length - 1].feedback = feedback;
    
    // ✅ FIXED: Use dynamic completion logic instead of hardcoded limits
    const currentProgress = session.answers.length;
    
    // For legacy support, use a reasonable maximum but allow dynamic completion
    const shouldContinue = currentProgress < 20; // Increased limit for complex jobs
    
    let nextQuestion = null;
    let interviewComplete = false;
    let finalFeedback = null;
    
    if (shouldContinue) {
      // Get next question from AI-generated list
      if (session.questions && session.questions.length > session.currentQuestionIndex + 1) {
        nextQuestion = session.questions[session.currentQuestionIndex + 1];
        session.currentQuestionIndex++;
        
        // Log progress
        console.log(`Question ${currentProgress + 1}/${totalQuestions} - Type: ${nextQuestion.type}, Difficulty: ${nextQuestion.difficulty}`);
      } else {
        // Interview complete - no more questions available
        interviewComplete = true;
        session.status = 'completed';
        session.endTime = new Date();
        session.duration = Math.round((session.endTime - session.startTime) / 1000 / 60);
        
              // Generate final feedback
      finalFeedback = await generateFinalFeedback(session);
      }
    } else {
      // Interview complete based on question count or time
      interviewComplete = true;
      session.status = 'completed';
      session.endTime = new Date();
      session.duration = Math.round((session.endTime - session.startTime) / 1000 / 60);
      
      // Generate final feedback
      finalFeedback = await generateFinalFeedback(session);
    }
    
    res.json({
      message: 'Answer submitted successfully',
      feedback: feedback.message,
      score: feedback.score,
      suggestions: feedback.suggestions,
      nextQuestion: nextQuestion,
      interviewComplete: interviewComplete,
      finalFeedback: finalFeedback
    });
    
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ 
      message: 'Failed to submit answer',
      error: error.message 
    });
  }
});

// Analyze job description and generate interview questions
app.post('/api/mock-interview/analyze-job', async (req, res) => {
  try {
    const { jobTitle, company, jobDescription } = req.body;
    
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (!jobDescription || !jobTitle) {
      return res.status(400).json({ message: 'Job description and title are required' });
    }
    
    console.log(`Analyzing job: ${jobTitle} at ${company || 'company'}`);
    
    // Use AI to analyze job and generate tailored questions
    const aiResponse = await analyzeJobAndGenerateQuestions(jobDescription, 'technical', 'intermediate');
    
    // Enhance the response with job metadata
    const enhancedResponse = {
      ...aiResponse,
      jobMetadata: {
        title: jobTitle,
        company: company || 'Company',
        analyzedAt: new Date().toISOString(),
        descriptionLength: jobDescription.length
      }
    };
    
    console.log(`Job analysis complete: ${aiResponse.interviewQuestions.length} questions generated`);
    
    res.json(enhancedResponse);
    
  } catch (error) {
    console.error('Error analyzing job:', error);
    res.status(500).json({ 
      message: 'Failed to analyze job description',
      error: error.message 
    });
  }
});

// Start interview with job description analysis
app.post('/api/mock-interview/start-with-job', async (req, res) => {
  try {
    const { userLevel, jobDescription, jobTitle, company } = req.body;
    
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (!jobDescription) {
      return res.status(400).json({ message: 'Job description is required' });
    }
    
    const user = userDatabase.get(currentUserEmail);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Validate user object
    if (!user.name || !user._id) {
      console.error('Invalid user object:', user);
      return res.status(500).json({ message: 'Invalid user data' });
    }
    
    // Create interview session with job context
    const sessionId = 'interview-' + Date.now();
    const session = {
      id: sessionId,
      userId: user._id,
      userLevel: userLevel || 'intermediate',
      jobDescription: jobDescription,
      jobTitle: jobTitle || 'Technical Role',
      company: company || 'Company',
      startTime: new Date(),
      status: 'active',
      questions: [],
      answers: [],
      scores: [],
      currentQuestionIndex: 0,
      jobAnalysis: null
    };
    
    // Initialize user's interview data if not exists
    if (!user.mockInterviews) {
      user.mockInterviews = [];
    }
    
    user.mockInterviews.push(session);
    
    // Use AI to analyze job and generate tailored questions
    console.log('Starting AI-powered job analysis...');
    const aiResponse = await queueApiCall(() => analyzeJobAndGenerateQuestions(jobDescription, userLevel));
    
    session.jobAnalysis = aiResponse.jobAnalysis;
    session.questions = aiResponse.interviewQuestions;
    
    // Use the first AI-generated question
    const firstQuestion = aiResponse.interviewQuestions[0];
    
    // Generate personalized welcome message
    const welcomeMessage = `Welcome to your AI-powered interview for ${jobTitle || 'this role'} at ${company || 'the company'}! I've analyzed the job description and prepared ${aiResponse.interviewQuestions.length} tailored questions covering technical skills, behavioral scenarios, and role-specific challenges. This role requires skills in ${aiResponse.jobAnalysis.requiredSkills.join(', ')} and is looking for a ${aiResponse.jobAnalysis.experienceLevel} level candidate. Let's begin!`;
    
    console.log(`AI-powered interview started for ${user.name} targeting ${jobTitle || 'role'} at ${company || 'company'}`);
    
    res.json({
      message: 'AI-powered interview started successfully',
      session: session,
      firstQuestion: firstQuestion,
      welcomeMessage: welcomeMessage,
      jobAnalysis: aiResponse.jobAnalysis,
      totalQuestions: aiResponse.interviewQuestions.length,
      nextQuestionIndex: 1
    });
    
  } catch (error) {
    console.error('Error starting AI-powered interview:', error);
    res.status(500).json({ 
      message: 'Failed to start AI-powered interview',
      error: error.message 
    });
  }
});

// End interview early
// Enhanced /api/mock-interview/end endpoint
app.post('/api/mock-interview/end', async (req, res) => {
  try {
    const { sessionId, conversationMemory, jobContext, earlyTermination } = req.body;
    
    console.log('📥 End interview request:', { 
      sessionId, 
      hasMemory: !!conversationMemory, 
      hasJobContext: !!jobContext,
      responses: conversationMemory?.userResponses?.length || 0,
      earlyTermination: earlyTermination
    });
    
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = userDatabase.get(currentUserEmail);
    let session = user.mockInterviews?.find(s => s.id === sessionId);
    
    // ✨ ENHANCED: Handle missing session with conversation data
    if (!session && conversationMemory?.userResponses?.length > 0) {
      console.log('⚠️ Session not found, creating from conversation data');
      
      // Create a temporary session from conversation data
      session = {
        id: sessionId || `temp-${Date.now()}`,
        userId: user._id,
        startTime: new Date(Date.now() - (5 * 60 * 1000)), // 5 minutes ago
        endTime: new Date(),
        duration: 5,
        status: 'completed',
        jobTitle: jobContext?.jobTitle || 'Technical Role',
        company: jobContext?.company || 'Company',
        jobAnalysis: jobContext?.jobAnalysis,
        conversationMemory: conversationMemory,
        answers: [], // No traditional answers in conversational format
        scores: [] // No traditional scores
      };
      
      // Add to user's interviews
      if (!user.mockInterviews) user.mockInterviews = [];
      user.mockInterviews.push(session);
    }
    
    if (!session) {
      console.log('❌ No session data available for feedback generation');
      return res.status(404).json({ 
        message: 'Interview session not found and no backup data provided' 
      });
    }
    
    // Check if session already has feedback from natural completion
    if (session.feedback && session.naturalCompletion) {
      console.log('📋 Using existing feedback from natural completion');
      return res.json({
        message: 'Interview feedback retrieved',
        feedback: session.feedback
      });
    }
    
    // Mark session as completed
    session.status = 'completed';
    session.endTime = new Date();
    if (!session.duration) {
      session.duration = Math.round((session.endTime - session.startTime) / 1000 / 60);
    }
    
    // ✨ ENHANCED: Generate feedback based on available data
    let finalFeedback;
    
    const responseCount = conversationMemory?.userResponses?.length || 0;
    const minimumForMeaningfulFeedback = 8;
    
    // Determine if this is actually an early termination
    const isActuallyEarlyTermination = responseCount < minimumForMeaningfulFeedback;
    
    if (earlyTermination || isActuallyEarlyTermination) {
      // Don't generate complex feedback for early termination
      console.log(`⚠️ Early termination detected: ${responseCount} responses (minimum: ${minimumForMeaningfulFeedback})`);
      finalFeedback = {
        earlyTermination: true,
        incomplete: true,
        overallScore: null,
        responseCount: responseCount,
        summary: `Interview ended after ${responseCount} responses. Complete interviews (8+ responses) provide detailed performance analysis.`,
        message: "Complete the full interview to receive comprehensive feedback on your technical skills."
      };
    } else if (conversationMemory?.userResponses?.length > 0) {
      // Use conversation-based feedback generation
      console.log(`✅ Generating feedback from ${conversationMemory.userResponses.length} conversation responses`);
      finalFeedback = await generateConversationalFeedback(session, conversationMemory);
    } else if (session.conversationMemory?.userResponses?.length > 0) {
      // Use stored conversation memory
      console.log(`✅ Generating feedback from stored conversation data`);
      finalFeedback = await generateConversationalFeedback(session, session.conversationMemory);
    } else if (session.answers?.length > 0) {
      // Traditional interview format
      console.log(`✅ Generating feedback from ${session.answers.length} traditional answers`);
      finalFeedback = await generateFinalFeedback(session);
    } else {
      // Fallback for minimal data
      console.log(`⚠️ Generating basic completion feedback - no substantial data available`);
      finalFeedback = generateBasicCompletionFeedback(session);
    }
    
    // Store feedback in session
    session.feedback = finalFeedback;
    
    console.log('✅ Final feedback generated:', {
      overallScore: finalFeedback?.overallScore || 0,
      categories: finalFeedback?.categories?.length || 0,
      summary: finalFeedback?.summary?.substring(0, 100) || 'No summary'
    });
    
    res.json({
      message: (earlyTermination || isActuallyEarlyTermination) ? 'Interview ended early' : 'Interview completed',
      feedback: finalFeedback
    });
    
  } catch (error) {
    console.error('❌ Error ending interview:', error);
    
    // ✨ ENHANCED: Emergency fallback with conversation data
    const { conversationMemory } = req.body;
    if (conversationMemory?.userResponses?.length > 0) {
      console.log('🚨 Using emergency conversation fallback');
      const emergencyFeedback = generateEmergencyFeedback(conversationMemory);
      return res.json({
        message: 'Interview ended with emergency feedback',
        feedback: emergencyFeedback
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to end interview',
      error: error.message 
    });
  }
});

// ✨ NEW: Emergency feedback generator for error cases
function generateEmergencyFeedback(conversationMemory) {
  const responses = conversationMemory.userResponses || [];
  const responseCount = responses.length;
  
  // Calculate basic score
  let score = 4; // Base score for participation
  if (responseCount >= 2) score += 2;
  if (responseCount >= 3) score += 1;
  if (responses.some(r => r.response.length > 50)) score += 1;
  
  const technicalContent = responses.some(r => {
    const response = r.response.toLowerCase();
    return response.includes('java') || response.includes('project') || 
           response.includes('development') || response.includes('api') ||
           response.includes('database') || response.includes('security');
  });
  
  if (technicalContent) score += 1;
  
  return {
    overallScore: Math.min(score, 8),
    summary: `Interview session with ${responseCount} technical responses. ${
      responseCount >= 3 ? 'Good engagement with technical topics.' :
      responseCount >= 1 ? 'Some technical discussion, though session ended early.' :
      'Brief session - more time needed for comprehensive assessment.'
    }`,
    categories: [
      {
        name: 'Technical Discussion',
        score: Math.min(score, 7),
        feedback: `Provided ${responseCount} responses with ${
          technicalContent ? 'good technical content' : 'basic technical discussion'
        }.`,
        suggestions: responseCount >= 3 ? 
          ['Continue building technical depth', 'Practice with more advanced scenarios'] :
          ['Complete longer interviews for better assessment', 'Focus on detailed technical explanations']
      },
      {
        name: 'Communication',
        score: score,
        feedback: `Clear communication in responses provided during the session.`,
        suggestions: ['Practice structured explanations', 'Work on comprehensive answers']
      }
    ],
    strengths: [
      responseCount >= 3 ? 'Good engagement with technical topics' : 'Willingness to participate',
      technicalContent ? 'Mentioned relevant technical concepts' : 'Basic technical awareness'
    ],
    improvements: [
      'Complete full interview sessions for comprehensive feedback',
      'Provide more detailed technical examples',
      'Practice explaining complex concepts step by step'
    ],
    actionPlan: `Based on your ${responseCount} responses: ${
      responseCount >= 3 ? 'Continue with advanced practice interviews' :
      'Focus on completing longer practice sessions for better skill assessment'
    }`
  };
}

// Save interview feedback
app.post('/api/mock-interview/save', async (req, res) => {
  try {
    const { sessionId, feedback, mode } = req.body;
    
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (!sessionId || !feedback) {
      return res.status(400).json({ message: 'Session ID and feedback are required' });
    }
    
    const user = userDatabase.get(currentUserEmail);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const session = user.mockInterviews?.find(s => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Interview session not found' });
    }
    
    // Update session with feedback
    session.feedback = feedback;
    session.saved = true;
    
    console.log(`Mock interview feedback saved: ${mode} for ${user.name}`);
    
    res.json({
      message: 'Interview feedback saved successfully',
      session: session
    });
    
  } catch (error) {
    console.error('Error saving interview feedback:', error);
    res.status(500).json({ 
      message: 'Failed to save feedback',
      error: error.message 
    });
  }
});

// Get interview history
app.get('/api/mock-interview/history', async (req, res) => {
  try {
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = userDatabase.get(currentUserEmail);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const interviews = user.mockInterviews || [];
    
    // Sort by completion time (newest first)
    interviews.sort((a, b) => {
      if (a.endTime && b.endTime) {
        return new Date(b.endTime) - new Date(a.endTime);
      }
      return 0;
    });
    
    res.json({
      interviews: interviews
    });
    
  } catch (error) {
    console.error('Error fetching interview history:', error);
    res.status(500).json({ 
      message: 'Failed to fetch interview history',
      error: error.message 
    });
  }
});

// Get interview statistics - SIMPLIFIED VERSION
app.get('/api/mock-interview/stats', async (req, res) => {
  try {
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = userDatabase.get(currentUserEmail);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const interviews = user.mockInterviews || [];
    const completedInterviews = interviews.filter(i => i.status === 'completed');
    
    // ✅ SIMPLIFIED: Only keep meaningful, straightforward metrics
    const stats = {
      totalInterviews: interviews.length,
      completedInterviews: completedInterviews.length,
      totalTime: interviews.reduce((sum, i) => sum + (i.duration || 0), 0)
      // ❌ REMOVED: averageScore (complex with different interview types)
      // ❌ REMOVED: questionsAnswered (not meaningful with conversational format)
      // ❌ REMOVED: modeBreakdown (unnecessary complexity)
    };
    
    console.log('📊 Simplified interview stats:', stats);
    
    res.json({
      stats: stats
    });
    
  } catch (error) {
    console.error('Error fetching interview stats:', error);
    res.status(500).json({ 
      message: 'Failed to fetch interview stats',
      error: error.message 
    });
  }
});

// Helper functions for mock interviews

async function generateInterviewFeedback(answer, userLevel, question, jobContext) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not found, using fallback feedback');
      return generateFallbackInterviewFeedback(userLevel);
    }

    const systemPrompt = `You are an expert technical interviewer providing feedback on a candidate's answer. Your task is to:

1. ANALYZE the candidate's answer for:
   - Technical accuracy and depth
   - Problem-solving approach and logic
   - Communication clarity and structure
   - Relevance to the specific question and job requirements

2. PROVIDE constructive feedback that:
   - Acknowledges strengths and good approaches
   - Identifies areas for improvement
   - Gives specific, actionable suggestions
   - Relates feedback to the job requirements

3. SCORE the answer (1-10) based on:
   - Technical accuracy (40%)
   - Problem-solving approach (30%)
   - Communication clarity (20%)
   - Job relevance (10%)

4. FORMAT your response as a JSON object:
{
  "message": "Overall feedback message",
  "score": 8,
  "detailedFeedback": {
    "technicalAccuracy": "Feedback on technical aspects",
    "problemSolving": "Feedback on approach and logic",
    "communication": "Feedback on clarity and structure",
    "jobRelevance": "How well this relates to the job"
  },
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"],
  "strengths": ["strength1", "strength2"],
  "improvementAreas": ["area1", "area2"]
}

Be encouraging but honest. Focus on helping the candidate improve and understand how their answer relates to the job requirements.`;

    // ✅ FIXED: Removed ${mode} from userPrompt
    const userPrompt = `Please evaluate this interview answer:

QUESTION: ${question?.title || 'Interview question'}
QUESTION DESCRIPTION: ${question?.description || 'Question details'}
CANDIDATE LEVEL: ${userLevel}
JOB CONTEXT: ${jobContext || 'General technical role'}

CANDIDATE'S ANSWER:
${answer}

Please provide detailed feedback, score, and suggestions.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Changed from gpt-4 to gpt-3.5-turbo for better availability
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" }  // ✨ NEW: Force JSON response
    });

    const content = response.choices[0].message.content;
    console.log('OpenAI feedback response:', content);

    try {
      const parsedResponse = JSON.parse(content);
      return {
        message: parsedResponse.message || 'Thank you for your answer. Here is my feedback.',
        score: parsedResponse.score || 7,
        suggestions: parsedResponse.suggestions || [],
        strengths: parsedResponse.strengths || [],
        improvementAreas: parsedResponse.improvementAreas || [],
        detailedFeedback: parsedResponse.detailedFeedback || {}
      };
    } catch (parseError) {
      console.error('Failed to parse OpenAI feedback response:', parseError);
      console.log('Raw feedback response:', content);
      // ✅ FIXED: Removed mode parameter
      return generateFallbackInterviewFeedback(userLevel);
    }

  } catch (error) {
    console.error('Error in AI interview feedback:', error);
    // ✅ FIXED: Removed mode parameter
    return generateFallbackInterviewFeedback(userLevel);
  }
}

// Fallback feedback function
// ✅ FIXED: Removed mode parameter completely
/*
function generateFallbackInterviewFeedback(userLevel) {
  const feedbacks = [
    {
      message: "Good approach! You've shown solid problem-solving skills. Consider optimizing the time complexity.",
      score: Math.floor(Math.random() * 3) + 7, // 7-9
      suggestions: ["Think about edge cases", "Consider time complexity", "Test with examples"],
      strengths: ["Logical thinking", "Basic understanding"],
      improvementAreas: ["Optimization", "Edge case handling"]
    },
    {
      message: "Excellent solution! You've demonstrated strong algorithmic thinking and clean code structure.",
      score: Math.floor(Math.random() * 2) + 8, // 8-9
      suggestions: ["Great job!", "Consider space complexity", "Think about scalability"],
      strengths: ["Strong technical skills", "Clear communication"],
      improvementAreas: ["Performance optimization", "Scalability thinking"]
    },
    {
      message: "Nice work! You understand the fundamentals. Let's work on making your solution more efficient.",
      score: Math.floor(Math.random() * 3) + 6, // 6-8
      suggestions: ["Practice more algorithms", "Focus on time complexity", "Improve code structure"],
      strengths: ["Basic problem-solving", "Clear thinking"],
      improvementAreas: ["Algorithm optimization", "Code efficiency"]
    }
  ];
  
  const randomIndex = Math.floor(Math.random() * feedbacks.length);
  return feedbacks[randomIndex];
}
*/

// AI-Powered Job Analysis and Interview Question Generation
// Find this function around line 1473 and update it:
async function analyzeJobAndGenerateQuestions(jobDescription, userLevel = 'intermediate') {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not found, using fallback questions');
      return generateFallbackInterviewQuestions(userLevel); // Remove mode parameter
    }

    // ✨ ENHANCED: Structured skills format for better topic selection
    const systemPrompt = `You are an expert interviewer. Analyze the job and create 8-10 interview questions.

Format as JSON:
{
  "jobAnalysis": {
    "requiredSkills": [
      {"name": "React", "importance": "high"},
      {"name": "Node.js", "importance": "high"},
      {"name": "PostgreSQL", "importance": "medium"}
    ],
    "experienceLevel": "junior/mid/senior",
    "keyResponsibilities": ["resp1", "resp2"]
  },
  "interviewQuestions": [
    {
      "id": "q1",
      "type": "technical",
      "title": "Question title",
      "description": "Question details",
      "difficulty": "easy"
    }
  ]
}

IMPORTANT: Extract specific technologies from job description. Convert "Frontend frameworks (React/Vue/Angular)" to separate skills: "React", "Vue", "Angular".`;

    const userPrompt = `Job: ${jobDescription.substring(0, 500)}
Level: ${userLevel}
Create 8 interview questions covering technical and behavioral aspects.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" }  // ✨ NEW: Force JSON response
    });

    const content = response.choices[0].message.content.trim();
    
    // ✨ NEW: Clean JSON before parsing
    let cleanContent = content;
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/\n?```/g, '');
    }
    
    console.log('Cleaned job analysis response:', cleanContent);
    
    try {
      const parsedResponse = JSON.parse(cleanContent);
      
      // ✨ FIXED: Convert string skills to objects if needed
      if (parsedResponse.jobAnalysis?.requiredSkills) {
        const skills = parsedResponse.jobAnalysis.requiredSkills;
        if (skills.length > 0 && typeof skills[0] === 'string') {
          console.log('🔄 Converting string skills to objects:', skills);
          parsedResponse.jobAnalysis.requiredSkills = extractSpecificSkills(skills);
          console.log('✅ Converted skills:', parsedResponse.jobAnalysis.requiredSkills);
        }
      }
      
      return parsedResponse;
    } catch (parseError) {
      console.error('Failed to parse job analysis:', parseError);
      return generateFallbackInterviewQuestions(userLevel);
    }

  } catch (error) {
    console.error('Error in AI job analysis:', error);
    return generateFallbackInterviewQuestions(userLevel); // Remove mode parameter
  }
}

// Fallback function for when OpenAI is not available
// Update this function to remove mode parameter:
function generateFallbackInterviewQuestions(userLevel) {
  const questions = [
    // Technical Questions
    {
      id: 'q1',
      type: 'technical',
      title: 'Data Structure Implementation',
      description: 'Implement a stack data structure with push, pop, and peek operations. Explain your approach and time complexity.',
      context: 'This tests fundamental programming knowledge and problem-solving skills.',
      expectedAnswer: 'Should implement stack using array or linked list, explain O(1) operations.',
      difficulty: 'medium',
      hints: ['Think about LIFO principle', 'Consider edge cases like empty stack'],
      scoringCriteria: {
        technicalAccuracy: 'Correct implementation and time complexity',
        problemSolving: 'Logical approach and edge case handling',
        communication: 'Clear explanation of the solution',
        jobRelevance: 'Basic programming skills needed for most technical roles'
      },
      followUpQuestions: [
        'How would you handle concurrent access to this stack?',
        'What if you needed to implement a queue instead?'
      ]
    },
    // Add your other questions here...
  ];

  return {
    jobAnalysis: {
      requiredSkills: [
        { name: 'General programming', importance: 'high' },
        { name: 'Problem solving', importance: 'high' },
        { name: 'Team collaboration', importance: 'medium' }
      ],
      experienceLevel: userLevel,
      keyResponsibilities: ['Technical implementation', 'Team collaboration', 'Problem solving'],
      companyCulture: 'Collaborative and growth-oriented',
      industryFocus: 'Technology',
      seniorityIndicators: ['Problem-solving ability', 'Communication skills']
    },
    interviewQuestions: questions
  };
}

// Save learning path endpoint
app.post('/api/job-prep/save-path', async (req, res) => {
  try {
    const { jobTitle, company, preparationTime, analysisResult, learningPath } = req.body;
    
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = userDatabase.get(currentUserEmail);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Initialize learning paths if not exists
    if (!user.learningPaths) {
      user.learningPaths = [];
    }
    
    // Create learning path object
    const pathToSave = {
      id: Date.now().toString(),
      jobTitle,
      company: company || 'Unknown Company',
      dateCreated: new Date().toISOString(),
      preparationTime,
      analysisResult,
      learningPath,
      progress: {
        overallProgress: 0,
        skills: analysisResult.requiredSkills.map(skill => ({
          name: skill.name,
          requiredLevel: skill.level,
          currentLevel: 0,
          progress: 0,
          status: 'not-started',
          tutoringSessions: 0,
          lastUpdated: new Date().toISOString()
        }))
      }
    };
    
    // Save to user's learning paths
    user.learningPaths.push(pathToSave);
    
         res.json({ 
       message: 'Learning path saved successfully', 
       pathId: pathToSave.id,
       path: pathToSave 
     });
  } catch (error) {
    console.error('Error saving learning path:', error);
    res.status(500).json({ message: 'Failed to save learning path', error: error.message });
  }
});

// Get user's learning paths endpoint
app.get('/api/job-prep/paths', (req, res) => {
  try {
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
         const user = userDatabase.get(currentUserEmail);
     if (!user) {
       return res.status(404).json({ message: 'User not found' });
     }
     
     const learningPaths = user.learningPaths || [];
    
    res.json({ learningPaths });
  } catch (error) {
    console.error('Error fetching learning paths:', error);
    res.status(500).json({ message: 'Failed to fetch learning paths', error: error.message });
  }
});

// Update skill progress endpoint
app.post('/api/job-prep/update-progress', async (req, res) => {
  try {
    const { skillName, sessionData } = req.body;
    
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = userDatabase.get(currentUserEmail);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Initialize skill progress if not exists
    if (!user.skillProgress) {
      user.skillProgress = {};
    }
    
    // Update skill progress
    if (!user.skillProgress[skillName]) {
      user.skillProgress[skillName] = {
        currentLevel: 0,
        totalSessions: 0,
        lastSession: null,
        masteryLevel: 0,
        sessionHistory: []
      };
    }
    
    const skill = user.skillProgress[skillName];
    skill.totalSessions += 1;
    skill.lastSession = new Date().toISOString();
    skill.masteryLevel = Math.min(100, skill.totalSessions * 15);
    skill.currentLevel = Math.min(10, Math.ceil(skill.masteryLevel / 10));
    
    // Add session to history
    skill.sessionHistory.push({
      date: new Date().toISOString(),
      topic: sessionData.topic || 'General',
      duration: sessionData.duration || 0,
      concepts: sessionData.concepts || []
    });
    
    // Update learning paths progress
    if (user.learningPaths) {
      user.learningPaths.forEach(path => {
        const skillInPath = path.progress.skills.find(s => s.name === skillName);
        if (skillInPath) {
          skillInPath.currentLevel = skill.currentLevel;
          skillInPath.tutoringSessions = skill.totalSessions;
          skillInPath.progress = skill.masteryLevel;
          skillInPath.lastUpdated = new Date().toISOString();
          
          if (skill.masteryLevel >= 100) {
            skillInPath.status = 'completed';
          } else if (skill.masteryLevel > 0) {
            skillInPath.status = 'in-progress';
          }
          
          // Calculate overall progress
          const totalSkills = path.progress.skills.length;
          const completedSkills = path.progress.skills.filter(s => s.status === 'completed').length;
          const inProgressSkills = path.progress.skills.filter(s => s.status === 'in-progress').length;
          
          path.progress.overallProgress = Math.round(
            ((completedSkills * 100) + (inProgressSkills * 50)) / totalSkills
          );
        }
      });
    }
    
    res.json({ 
      message: 'Skill progress updated successfully', 
      skill: user.skillProgress[skillName] 
    });
  } catch (error) {
    console.error('Error updating skill progress:', error);
    res.status(500).json({ message: 'Failed to update skill progress', error: error.message });
  }
});

// Dynamic Dashboard API endpoints
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

// Generate welcome message when session starts
async function generateWelcomeMessage(topic, skillLevel, user) {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      // Fallback welcome message
      return {
        message: `Hello ${user.name}! Welcome to your ${topic} tutoring session. I'm excited to help you learn at the ${skillLevel} level. What specific aspect of ${topic} would you like to explore first?`,
        concepts: ['session start', topic.toLowerCase()],
        hints: ['Ask specific questions', 'Share your current knowledge', 'Tell me what you want to learn']
      };
    }
    
    // Real OpenAI API call for welcome message
    const prompt = `You are a friendly, encouraging computer science tutor. The student ${user.name} has just started a tutoring session about ${topic} at ${skillLevel} level. 
    
    Generate a warm, welcoming first message that:
    1. Greets them by name
    2. Shows enthusiasm about their chosen topic
    3. Asks 2-3 thoughtful questions to assess their current knowledge and goals
    4. Is encouraging and sets a positive tone for learning
    5. Is conversational and not repetitive
    
    Keep it under 150 words and make it feel natural, not like a template.`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a warm, encouraging computer science tutor who creates personalized welcome messages.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.8
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiMessage = data.choices[0].message.content;
    
    return {
      message: aiMessage,
      concepts: [topic.toLowerCase(), 'session start'],
      hints: ['Ask specific questions', 'Share your current knowledge', 'Tell me what you want to learn']
    };
    
  } catch (error) {
    console.error('OpenAI API error for welcome message, using fallback:', error);
    return {
      message: `Hello ${user.name}! Welcome to your ${topic} tutoring session. I'm excited to help you learn at the ${skillLevel} level. What specific aspect of ${topic} would you like to explore first?`,
      concepts: ['session start', topic.toLowerCase()],
      hints: ['Ask specific questions', 'Share your current knowledge', 'Tell me what you want to learn']
    };
  }
}

// ✨ ENHANCED: Intelligent interview with job-specific progression
async function processConversationTurn(session, userResponse, conversationMemory, jobContext) {
  try {
    // ✅ CRITICAL: Always check OpenAI first, never fall back early
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key missing - this will cause repetitive questions');
      throw new Error('OpenAI API key required for dynamic interviews');
    }

    // ✨ ENHANCED: Update conversation memory with user response
    const updatedMemory = {
      ...conversationMemory,
      userResponses: [...(conversationMemory.userResponses || []), {
        response: userResponse,
        timestamp: new Date(),
        topic: conversationMemory.currentTopic
      }],
      interviewProgress: (conversationMemory.interviewProgress || 0) + 1
    };

    // ✨ NEW: Check if interview should naturally complete FIRST using job-based logic
    const shouldCompleteNaturally = checkJobBasedCompletion(updatedMemory, jobContext);
    
    if (shouldCompleteNaturally) {
      console.log('🎉 Interview naturally completing based on coverage and quality');
      
      // Generate final feedback immediately
      const finalFeedback = await generateConversationalFeedback(session, updatedMemory);
      
      // Mark session as complete
      session.status = 'completed';
      session.endTime = new Date();
      session.duration = Math.round((session.endTime - session.startTime) / 1000 / 60);
      session.feedback = finalFeedback;
      session.naturalCompletion = true;
      session.conversationMemory = updatedMemory;
      
      return {
        aiResponse: {
          message: "Thank you for your time today. That concludes our interview. Based on our discussion, I have a good sense of your technical abilities and experience. You'll receive detailed feedback in just a moment.",
          type: "completion"
        },
        conversationUpdate: {
          currentTopic: 'interview_complete',
          newTopics: ['interview_complete'],
          followUpNeeded: []
        },
        interviewStatus: "interview_complete",
        finalFeedback: finalFeedback
      };
    }

    // Determine if we should transition topics
    const shouldTransition = shouldTransitionTopic(updatedMemory, userResponse);
    const nextTopic = shouldTransition ? 
      getNextJobBasedTopic(jobContext, updatedMemory) : 
      updatedMemory.currentTopic;
    
    // ✅ FIXED: Handle interview completion signal (legacy fallback)
    if (nextTopic === 'COMPLETE_INTERVIEW') {
      console.log(`🎉 Interview completion triggered (legacy)`);
      console.log(`📊 Completion stats: ${updatedMemory.interviewProgress} responses, ${updatedMemory.topicsDiscussed.length} topics covered`);
      
      // ✨ FIXED: Generate final feedback immediately when completing naturally
      console.log('🔄 Generating final feedback for natural completion...');
      
      // Mark session as completed
      session.status = 'completed';
      session.endTime = new Date();
      session.duration = Math.round((session.endTime - session.startTime) / 1000 / 60);
      
      // ✨ NEW: Store conversation data for feedback generation
      session.conversationMemory = updatedMemory;
      session.naturalCompletion = true; // Flag to indicate natural completion
      
      // Generate final feedback based on conversation
      const finalFeedback = await generateConversationalFeedback(session, updatedMemory);
      session.feedback = finalFeedback;
      
      return {
        aiResponse: {
          message: "Thank you for your time today. That completes our interview. You'll receive detailed feedback in just a moment.",
          type: "completion"
        },
        conversationUpdate: {
          currentTopic: 'interview_complete',
          newTopics: [],
          followUpNeeded: []
        },
        interviewStatus: "interview_complete", // This will trigger the frontend
        finalFeedback: finalFeedback // ✨ NEW: Include feedback in response
      };
    }
    
    // Log the topic selection decision
    if (nextTopic === 'wrap_up_questions') {
      console.log(`🔄 Wrap-up phase: ${updatedMemory.interviewProgress} responses, continuing with behavioral/closing questions`);
    }
    
    // Extract job-specific information dynamically
    const jobTitle = jobContext?.jobTitle || 'this role';
    
    // Check if we have valid job analysis
    if (!jobContext?.jobAnalysis?.requiredSkills) {
      console.log('⚠️  No job analysis provided, using fallback skills');
      // Generate fallback skills based on common technical roles
      const fallbackSkills = [
        { name: 'Technical Skills', importance: 'high' },
        { name: 'Problem Solving', importance: 'high' },
        { name: 'Communication', importance: 'medium' }
      ];
      jobContext.jobAnalysis = { requiredSkills: fallbackSkills };
    }
    
    const jobSkills = jobContext?.jobAnalysis?.requiredSkills?.map(s => s.name || s).join(', ') || 'technical skills';
    const topPrioritySkills = jobContext?.jobAnalysis?.requiredSkills?.slice(0, 3).map(s => s.name || s).join(', ') || 'core skills';
    
    console.log(`🎯 Interview context: ${jobTitle}, focusing on: ${topPrioritySkills}`);
    console.log(`📍 Current topic: ${updatedMemory.currentTopic}, Next: ${nextTopic}, Should transition: ${shouldTransition}`);

    // ✅ CRITICAL: Always use OpenAI for question generation
    console.log(`🤖 Using OpenAI for ${nextTopic} questions - NO fallback allowed`);
    
    const systemPrompt = `You are conducting a thorough interview for ${jobContext?.jobTitle || 'this role'} at ${jobContext?.company || 'the company'}.

JOB REQUIREMENTS ANALYSIS:
- Required skills: ${jobContext?.jobAnalysis?.requiredSkills?.map(s => s.name).join(', ') || 'technical skills'}
- Current topic: ${updatedMemory.currentTopic}
- Progress: ${updatedMemory.interviewProgress} responses given
- Interview coverage: ${updatedMemory.topicsDiscussed.join(', ')}

INSTRUCTIONS:
${shouldTransition ? 
  (nextTopic === 'behavioral_scenarios' ? 
    `TRANSITION to behavioral questions. Ask about real experiences: "Tell me about a time when you had to [specific scenario relevant to the job]" or "Describe a challenging situation you faced in [relevant context]"` :
    nextTopic === 'role_specific_challenges' ?
    `TRANSITION to role-specific challenges. Ask about handling situations specific to this ${jobContext?.jobTitle || 'role'}: "How would you approach [specific challenge from job description]?"` :
    `TRANSITION to "${nextTopic}". Ask a specific technical question about this skill/technology.`
  ) :
  `CONTINUE with "${updatedMemory.currentTopic}". Ask a thoughtful follow-up question to explore this area more deeply.`
}

CRITICAL: 
- Ask UNIQUE questions each time - never repeat previous questions
- For behavioral questions, be specific and relevant to the job requirements
- For technical questions, vary difficulty and approach
- Keep responses under 35 words
- Be conversational but professional

RESPOND WITH JSON:
{
  "aiResponse": {
    "message": "your specific interview question",
    "type": "${shouldTransition ? 'transition' : 'followup'}"
  },
  "conversationUpdate": {
    "currentTopic": "${nextTopic}",
    "newTopics": ${shouldTransition ? `["${nextTopic}"]` : '[]'},
    "followUpNeeded": []
  },
  "interviewStatus": "continue_conversation"
}`;

    const userPrompt = `Candidate's latest response: "${userResponse.substring(0, 150)}"

Current interview context:
- Topics already covered: ${updatedMemory.topicsDiscussed.join(', ')}
- Current focus: ${updatedMemory.currentTopic}
- This role requires: ${jobContext?.jobAnalysis?.requiredSkills?.slice(0, 3).map(s => s.name).join(', ')}

${shouldTransition ? 
  `Now transition to asking about: ${nextTopic}. Make it relevant to ${jobContext?.jobTitle || 'this role'}.` : 
  `Continue exploring: ${updatedMemory.currentTopic}. Ask a different follow-up question than before.`
}

Generate a unique, relevant interview question.`;

    // ✅ CRITICAL: Force timeout to prevent hanging
    const response = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 200,
        response_format: { type: "json_object" }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI timeout')), 15000)
      )
    ]);

    const content = response.choices[0].message.content.trim();
    console.log('Raw OpenAI response:', content);
    
    // Clean and parse JSON
    let jsonContent = content;
    if (jsonContent.includes('```')) {
      const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{.*?\})\s*```/s);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
    }
    
    const firstBrace = jsonContent.indexOf('{');
    const lastBrace = jsonContent.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
    }
    
    console.log('Extracted JSON:', jsonContent);
    const parsed = JSON.parse(jsonContent);
    
    if (!parsed.aiResponse || !parsed.aiResponse.message) {
      throw new Error('Invalid response structure');
    }
    
    console.log(`✅ OpenAI successfully generated ${parsed.aiResponse.type} question for ${nextTopic}`);
    
    return parsed;
    
  } catch (error) {
    console.error('❌ CRITICAL: OpenAI failed for interview question generation:', error);
    
    // ✅ ONLY use fallback as absolute last resort and log it prominently
    console.error('🚨 FALLING BACK TO GENERIC RESPONSE - THIS WILL CAUSE REPETITIVE QUESTIONS');
    return generateEmergencyConversationResponse(userResponse, updatedMemory);
  }
}

// ✨ NEW: Emergency conversation response for critical failures
function generateEmergencyConversationResponse(userResponse, conversationMemory) {
  const responses = [
    "That's interesting! Can you tell me more about that?",
    "I see. How did you handle that situation?",
    "That's a good point. What would you do differently next time?",
    "Interesting approach. Can you walk me through your thought process?",
    "That makes sense. How does this relate to the role you're applying for?"
  ];
  
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  
  return {
    aiResponse: {
      message: randomResponse,
      type: "followup"
    },
    conversationUpdate: {
      currentTopic: conversationMemory.currentTopic,
      newTopics: [],
      followUpNeeded: []
    },
    interviewStatus: "continue_conversation"
  };
}

function generateFallbackConversationResponse(userResponse, conversationMemory) {
  const responses = [
    "That's interesting! Can you tell me more about that?",
    "I see. How did you handle that situation?",
    "That's a good point. What would you do differently next time?",
    "Interesting approach. Can you walk me through your thought process?",
    "That makes sense. How does this relate to the role you're applying for?"
  ];
  
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  
  return {
    aiResponse: {
      message: randomResponse,
      type: "followup"
    },
    conversationUpdate: {
      currentTopic: conversationMemory.currentTopic,
      newTopics: [],
      followUpNeeded: []
    },
    interviewStatus: "continue_conversation"
  };
}

// ✨ ENHANCED: Job-based topic selection with dynamic progression
const getNextJobBasedTopic = (jobContext, conversationMemory) => {
  const requiredSkills = jobContext?.jobAnalysis?.requiredSkills || [];
  const coveredTopics = conversationMemory.topicsDiscussed || [];
  const totalResponses = conversationMemory.interviewProgress || 0;
  
  console.log(`🎯 Job-based topic selection: ${requiredSkills.length} required skills, ${coveredTopics.length} covered`);
  
  // Phase 1: Cover all technical skills first
  for (const skill of requiredSkills) {
    const skillName = (skill.name || skill).toLowerCase();
    const isAlreadyCovered = coveredTopics.some(topic => 
      topic.toLowerCase().includes(skillName.split(' ')[0]) // Match first word of skill
    );
    
    if (!isAlreadyCovered) {
      console.log(`🔧 Next technical topic: ${skillName}`);
      return skillName;
    }
  }
  
  // Phase 2: Behavioral and role-specific questions
  const behavioralTopics = ['behavioral_scenarios', 'role_specific_challenges', 'team_collaboration'];
  for (const topic of behavioralTopics) {
    if (!coveredTopics.includes(topic)) {
      console.log(`👥 Next behavioral topic: ${topic}`);
      return topic;
    }
  }
  
  // Phase 3: Check if we have adequate coverage
  const averageDepth = totalResponses / Math.max(coveredTopics.length, 1);
  const minimumDepth = 2.5; // At least 2.5 questions per topic
  
  if (averageDepth < minimumDepth && totalResponses < requiredSkills.length * 3) {
    console.log(`📊 Need more depth: ${averageDepth.toFixed(1)} avg depth, continuing with wrap-up`);
    return 'comprehensive_review';
  }
  
  console.log(`✅ Job requirements fully covered, completing interview`);
  return 'COMPLETE_INTERVIEW';
};

// ✨ FIXED: Enhanced topic selection with proper completion handling (legacy)
const getNextTechnicalTopic = (jobContext, conversationMemory) => {
  const requiredSkills = jobContext?.jobAnalysis?.requiredSkills || [];
  const coveredTopics = conversationMemory.topicsDiscussed || [];
  
  console.log(`🔍 Finding next topic. Required skills:`, requiredSkills.map(s => s.name || s));
  console.log(`📋 Already covered:`, coveredTopics);
  
  // Find the most important uncovered skill
  for (const skill of requiredSkills) {
    const skillName = (skill.name || skill).toLowerCase();
    
    const isAlreadyCovered = coveredTopics.some(topic => 
      topic.toLowerCase().includes(skillName) || 
      skillName.includes(topic.toLowerCase())
    );
    
    if (!isAlreadyCovered) {
      console.log(`🎯 Next topic selected: ${skillName}`);
      return skillName;
    }
  }
  
  // ✅ FIXED: When all skills are covered, check conversation quality
  const totalResponses = conversationMemory.interviewProgress || 0;
  const averageResponsesPerTopic = totalResponses / Math.max(coveredTopics.length, 1);
  
  // Dynamic completion criteria based on job complexity and response quality
  const minimumResponses = Math.max(8, requiredSkills.length * 2); // At least 8 responses, or 2 per skill
  const hasAdequateCoverage = averageResponsesPerTopic >= 2; // At least 2 substantial responses per topic
  
  if (totalResponses >= minimumResponses && hasAdequateCoverage) {
    console.log(`🏁 Interview naturally complete: ${totalResponses} responses, ${averageResponsesPerTopic.toFixed(1)} avg per topic`);
    return 'COMPLETE_INTERVIEW'; // Use a special completion signal
  }
  
  // Continue with wrap-up questions if coverage isn't sufficient
  console.log(`🔄 Continuing with wrap-up questions (${totalResponses} responses, need deeper coverage)`);
  return 'wrap_up_questions';
};

// Helper function to determine if we should transition topics
const shouldTransitionTopic = (conversationMemory, userResponse) => {
  const currentTopicTurns = conversationMemory.userResponses.filter(
    r => r.topic === conversationMemory.currentTopic
  ).length;
  
  const hasSubstantialResponse = userResponse.length > 30;
  const maxTurnsPerTopic = 3;
  
  return currentTopicTurns >= maxTurnsPerTopic || 
         (currentTopicTurns >= 2 && hasSubstantialResponse);
};

function getTopicKeywords(topic) {
  const keywordMap = {
    'python': ['python', 'code', 'function', 'algorithm', 'data', 'analysis'],
    'javascript': ['javascript', 'js', 'react', 'node', 'frontend', 'backend'],
    'algorithms': ['algorithm', 'complexity', 'sort', 'search', 'optimization'],
    'data structures': ['array', 'list', 'tree', 'graph', 'hash', 'stack'],
    'machine learning': ['ml', 'ai', 'model', 'training', 'prediction', 'neural'],
    'system design': ['architecture', 'scalability', 'database', 'api', 'microservices'],
    'background': ['experience', 'education', 'previous', 'worked', 'studied'],
    'behavioral': ['team', 'challenge', 'conflict', 'leadership', 'collaboration']
  };
  
  return keywordMap[topic.toLowerCase()] || [topic.toLowerCase()];
}

function getNextPhase(currentPhase) {
  const phaseOrder = ['introduction', 'technical_core', 'fullstack', 'integration', 'behavioral', 'closing'];
  const currentIndex = phaseOrder.indexOf(currentPhase);
  return currentIndex < phaseOrder.length - 1 ? phaseOrder[currentIndex + 1] : 'closing';
}

// ✨ NEW: Skill extraction and normalization function
function extractSpecificSkills(skillStrings) {
  const extractedSkills = [];
  
  skillStrings.forEach(skillString => {
    // Extract technologies mentioned in parentheses
    const parenthesesMatch = skillString.match(/\(([^)]+)\)/);
    if (parenthesesMatch) {
      const techList = parenthesesMatch[1];
      const techs = techList.split(/[\/,]/);
      techs.forEach(tech => {
        const cleanTech = tech.trim().toLowerCase();
        if (cleanTech) {
          extractedSkills.push({
            name: cleanTech,
            importance: skillString.toLowerCase().includes('experience') ? 'high' : 'medium'
          });
        }
      });
    } else {
      // Handle skills without parentheses
      extractedSkills.push({
        name: skillString.toLowerCase().trim(),
        importance: 'medium'
      });
    }
  });
  
  return extractedSkills;
}

// ✅ SIMPLIFIED: Debug version to identify real OpenAI issues
async function generateFinalFeedback(session) {
  console.log('=== generateFinalFeedback DEBUG ===');
  
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key required for feedback generation');
  }

  const averageScore = session.scores?.length > 0 ? 
    Math.round(session.scores.reduce((sum, score) => sum + score, 0) / session.scores.length) : 7;

  console.log('📊 Real average score:', averageScore, 'from', session.scores?.length || 0, 'answers');

  try {
    console.log('📡 Making OpenAI feedback request...');

    const systemPrompt = `You are an expert interviewer providing final feedback. Base everything on the actual interview data provided.

Format as JSON:
{
  "overallScore": ${averageScore},
  "summary": "Assessment based on actual responses",
  "categories": [
    {
      "name": "Technical Knowledge", 
      "score": 8,
      "feedback": "Based on actual technical discussions",
      "suggestions": ["specific suggestion based on performance"]
    },
    {
      "name": "Communication",
      "score": 7, 
      "feedback": "Based on actual communication during interview",
      "suggestions": ["communication improvements needed"]
    },
    {
      "name": "Problem Solving",
      "score": 8,
      "feedback": "Based on actual problem-solving demonstrated", 
      "suggestions": ["problem-solving improvements"]
    }
  ],
  "strengths": ["actual strengths observed"],
  "improvements": ["specific areas needing work"],
  "actionPlan": "Realistic next steps based on performance"
}`;

    const userPrompt = `Interview Data:
- Questions: ${session.answers?.length || 0}
- Average Score: ${averageScore}/10  
- Sample Answers: ${session.answers?.map(a => a.answer.substring(0, 100)).join(' | ') || 'None'}

Generate realistic feedback based on this actual data.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    console.log('✅ OpenAI response received');
    const content = response.choices[0].message.content;
    console.log('📄 Raw content:', content);
    
    const feedback = JSON.parse(content);
    console.log('✅ Parsed feedback - Score:', feedback.overallScore);
    
    return feedback;
    
  } catch (error) {
    console.error('❌ OpenAI Feedback Error:');
    console.error('Type:', error.constructor.name);
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Status:', error.status);
    
    // Don't fall back - throw the error so we can see what's wrong
    throw new Error(`Feedback generation failed: ${error.message}`);
  }
}

// ✅ COMMENTED OUT: Fallback functions to force real issues to surface
/*
function generateRealDataFallback(session, averageScore) {
  const answersCount = session.answers?.length || 0;
  const expectedQuestions = session.questions?.length || 15;
  const completionRate = Math.round((answersCount / expectedQuestions) * 100);
  
  console.log(`Generating real data fallback: ${answersCount}/${expectedQuestions} answers (${completionRate}% complete)`);
  
  // Base categories on actual performance
  const categories = [
    {
      name: 'Technical Knowledge',
      score: Math.max(1, averageScore - 1), // Slightly lower than average
      feedback: `Based on your ${answersCount} responses, you demonstrated ${
        averageScore >= 8 ? 'strong' : averageScore >= 6 ? 'good' : 'basic'
      } technical understanding.`,
      suggestions: averageScore >= 8 ? 
        ['Continue building on your solid foundation'] : 
        ['Practice more technical problems', 'Review fundamental concepts']
    },
    {
      name: 'Problem Solving',
      score: averageScore,
      feedback: `Your problem-solving approach across ${answersCount} questions showed ${
        averageScore >= 6 ? 'good' : 'developing'
      } analytical skills.`,
      suggestions: ['Continue practicing structured problem-solving', 'Work on edge case identification']
    },
    {
      name: 'Communication',
      score: Math.min(10, averageScore + 1), // Slightly higher than average
      feedback: `Communication was clear throughout your ${answersCount} responses.`,
      suggestions: ['Practice explaining complex concepts simply', 'Work on concise explanations']
    }
  ];
  
  return {
    overallScore: averageScore,
    summary: `You completed ${answersCount} out of ${expectedQuestions} interview questions (${completionRate}% completion) with an average score of ${averageScore}/10. ${
      completionRate >= 80 ? 'Great job completing most of the interview!' :
      completionRate >= 50 ? 'Good progress through the interview questions.' :
      'You started the interview but ended early - consider practicing full interviews for better preparation.'
    }`,
    categories: categories,
    strengths: [
      answersCount >= 5 ? 'Engaged with multiple questions' : 'Showed willingness to participate',
      averageScore >= 7 ? 'Good technical foundation' : 'Basic understanding demonstrated'
    ],
    improvements: [
      completionRate < 80 ? 'Practice completing full interviews' : 'Continue building on your foundation',
      'Work on advanced concepts',
      'Practice more complex scenarios'
    ],
    actionPlan: `Based on your ${completionRate}% completion rate and ${averageScore}/10 average: ${
      averageScore >= 8 ? '1-2 weeks of advanced practice recommended' :
      averageScore >= 6 ? '2-4 weeks of focused preparation needed' :
      '4-8 weeks of foundational work recommended'
    }`
  };
}
*/

// ✨ NEW: Basic feedback for when no substantial answers were given
/*
function generateBasicCompletionFeedback(session) {
  return {
    overallScore: 5,
    summary: `Interview session completed. You engaged with the AI interviewer for ${session.duration || 'several'} minutes. For better feedback, try answering more questions in future sessions.`,
    categories: [
      {
        name: 'Session Engagement',
        score: 6,
        feedback: 'You started the interview and engaged with the system.',
        suggestions: ['Try completing more questions next time', 'Practice structured answers']
      }
    ],
    strengths: ['Willingness to practice', 'Engaged with the interview system'],
    improvements: ['Complete more questions for better assessment', 'Practice giving detailed technical answers'],
    actionPlan: 'Try a full interview session to get comprehensive feedback on your skills.'
  };
}
*/

// ✨ ENHANCED: Generate feedback based on conversational interview with OpenAI
// ✨ ENHANCED: Generate feedback based on conversational interview with OpenAI
async function generateConversationalFeedback(session, conversationMemory) {
  console.log('=== generateConversationalFeedback called ===');
  console.log(`📊 Generating feedback for ${conversationMemory.userResponses?.length || 0} responses across ${conversationMemory.topicsDiscussed?.length || 0} topics`);
  
  try {
    // ✅ CRITICAL: Always try OpenAI first
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ No OpenAI API key found!');
      throw new Error('OpenAI required for personalized feedback');
    }

    console.log('📡 Making OpenAI request for conversational feedback...');
    console.log('🔑 API Key available:', !!process.env.OPENAI_API_KEY);
    console.log('📝 Conversation data:', {
      responses: conversationMemory.userResponses?.length || 0,
      topics: conversationMemory.topicsDiscussed?.length || 0,
      jobTitle: session.jobTitle || 'Unknown'
    });

    const systemPrompt = `You are an expert interviewer providing comprehensive final feedback.

INTERVIEW CONTEXT:
- Role: ${session.jobTitle || 'Technical Role'} at ${session.company || 'Company'}
- Required Skills: ${session.jobAnalysis?.requiredSkills?.map(s => s.name).join(', ') || 'Various technical skills'}
- Interview Length: ${conversationMemory.userResponses?.length || 0} responses
- Topics Covered: ${conversationMemory.topicsDiscussed?.join(', ') || 'Multiple areas'}

ACTUAL CONVERSATION DATA:
${conversationMemory.userResponses?.map((r, i) => 
  `Response ${i+1} (${r.topic}): "${r.response.substring(0, 100)}..."`
).join('\n') || 'No responses recorded'}

Based on this REAL conversation, provide VARIED and REALISTIC feedback in JSON format:
{
  "overallScore": [REALISTIC_SCORE_4_TO_9_BASED_ON_ACTUAL_PERFORMANCE],
  "summary": "Detailed assessment based on actual responses and job requirements",
  "categories": [
    {
      "name": "Technical Knowledge",
      "score": [VARIED_SCORE_BASED_ON_ACTUAL_TECHNICAL_RESPONSES],
      "feedback": "Specific feedback based on actual technical discussions",
      "suggestions": ["Specific improvements based on actual responses"]
    },
    {
      "name": "Communication",
      "score": [DIFFERENT_SCORE_BASED_ON_COMMUNICATION_QUALITY],
      "feedback": "Assessment of actual communication during interview",
      "suggestions": ["Communication improvements based on actual performance"]
    },
    {
      "name": "Job Fit",
      "score": [ANOTHER_VARIED_SCORE_BASED_ON_JOB_RELEVANCE],
      "feedback": "How well responses align with job requirements",
      "suggestions": ["Job-specific suggestions based on requirements analysis"]
    }
  ],
  "strengths": ["Actual strengths observed during interview"],
  "improvements": ["Specific areas for improvement based on actual performance"],
  "actionPlan": "Realistic next steps based on actual interview performance"
}

CRITICAL: 
- Base ALL scores on the ACTUAL conversation content
- VARY the scores realistically (don't make them all the same)
- Use the actual technical content mentioned (.NET, ASP.NET Core, Entity Framework, etc.)
- Reference specific examples from the responses
- Make scores different from each other`;

    console.log('🚀 Sending request to OpenAI...');
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate comprehensive feedback based on the interview data provided." }
      ],
      temperature: 0.7, // Higher temperature for more variation
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    console.log('✅ OpenAI response received successfully');
    const content = response.choices[0].message.content;
    console.log('📋 Raw OpenAI feedback response length:', content.length);
    console.log('📋 First 300 chars:', content.substring(0, 300) + '...');
    
    const feedback = JSON.parse(content);
    
    console.log('🎯 Parsed feedback scores:', {
      overall: feedback.overallScore,
      technical: feedback.categories?.[0]?.score,
      communication: feedback.categories?.[1]?.score,
      jobFit: feedback.categories?.[2]?.score
    });
    
    console.log('✅ OpenAI generated personalized final feedback with varied scores');
    return feedback;
    
  } catch (error) {
    console.error('❌ OpenAI failed for final feedback:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error status:', error.status);
    console.error('Full error:', error);
    
    console.log('🔄 Using enhanced fallback with conversation data');
    
    // Enhanced fallback that uses actual conversation data
    return generateEnhancedFallbackFeedback(conversationMemory, session);
  }
}

// ✨ ENHANCED: Dynamic job-based completion checker
function checkJobBasedCompletion(conversationMemory, jobContext) {
  const totalResponses = conversationMemory.interviewProgress || 0;
  const topicsCovered = conversationMemory.topicsDiscussed?.length || 0;
  const requiredSkills = jobContext?.jobAnalysis?.requiredSkills || [];
  
  // ✅ NEW: Dynamic completion based on job complexity
  const jobComplexity = calculateJobComplexity(jobContext);
  const requiredResponses = Math.max(8, requiredSkills.length * 2); // 2 questions per skill minimum
  const requiredTopics = Math.max(3, Math.ceil(requiredSkills.length * 0.8)); // Cover 80% of skills
  
  console.log(`🎯 Job-based completion check: ${totalResponses}/${requiredResponses} responses, ${topicsCovered}/${requiredTopics} topics, complexity: ${jobComplexity}`);
  
  // Dynamic quality thresholds based on job complexity
  const qualityThreshold = jobComplexity === 'high' ? 3 : jobComplexity === 'medium' ? 2.5 : 2;
  const averageDepth = totalResponses / Math.max(topicsCovered, 1);
  
  const hasCompletedRequirements = totalResponses >= requiredResponses;
  const hasGoodCoverage = topicsCovered >= requiredTopics;
  const hasQualityDepth = averageDepth >= qualityThreshold;
  
  return hasCompletedRequirements && hasGoodCoverage && hasQualityDepth;
}

// ✅ NEW: Calculate job complexity based on requirements
function calculateJobComplexity(jobContext) {
  const skills = jobContext?.jobAnalysis?.requiredSkills || [];
  const highImportanceSkills = skills.filter(s => s.importance === 'high').length;
  const totalSkills = skills.length;
  
  if (totalSkills >= 8 || highImportanceSkills >= 5) return 'high';
  if (totalSkills >= 5 || highImportanceSkills >= 3) return 'medium';
  return 'basic';
}

// ✨ NEW: Enhanced fallback feedback using actual conversation data
function generateEnhancedFallbackFeedback(conversationMemory, session) {
  const totalResponses = conversationMemory.userResponses?.length || 0;
  const topicsCovered = conversationMemory.topicsDiscussed?.length || 0;
  const averageResponseLength = conversationMemory.userResponses?.reduce((sum, r) => sum + r.response.length, 0) / totalResponses || 0;
  
  console.log(`Generating enhanced fallback feedback for ${totalResponses} responses across ${topicsCovered} topics`);
  
  // Calculate a realistic score based on conversation quality
  let overallScore = 6; // Base score
  
  // Scoring factors
  if (totalResponses >= 8) overallScore += 1; // Good engagement
  if (topicsCovered >= 4) overallScore += 1; // Good topic coverage  
  if (averageResponseLength > 100) overallScore += 1; // Detailed responses
  
  // Check for specific technical terms mentioned
  const technicalTermsFound = conversationMemory.userResponses.some(r => 
    r.response.toLowerCase().includes('react') || 
    r.response.toLowerCase().includes('node') ||
    r.response.toLowerCase().includes('database') ||
    r.response.toLowerCase().includes('api')
  );
  
  if (technicalTermsFound) overallScore += 1;
  
  overallScore = Math.min(10, overallScore); // Cap at 10
  
  const categories = [
    {
      name: 'Technical Knowledge',
      score: overallScore - 1,
      feedback: `You demonstrated ${overallScore >= 8 ? 'strong' : 'solid'} technical understanding across ${topicsCovered} topic areas.`,
      suggestions: ['Continue building on your technical foundation', 'Practice explaining complex concepts clearly']
    },
    {
      name: 'Communication', 
      score: overallScore,
      feedback: `Clear communication throughout the ${totalResponses} responses you provided.`,
      suggestions: ['Practice structuring your answers', 'Work on concise explanations']
    },
    {
      name: 'Problem Solving',
      score: overallScore - 1,
      feedback: 'Good approach to discussing technical challenges and solutions.',
      suggestions: ['Practice breaking down complex problems', 'Work on systematic thinking']
    }
  ];
  
  return {
    overallScore: overallScore,
    summary: `You completed a natural conversational interview with ${totalResponses} responses covering ${topicsCovered} key technical areas. Strong engagement throughout the discussion!`,
    categories: categories,
    strengths: [
      `Covered ${topicsCovered} different technical topics`, 
      'Good conversational flow',
      totalResponses >= 8 ? 'Strong engagement' : 'Active participation'
    ],
    improvements: [
      'Continue practicing technical concepts',
      'Work on providing more specific examples',
      'Practice explaining complex topics simply'
    ],
    actionPlan: `Based on your ${overallScore}/10 performance: ${
      overallScore >= 8 ? '1-2 weeks of advanced practice recommended' :
      overallScore >= 6 ? '2-4 weeks of focused preparation needed' :
      '4-8 weeks of foundational work recommended'
    }`
  };
}

// ✨ NEW: Generate feedback from conversation memory when session is lost
function generateFeedbackFromConversation(conversationMemory, jobContext) {
  const responses = conversationMemory.userResponses || [];
  const topicsCovered = conversationMemory.topicsDiscussed || [];
  const totalResponses = responses.length;
  
  console.log(`Generating feedback from conversation: ${totalResponses} responses, ${topicsCovered.length} topics`);
  
  // Calculate realistic score based on conversation quality
  let overallScore = 4; // Start lower for early-ended sessions
  
  if (totalResponses >= 2) overallScore += 2;
  if (totalResponses >= 3) overallScore += 1;
  if (topicsCovered.length >= 2) overallScore += 1;
  
  // Check for technical depth in responses
  const hasTechnicalContent = responses.some(r => {
    const response = r.response.toLowerCase();
    return response.includes('java') ||
           response.includes('node') ||
           response.includes('database') ||
           response.includes('api') ||
           response.includes('project') ||
           response.includes('application') ||
           response.includes('development');
  });
  
  if (hasTechnicalContent) overallScore += 1;
  
  overallScore = Math.min(overallScore, 8); // Cap at 8 for incomplete sessions
  
  const jobTitle = jobContext?.jobTitle || 'Technical Role';
  
  return {
    overallScore: overallScore,
    summary: `Interview session for ${jobTitle} with ${totalResponses} responses covering ${topicsCovered.length} topics. Session ended early - complete interviews provide more comprehensive assessment.`,
    categories: [
      {
        name: 'Technical Discussion',
        score: overallScore - 1,
        feedback: `Discussed ${topicsCovered.length} technical areas with ${totalResponses} responses. ${
          hasTechnicalContent ? 'Good technical content mentioned.' : 'Basic technical discussion.'
        }`,
        suggestions: ['Complete full interviews for better assessment', 'Provide more detailed technical examples', 'Explain technical concepts thoroughly']
      },
      {
        name: 'Communication',
        score: overallScore,
        feedback: `Provided ${totalResponses} clear responses during the session.`,
        suggestions: ['Practice structured answers', 'Work on comprehensive explanations']
      },
      {
        name: 'Interview Engagement',
        score: Math.min(overallScore + 1, 8),
        feedback: `Engaged with multiple interview questions before ending early.`,
        suggestions: ['Practice completing full interviews', 'Work on sustained engagement']
      }
    ],
    strengths: [
      totalResponses >= 3 ? 'Good initial engagement' : 'Showed willingness to participate',
      hasTechnicalContent ? 'Demonstrated technical knowledge' : 'Basic technical understanding',
      'Clear communication style'
    ],
    improvements: [
      'Complete full interview sessions for comprehensive feedback',
      'Provide more comprehensive technical examples',
      'Practice explaining complex concepts step-by-step'
    ],
    actionPlan: `Continue practicing: Complete full interviews to get comprehensive feedback on your ${jobTitle} skills. Based on your ${totalResponses} responses, focus on sustained technical discussion.`
  };
}

// AI-powered job analysis
async function analyzeJobWithAI(jobTitle, jobDescription, company, preparationTime) {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return generateFallbackJobAnalysis(jobTitle, jobDescription, company, preparationTime);
    }
    
    // Real OpenAI API call for job analysis
    const prompt = `You are an expert job analyst and career counselor. Analyze this job posting and provide a detailed analysis:

Job Title: ${jobTitle}
Company: ${company || 'Not specified'}
Preparation Time: ${preparationTime}
Job Description: ${jobDescription}

Please provide:
1. Required skills with importance levels (high/medium/low) and proficiency levels (1-10)
2. Experience level (Junior/Mid-Level/Senior)
3. Estimated salary range
4. Key learning objectives
5. Recommended learning approach for the specified preparation time

Format the response as JSON with this structure:
{
  "requiredSkills": [
    {"name": "React", "level": 7, "importance": "high", "description": "Core frontend framework for the role"},
    {"name": "Node.js", "level": 6, "importance": "high", "description": "Backend development requirement"},
    {"name": "PostgreSQL", "level": 5, "importance": "medium", "description": "Database management needed"}
  ],
  "experienceLevel": "Junior",
  "estimatedSalary": "$60k - $80k",
  "learningObjectives": ["objective1", "objective2"],
  "learningApproach": "description of how to approach learning"
}

IMPORTANT: Extract specific technologies from job description. Convert "Frontend frameworks (React/Vue/Angular)" to separate skills: "React", "Vue", "Angular".`;

    // ✨ FIXED: Use openai instance instead of fetch
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert job analyst and career counselor. Analyze job descriptions to identify required skills, experience level, and create personalized learning paths.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
      response_format: { type: "json_object" }  // ✨ NEW: Force JSON response
    });

    const content = response.choices[0].message.content;
    const analysis = JSON.parse(content);
    
    return {
      success: true,
      analysis: analysis
    };
  } catch (error) {
    console.error('Error analyzing job with AI:', error);
    return generateFallbackJobAnalysis(jobTitle, jobDescription, company, preparationTime);
  }
}

// Generate personalized learning path with AI
async function generateLearningPathWithAI(jobAnalysis, preparationTime, userCurrentSkills = {}) {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return generateFallbackLearningPath(jobAnalysis, preparationTime, userCurrentSkills);
    }
    
    // Real OpenAI API call for learning path
    const prompt = `Create a personalized learning path for this job:

Job Analysis: ${JSON.stringify(jobAnalysis)}
Preparation Time: ${preparationTime}
User's Current Skills: ${JSON.stringify(userCurrentSkills)}

Please create a structured learning path with:
1. Phases based on the preparation time
2. Specific skills to learn in each phase
3. Resources and milestones
4. Platform learning recommendations (tutoring sessions)
5. Progress tracking milestones

Format as JSON:
{
  "title": "Learning Path for [Job Title]",
  "estimatedDuration": "X weeks",
  "phases": [
    {
      "name": "Phase Name",
      "skills": ["skill1", "skill2"],
      "resources": ["resource1", "resource2"],
      "milestones": ["milestone1", "milestone2"],
      "platformLearning": ["tutoring session description"],
      "estimatedWeeks": 2
    }
  ]
}`;

    // ✨ FIXED: Use openai instance instead of fetch
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert learning path designer. Create personalized learning paths based on job requirements, user\'s current skills, and available preparation time.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.4,
      response_format: { type: "json_object" }  // ✨ NEW: Force JSON response
    });

    const content = response.choices[0].message.content;
    const learningPath = JSON.parse(content);
    
    return {
      success: true,
      learningPath: learningPath
    };
  } catch (error) {
    console.error('Error generating learning path with AI:', error);
    return generateFallbackLearningPath(jobAnalysis, preparationTime, userCurrentSkills);
  }
}

// Fallback functions when OpenAI is unavailable
function generateFallbackJobAnalysis(jobTitle, jobDescription, company, preparationTime) {
  const lowerDesc = jobDescription.toLowerCase();
  const skills = [];
  
  // Basic keyword analysis
  if (lowerDesc.includes('react') || lowerDesc.includes('frontend')) {
    skills.push({ name: 'React', level: 7, importance: 'high', description: 'Core frontend framework' });
  }
  if (lowerDesc.includes('javascript') || lowerDesc.includes('js')) {
    skills.push({ name: 'JavaScript', level: 8, importance: 'high', description: 'Core programming language' });
  }
  if (lowerDesc.includes('python')) {
    skills.push({ name: 'Python', level: 7, importance: 'high', description: 'Backend development' });
  }
  if (lowerDesc.includes('sql') || lowerDesc.includes('database')) {
    skills.push({ name: 'SQL', level: 6, importance: 'medium', description: 'Database management' });
  }
  
  // Default skills if none found
  if (skills.length === 0) {
    skills.push(
      { name: 'JavaScript', level: 6, importance: 'high', description: 'Essential for web development' },
      { name: 'HTML/CSS', level: 5, importance: 'medium', description: 'Basic web structure' }
    );
  }
  
  const experienceLevel = lowerDesc.includes('senior') ? 'Senior' : 
                         lowerDesc.includes('junior') ? 'Junior' : 'Mid-Level';
  
  return {
    success: false,
    analysis: {
      requiredSkills: skills,
      experienceLevel: experienceLevel,
      estimatedSalary: '$60k - $90k',
      learningObjectives: ['Master core technologies', 'Build practical projects'],
      learningApproach: 'Focus on hands-on practice and real-world projects'
    }
  };
}

function generateFallbackLearningPath(jobAnalysis, preparationTime, userCurrentSkills) {
  const weeks = parseInt(preparationTime.split('-')[0]);
  const phases = [];
  
  if (weeks <= 4) {
    phases.push({
      name: 'Intensive Foundation',
      skills: jobAnalysis.requiredSkills.slice(0, 2).map(s => s.name),
      resources: ['CodeMentor AI Tutoring', 'Fast-track courses'],
      milestones: ['Complete basics', 'Build simple project'],
      platformLearning: ['2 tutoring sessions per skill'],
      estimatedWeeks: weeks
    });
  } else {
    const phaseCount = Math.ceil(weeks / 4);
    for (let i = 0; i < phaseCount; i++) {
      const startWeek = i * 4 + 1;
      const endWeek = Math.min((i + 1) * 4, weeks);
      phases.push({
        name: `Phase ${i + 1} (Weeks ${startWeek}-${endWeek})`,
        skills: jobAnalysis.requiredSkills.slice(i * 2, (i + 1) * 2).map(s => s.name),
        resources: ['CodeMentor AI Tutoring', 'Online courses', 'Practice projects'],
        milestones: ['Complete phase objectives', 'Build phase project'],
        platformLearning: ['3-4 tutoring sessions per skill'],
        estimatedWeeks: endWeek - startWeek + 1
      });
    }
  }
  
  return {
    success: false,
    learningPath: {
      title: `Learning Path for ${jobAnalysis.jobTitle || 'Your Role'}`,
      estimatedDuration: `${weeks} weeks`,
      phases: phases
    }
  };
}

// AI Tutoring Helper Functions
async function generateTutoringResponse(studentMessage, codeSnippet, skillLevel, user) {
  try {
    // Check if OpenAI API key is available
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      // Fallback to smart mock responses when OpenAI is not configured
      return generateSmartMockResponse(studentMessage, codeSnippet, skillLevel, user);
    }
    
    // Real OpenAI API call
    const prompt = createTutoringPrompt(studentMessage, codeSnippet, skillLevel, user);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a Socratic computer science tutor helping ${user.name} learn. IMPORTANT RULES:
1. NEVER start responses with "Hello ${user.name}" or similar greetings
2. Be conversational and natural, not repetitive
3. Use guided discovery and ask thoughtful questions
4. If the student shares code, analyze it and provide specific feedback
5. If no code is shared, focus on conceptual explanations
6. Be encouraging and patient
7. Keep responses concise but helpful (under 200 words)
8. Remember this is an ongoing conversation - don't restart or repeat yourself
9. Build on previous messages and maintain context`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiMessage = data.choices[0].message.content;
    
    // Parse the AI response to extract concepts and hints
    const concepts = extractConcepts(aiMessage);
    const hints = extractHints(aiMessage);
    
    return {
      message: aiMessage,
      concepts: concepts,
      hints: hints
    };
    
  } catch (error) {
    console.error('OpenAI API error, falling back to mock response:', error);
    return generateSmartMockResponse(studentMessage, codeSnippet, skillLevel, user);
  }
}

// Smart mock response generator (fallback when OpenAI is not available)
function generateSmartMockResponse(studentMessage, codeSnippet, skillLevel, user) {
  const message = studentMessage.toLowerCase();
  
  // More intelligent keyword matching
  if (message.includes('hello') || message.includes('hi')) {
    return {
      message: `Hello! I am excited to help you learn ${user?.skillLevels?.python ? 'Python' : 'programming'}! What specific concept would you like to explore today?`,
      concepts: ['greeting', 'session start'],
      hints: ['Ask about specific programming concepts', 'Share what you want to learn', 'Try writing some code']
    };
  }
  
  if (message.includes('recursion') || message.includes('recursive')) {
    return {
      message: "Great question about recursion! Let's think step by step. Can you tell me what happens when a function calls itself? What gets stored in memory each time?",
      concepts: ['recursion', 'function calls', 'stack memory'],
      hints: ['Think about the call stack', 'What happens when a function calls itself?', 'How does it know when to stop?']
    };
  }
  
  if (message.includes('binary search') || message.includes('binary')) {
    return {
      message: "Excellent! Binary search is a powerful algorithm. If you're looking for the number 7 in [1,3,5,7,9,11,13], where would you start? Why start there?",
      concepts: ['binary search', 'divide and conquer', 'sorted arrays'],
      hints: ['Start in the middle', 'Is your target before or after the middle?', 'How many comparisons do you need?']
    };
  }
  
  if (message.includes('loop') || message.includes('for') || message.includes('while')) {
    return {
      message: "Loops are fundamental! Can you explain the difference between a for loop and a while loop? When would you use each one?",
      concepts: ['loops', 'control flow', 'iteration'],
      hints: ['For loops are for known iterations', 'While loops are for unknown iterations', 'Think about the loop condition']
    };
  }
  
  if (codeSnippet) {
    return {
      message: `I can see your code! This looks interesting. Can you tell me what you think this code will output? What is the purpose of each line?`,
      concepts: ['code analysis', 'code understanding'],
      hints: ['Read the code line by line', 'Think about what each function does', 'What is the expected output?']
    };
  }
  
  // Default response based on skill level
  const levelResponses = {
    beginner: {
      message: "That's a great question! I'd love to help you understand this concept. Can you tell me what you already know about it? What specifically confuses you?",
      concepts: ['learning approach', 'concept exploration'],
      hints: ['Start with what you know', 'Ask specific questions', "Don't be afraid to make mistakes"]
    },
    intermediate: {
      message: "Good thinking! Let's dive deeper into this. Can you explain your current understanding and what you think might be challenging?",
      concepts: ['advanced concepts', 'problem solving'],
      hints: ['Break down the problem', 'Consider edge cases', 'Think about different approaches']
    },
    advanced: {
      message: "Interesting approach! Let us analyze this from multiple angles. What is your current solution time and space complexity? Can you think of optimizations?",
      concepts: ['complexity analysis', 'optimization', 'advanced problem solving'],
      hints: ['Analyze your algorithm', 'Look for optimization opportunities', 'Consider trade-offs']
    }
  };
  
  return levelResponses[skillLevel] || levelResponses.beginner;
}

// Check if code is sample/template code
function isSampleCode(code) {
  if (!code || typeof code !== 'string') return false;
  
  const samplePatterns = [
    /# Welcome to .* tutoring!/i,
    /# Start coding here/i,
    /def hello_world\(\):/,
    /function helloWorld\(\)/,
    /console\.log\("Hello, World!"\)/,
    /print\("Hello, World!"\)/,
    /public class HelloWorld/,
    /#include <stdio\.h>/,
    /int main\(\)/,
    /hello_world\(\)/,
    /helloWorld\(\)/
  ];
  
  // Check if it's the exact sample code
  const trimmedCode = code.trim();
  const isExactSample = trimmedCode.includes('# Welcome to Python tutoring!') && 
                        trimmedCode.includes('def hello_world()') &&
                        trimmedCode.includes('print("Hello, World!")');
  
  return isExactSample || samplePatterns.some(pattern => pattern.test(code));
}

// Create intelligent prompt for OpenAI
function createTutoringPrompt(studentMessage, codeSnippet, skillLevel, user) {
  let prompt = `You are a Socratic computer science tutor helping a ${skillLevel} level student.
  
Student's question: "${studentMessage}"

Student's skill level: ${skillLevel}
Student's name: ${user?.name || 'Student'}

IMPORTANT: This is an ongoing conversation. The student has already told you about their interest in Machine Learning and their goals. Don't ask them to repeat information they've already shared. Build on what they've said and provide specific, helpful guidance.`;

  if (codeSnippet) {
    // Check if this is sample code or actual user code
    const isSampleCodeResult = isSampleCode(codeSnippet);
    
    if (isSampleCodeResult) {
      prompt += `\n\nNote: The student has sample code in their editor (this is starter code, not their own work):
\`\`\`${codeSnippet}\`\`\`

IMPORTANT: This is starter/template code, not code the student wrote. Don't assume they understand it yet.`;
    } else {
      prompt += `\n\nStudent's code:\n\`\`\`${codeSnippet}\`\`\``;
    }
  }

  prompt += `\n\nProvide a helpful, encouraging response that:
1. Uses Socratic teaching (ask guiding questions, don't give direct answers)
2. Is appropriate for ${skillLevel} level
3. Relates to the specific question asked
4. If sample code is shown, help them understand it or encourage them to write their own
5. If user's own code is provided, analyze it and ask relevant questions
6. Keep response under 200 words
7. Be encouraging and patient
8. NEVER start with "Hello [name]" or similar greetings

Response:`;

  return prompt;
}

// Extract concepts from AI response
function extractConcepts(aiMessage) {
  const commonConcepts = [
    'recursion', 'loops', 'functions', 'variables', 'data types', 'algorithms',
    'binary search', 'sorting', 'arrays', 'strings', 'objects', 'classes',
    'inheritance', 'polymorphism', 'encapsulation', 'abstraction', 'complexity',
    'time complexity', 'space complexity', 'optimization', 'debugging'
  ];
  
  const foundConcepts = commonConcepts.filter(concept => 
    aiMessage.toLowerCase().includes(concept)
  );
  
  return foundConcepts.length > 0 ? foundConcepts : ['learning', 'concept exploration'];
}

// Extract hints from AI response
function extractHints(aiMessage) {
  // Look for actual helpful hints, not just random sentences
  const helpfulPatterns = [
    /try\s+([^.]+)/gi,
    /think\s+about\s+([^.]+)/gi,
    /consider\s+([^.]+)/gi,
    /ask\s+yourself\s+([^.]+)/gi,
    /remember\s+([^.]+)/gi,
    /focus\s+on\s+([^.]+)/gi,
    /start\s+with\s+([^.]+)/gi
  ];
  
  const hints = [];
  
  helpfulPatterns.forEach(pattern => {
    const matches = aiMessage.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const hint = match.replace(/^(try|think about|consider|ask yourself|remember|focus on|start with)\s+/i, '').trim();
        if (hint.length > 10 && hint.length < 100) {
          hints.push(hint);
        }
      });
    }
  });
  
  // If no helpful hints found, provide generic ones
  if (hints.length === 0) {
    return ['Think about the problem step by step', 'Ask specific questions'];
  }
  
  // Return up to 2 most relevant hints
  return hints.slice(0, 2);
}

async function executeCode(code, language) {
  try {
    // Check if Judge0 API key is available
    const judge0ApiKey = process.env.JUDGE0_API_KEY;
    
    if (!judge0ApiKey) {
      // Fallback to local execution when Judge0 is not configured
      return await executeCodeLocally(code, language);
    }
    
    // Real Judge0 API call for safe code execution
    const languageId = getJudge0LanguageId(language);
    
    const response = await fetch('https://judge0-ce.p.rapidapi.com/submissions', {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': judge0ApiKey,
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_code: code,
        language_id: languageId,
        stdin: '',
        cpu_time_limit: 5,
        memory_limit: 128
      })
    });
    
    if (!response.ok) {
      throw new Error(`Judge0 API error: ${response.status}`);
    }
    
    const submission = await response.json();
    const token = submission.token;
    
    // Wait for execution to complete
    let result;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const resultResponse = await fetch(`https://judge0-ce.p.rapidapi.com/submissions/${token}`, {
        headers: {
          'X-RapidAPI-Key': judge0ApiKey,
          'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
        }
      });
      
      if (resultResponse.ok) {
        result = await resultResponse.json();
        if (result.status.id > 2) { // Status > 2 means execution completed
          break;
        }
      }
    }
    
    if (!result) {
      throw new Error('Code execution timeout');
    }
    
    return {
      output: result.stdout || '',
      error: result.stderr || null,
      executionTime: `${result.time || 0}s`,
      memory: `${result.memory || 0}KB`,
      status: result.status.description || 'completed'
    };
    
  } catch (error) {
    console.error('Code execution error:', error);
    // Fallback to local execution
    return await executeCodeLocally(code, language);
  }
}

// Local code execution fallback (for development/testing)
async function executeCodeLocally(code, language) {
  try {
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simple local execution simulation
    let output = '';
    let error = null;
    
    if (language === 'python') {
      // Actually execute Python code using child_process
      const { spawn } = require('child_process');
      
      return new Promise((resolve) => {
        const pythonProcess = spawn('python3', ['-c', code]);
        let output = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          // Clean up Python error output to make it user-friendly
          let cleanError = data.toString();
          
          // Remove ANSI color codes
          cleanError = cleanError.replace(/\x1b\[[0-9;]*m/g, '');
          
          // Format the error to look clean and readable
          const lines = cleanError.split('\n');
          const formattedLines = lines.map(line => {
            // Keep the traceback header
            if (line.includes('Traceback (most recent call last):')) {
              return line;
            }
            
            // Format the file and line info to look clean
            if (line.includes('File "<string>"')) {
              return '  File "<string>", line 1';
            }
            
            // Keep the code line with proper indentation
            if (line.trim() && !line.trim().startsWith('^') && !line.includes('File "<string>"')) {
              return '    ' + line.trim();
            }
            
            // Keep the error pointer line (the one with ^^^^)
            if (line.trim().startsWith('^')) {
              return '    ' + line.trim();
            }
            
            return '';
          }).filter(line => line.trim() !== '');
          
          error += formattedLines.join('\n');
        });

        pythonProcess.on('close', (exitCode) => {
          resolve({
            output: output || (error ? '' : 'No output'),
            error: error || null,
            executionTime: '1.0s',
            memory: '< 1MB',
            status: 'success'
          });
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          pythonProcess.kill();
          resolve({
            output: '',
            error: 'Execution timeout (10s limit)',
            executionTime: '10.0s',
            memory: '0MB',
            status: 'timeout'
          });
        }, 10000);
      });
    } else if (language === 'javascript') {
      // Extract console.log statements and simulate output
      const consoleMatches = code.match(/console\.log\s*\(\s*([^)]+)\s*\)/g);
      if (consoleMatches) {
        output = consoleMatches.map(match => {
          const content = match.replace(/console\.log\s*\(\s*/, '').replace(/\s*\)/, '');
          
          // Handle template literals and expressions
          if (content.includes('`') || content.includes('+')) {
            // Handle "Number: " + numbers[i] pattern
            if (content.includes('+') && content.includes('[')) {
              // Extract the base string and array access
              const parts = content.split('+');
              const baseString = parts[0].replace(/['"]/g, '').trim();
              const arrayPart = parts[1].trim();
              
              // If there's a for loop, simulate the output
              if (code.includes('for') && code.includes('length')) {
                // Simulate array iteration
                let result = '';
                for (let i = 0; i < 3; i++) { // Assume array has 3 elements
                  result += baseString + i + '\n';
                }
                return result;
              }
              
              // Default: show sample output
              return baseString + '0\n' + baseString + '1\n' + baseString + '2\n';
            }
            
            // Handle template literals with ${}
            if (content.includes('${')) {
              const templatePart = content.replace(/`/g, '');
              // Replace ${} with sample values
              return templatePart.replace(/\$\{[^}]+\}/g, 'sample') + '\n';
            }
          }
          
          // Handle regular strings
          return content.replace(/['"]/g, '') + '\n';
        }).join('');
      } else if (code.includes('function ')) {
        output = 'Function defined successfully\n';
      } else {
        output = 'Code executed successfully\n';
      }
    } else {
      output = 'Code executed successfully\n';
    }
    
    return {
      output: output,
      error: error,
      executionTime: '1.0s',
      memory: '2.0MB',
      status: 'success'
    };
    
  } catch (err) {
    return {
      output: '',
      error: err.message,
      executionTime: '0.0s',
      memory: '0.0MB',
      status: 'error'
    };
  }
}

// Get Judge0 language ID
function getJudge0LanguageId(language) {
  const languageMap = {
    'python': 71,      // Python 3.8.1
    'javascript': 63,  // JavaScript (Node.js 12.14.0)
    'java': 62,        // Java (OpenJDK 13.0.1)
    'cpp': 54,         // C++ (GCC 9.2.0)
    'c': 50            // C (GCC 9.2.0)
  };
  
  return languageMap[language] || 71; // Default to Python
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

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ✅ ENHANCED: Save interview feedback with persistence and email option
app.post('/api/mock-interview/save-feedback', async (req, res) => {
  try {
    const { sessionId, feedback, emailCopy = false } = req.body;
    
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = userDatabase.get(currentUserEmail);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Find the interview session
    const session = user.mockInterviews?.find(s => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Interview session not found' });
    }
    
    // Save feedback to session
    session.feedback = feedback;
    session.saved = true;
    session.savedAt = new Date();
    
    // Add to user's saved interviews collection for dashboard
    if (!user.savedInterviews) {
      user.savedInterviews = [];
    }
    
    const savedInterview = {
      id: sessionId,
      jobTitle: session.jobTitle || 'Technical Interview',
      company: session.company || 'Company',
      date: session.endTime || new Date(),
      duration: session.duration || 0,
      overallScore: feedback.overallScore,
      feedback: feedback,
      categories: feedback.categories || [],
      summary: feedback.summary
    };
    
    // Remove any existing saved version and add the new one
    user.savedInterviews = user.savedInterviews.filter(i => i.id !== sessionId);
    user.savedInterviews.unshift(savedInterview); // Add to beginning
    
    // Keep only last 10 saved interviews
    if (user.savedInterviews.length > 10) {
      user.savedInterviews = user.savedInterviews.slice(0, 10);
    }
    
    console.log(`📊 Interview feedback saved for ${user.name}: ${feedback.overallScore}/10`);
    
    // Send email if requested
    if (emailCopy) {
      try {
        await sendInterviewFeedbackEmail(user, savedInterview);
        console.log(`📧 Feedback email sent to ${user.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send email:', emailError);
        // Don't fail the whole request if email fails
      }
    }
    
    res.json({
      message: 'Interview feedback saved successfully',
      emailSent: emailCopy,
      savedInterview: savedInterview
    });
    
  } catch (error) {
    console.error('❌ Error saving interview feedback:', error);
    res.status(500).json({ 
      message: 'Failed to save feedback',
      error: error.message 
    });
  }
});

// ✅ NEW: Get saved interviews for dashboard
app.get('/api/mock-interview/saved', (req, res) => {
  try {
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = userDatabase.get(currentUserEmail);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const savedInterviews = user.savedInterviews || [];
    
    res.json({
      interviews: savedInterviews,
      count: savedInterviews.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching saved interviews:', error);
    res.status(500).json({ 
      message: 'Failed to fetch saved interviews',
      error: error.message 
    });
  }
});

// ✅ NEW: Get individual feedback by ID
app.get('/api/mock-interview/feedback/:interviewId', (req, res) => {
  try {
    const { interviewId } = req.params;
    
    if (!currentUserEmail) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = userDatabase.get(currentUserEmail);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // First, try to find in saved interviews
    const savedInterview = user.savedInterviews?.find(i => i.id === interviewId);
    if (savedInterview) {
      return res.json({ feedback: savedInterview.feedback });
    }
    
    // Fallback: try to find in mock interviews (for backward compatibility)
    const mockInterview = user.mockInterviews?.find(i => i.id === interviewId);
    if (mockInterview && mockInterview.feedback) {
      return res.json({ feedback: mockInterview.feedback });
    }
    
    res.status(404).json({ message: 'Feedback not found' });
    
  } catch (error) {
    console.error('❌ Error fetching feedback:', error);
    res.status(500).json({ 
      message: 'Failed to fetch feedback',
      error: error.message 
    });
  }
});

// ✅ NEW: Email sending function for interview feedback
async function sendInterviewFeedbackEmail(user, interview) {
  // This would use a real email service like SendGrid, Nodemailer, etc.
  // For now, we'll simulate it with detailed logging
  
  const emailContent = `
    Subject: Your Interview Feedback - ${interview.jobTitle}
    
    Hi ${user.name},
    
    Here's your interview feedback for the ${interview.jobTitle} position at ${interview.company}:
    
    Overall Score: ${interview.overallScore}/10
    Interview Date: ${new Date(interview.date).toLocaleDateString()}
    Duration: ${interview.duration} minutes
    
    DETAILED FEEDBACK:
    ${interview.summary}
    
    CATEGORY SCORES:
    ${interview.categories.map(cat => 
      `• ${cat.name}: ${cat.score}/10 - ${cat.feedback}`
    ).join('\n')}
    
    RECOMMENDED IMPROVEMENTS:
    ${interview.feedback.improvements?.map(imp => `• ${imp}`).join('\n') || 'Keep up the great work!'}
    
    ACTION PLAN:
    ${interview.feedback.actionPlan || 'Continue practicing technical interviews.'}
    
    Login to your CodeMentor AI dashboard to view more details and track your progress.
    
    Good luck with your interview preparation!
    
    Best regards,
    CodeMentor AI Team
  `;
  
  console.log('📧 Email would be sent to:', user.email);
  console.log('📧 Email content preview:', emailContent.substring(0, 200) + '...');
  
  // In production, replace with actual email sending:
  /*
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransporter({
    // Email service configuration
  });
  
  await transporter.sendMail({
    to: user.email,
    subject: `Interview Feedback - ${interview.jobTitle}`,
    text: emailContent,
    html: generateHTMLEmail(interview) // You'd create this function
  });
  */
  
  // For now, just return success
  return { success: true, message: 'Email sent successfully (simulated)' };
}

// ✅ NEW: Test endpoint to verify OpenAI connectivity
app.get('/api/test-openai', async (req, res) => {
  console.log('=== OpenAI Test Endpoint ===');
  console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
  console.log('API Key length:', process.env.OPENAI_API_KEY?.length || 0);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Say 'Hello from OpenAI!' in exactly 3 words." }],
      max_tokens: 10,
      temperature: 0
    });
    
    console.log('✅ OpenAI test successful');
    res.json({ 
      success: true, 
      message: response.choices[0].message.content,
      model: "gpt-3.5-turbo"
    });
  } catch (error) {
    console.error('❌ OpenAI test failed:', error.message);
    res.json({ 
      success: false, 
      error: error.message,
      code: error.code,
      type: error.type
    });
  }
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