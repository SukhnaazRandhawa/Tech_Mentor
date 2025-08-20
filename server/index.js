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
app.post('/api/tutoring/start-session', (req, res) => {
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
  
  res.json({
    message: 'Tutoring session started successfully',
    session: session
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
  
  if (!currentUserEmail) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  const { sessionId } = req.body;
  const user = userDatabase.get(currentUserEmail);
  
  if (!sessionId) {
    return res.status(400).json({ message: 'Session ID is required' });
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
    }
  }
  
  res.json({
    message: 'Tutoring session ended successfully',
    session: user.tutoringSessions?.find(s => s.id === sessionId)
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
            content: 'You are a Socratic computer science tutor. Use guided discovery, ask questions, and help students learn through exploration. Be encouraging and patient.'
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

// Create intelligent prompt for OpenAI
function createTutoringPrompt(studentMessage, codeSnippet, skillLevel, user) {
  let prompt = `You are a Socratic computer science tutor helping a ${skillLevel} level student.
  
Student's question: "${studentMessage}"

Student's skill level: ${skillLevel}
Student's name: ${user?.name || 'Student'}`;

  if (codeSnippet) {
    prompt += `\n\nStudent's code:\n\`\`\`${codeSnippet}\`\`\``;
  }

  prompt += `\n\nProvide a helpful, encouraging response that:
1. Uses Socratic teaching (ask guiding questions, don't give direct answers)
2. Is appropriate for ${skillLevel} level
3. Relates to the specific question asked
4. If code is provided, analyze it and ask relevant questions
5. Keep response under 200 words
6. Be encouraging and patient

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
  // Simple hint extraction - look for question marks and suggestions
  const sentences = aiMessage.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const hints = sentences.slice(0, 2).map(s => s.trim());
  
  return hints.length > 0 ? hints : ['Think about the problem step by step', 'Ask specific questions'];
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
      // Extract print statements and simulate output
      const printMatches = code.match(/print\s*\(\s*([^)]+)\s*\)/g);
      if (printMatches) {
        output = printMatches.map(match => {
          const content = match.replace(/print\s*\(\s*/, '').replace(/\s*\)/, '');
          
          // Handle f-strings
          if (content.includes('f"') || content.includes("f'")) {
            // Simple f-string evaluation for common patterns
            let processedContent = content;
            
            // Handle f"Count: {i}" pattern
            if (content.match(/f["']([^"']*\{[^}]*\}[^"']*)["']/)) {
              // Extract the string part and replace variables with sample values
              const stringPart = content.replace(/^f["']/, '').replace(/["']$/, '');
              
              // Replace {i} with sample values for loops
              if (stringPart.includes('{i}')) {
                // If there's a for loop, simulate the output
                if (code.includes('for') && code.includes('range')) {
                  const rangeMatch = code.match(/range\s*\(\s*(\d+)\s*\)/);
                  if (rangeMatch) {
                    const count = parseInt(rangeMatch[1]);
                    let result = '';
                    for (let i = 0; i < count; i++) {
                      result += stringPart.replace(/\{i\}/g, i) + '\n';
                    }
                    return result;
                  }
                }
                // Default: show first few iterations
                return stringPart.replace(/\{i\}/g, '0') + '\n' +
                       stringPart.replace(/\{i\}/g, '1') + '\n' +
                       stringPart.replace(/\{i\}/g, '2') + '\n';
              }
              
              // Remove f-string prefix and quotes
              return stringPart.replace(/['"]/g, '') + '\n';
            }
            
            // Remove f-string prefix and quotes
            return processedContent.replace(/^f["']/, '').replace(/["']$/, '') + '\n';
          }
          
          // Handle regular strings
          return content.replace(/['"]/g, '') + '\n';
        }).join('');
      } else if (code.includes('def ')) {
        output = 'Function defined successfully\n';
      } else {
        output = 'Code executed successfully\n';
      }
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