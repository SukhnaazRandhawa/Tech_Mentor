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
    {"name": "skill_name", "level": 7, "importance": "high", "description": "why this skill is needed"}
  ],
  "experienceLevel": "Junior",
  "estimatedSalary": "$60k - $80k",
  "learningObjectives": ["objective1", "objective2"],
  "learningApproach": "description of how to approach learning"
}`;

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
            content: 'You are an expert job analyst and career counselor. Analyze job descriptions to identify required skills, experience level, and create personalized learning paths.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
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
            content: 'You are an expert learning path designer. Create personalized learning paths based on job requirements, user\'s current skills, and available preparation time.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.4
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
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