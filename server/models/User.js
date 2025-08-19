const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const skillLevelSchema = new mongoose.Schema({
  level: {
    type: Number,
    min: 1,
    max: 10,
    default: 1
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  lessonsCompleted: {
    type: Number,
    default: 0
  },
  challengesSolved: {
    type: Number,
    default: 0
  }
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  avatar: {
    type: String,
    default: null
  },
  skillLevels: {
    python: skillLevelSchema,
    javascript: skillLevelSchema,
    java: skillLevelSchema,
    cpp: skillLevelSchema,
    algorithms: skillLevelSchema,
    dataStructures: skillLevelSchema,
    systemDesign: skillLevelSchema,
    databases: skillLevelSchema,
    webDevelopment: skillLevelSchema,
    mobileDevelopment: skillLevelSchema,
    machineLearning: skillLevelSchema,
    devOps: skillLevelSchema
  },
  learningGoals: [{
    type: String,
    enum: [
      'get_job',
      'improve_skills',
      'learn_new_technology',
      'prepare_for_interview',
      'career_switch',
      'academic_improvement'
    ]
  }],
  currentLearningPath: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningPath'
  },
  jobPreparations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPreparation'
  }],
  tutoringSessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TutoringSession'
  }],
  mockInterviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MockInterview'
  }],
  preferences: {
    preferredLanguages: [{
      type: String,
      enum: ['python', 'javascript', 'java', 'cpp', 'go', 'rust', 'swift', 'kotlin']
    }],
    difficultyLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    },
    learningStyle: {
      type: String,
      enum: ['visual', 'hands-on', 'theoretical', 'mixed'],
      default: 'mixed'
    },
    notificationSettings: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      reminders: { type: Boolean, default: true }
    }
  },
  statistics: {
    totalStudyTime: { type: Number, default: 0 }, // in minutes
    lessonsCompleted: { type: Number, default: 0 },
    challengesSolved: { type: Number, default: 0 },
    interviewsCompleted: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: Date.now }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ 'skillLevels.level': 1 });
userSchema.index({ 'statistics.lastActiveDate': 1 });

// Virtual for overall progress
userSchema.virtual('overallProgress').get(function() {
  const skills = Object.values(this.skillLevels);
  if (skills.length === 0) return 0;
  
  const totalLevel = skills.reduce((sum, skill) => sum + (skill.level || 1), 0);
  return Math.round((totalLevel / (skills.length * 10)) * 100);
});

// Virtual for skill count
userSchema.virtual('skillCount').get(function() {
  return Object.keys(this.skillLevels).length;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to update skill level
userSchema.methods.updateSkillLevel = function(skill, level, increment = false) {
  if (!this.skillLevels[skill]) {
    this.skillLevels[skill] = { level: 1, lastUpdated: new Date() };
  }
  
  if (increment) {
    this.skillLevels[skill].level = Math.min(10, this.skillLevels[skill].level + level);
  } else {
    this.skillLevels[skill].level = Math.max(1, Math.min(10, level));
  }
  
  this.skillLevels[skill].lastUpdated = new Date();
  return this.save();
};

// Method to increment lesson completion
userSchema.methods.incrementLessonCompletion = function(skill) {
  if (this.skillLevels[skill]) {
    this.skillLevels[skill].lessonsCompleted += 1;
  }
  this.statistics.lessonsCompleted += 1;
  return this.save();
};

// Method to increment challenge completion
userSchema.methods.incrementChallengeCompletion = function(skill) {
  if (this.skillLevels[skill]) {
    this.skillLevels[skill].challengesSolved += 1;
  }
  this.statistics.challengesSolved += 1;
  return this.save();
};

// Method to update last active date
userSchema.methods.updateLastActive = function() {
  this.statistics.lastActiveDate = new Date();
  return this.save();
};

// Method to get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.emailVerificationToken;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
