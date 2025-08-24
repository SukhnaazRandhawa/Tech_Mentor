import {
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  CheckCircle,
  ChevronLeft,
  Clock,
  Code,
  MessageSquare,
  Play,
  Save,
  Square,
  Target,
  TrendingUp
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JobDescriptionUpload from '../components/JobDescriptionUpload';
import { useAuth } from '../contexts/AuthContext';

const MockInterview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Add custom scrollbar styles
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 3px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [activeTab, setActiveTab] = useState('start');
  const [interviewMode, setInterviewMode] = useState('technical');
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [interviewHistory, setInterviewHistory] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [interviewStats, setInterviewStats] = useState({});
  const [sessionData, setSessionData] = useState(null);
  
  // Job-specific interview state
  const [showJobUpload, setShowJobUpload] = useState(false);
  const [jobData, setJobData] = useState(null);
  
  const chatEndRef = useRef(null);
  const [conversation, setConversation] = useState([]);

  // Interview modes configuration
  const interviewModes = [
    {
      id: 'technical',
      title: 'Technical Interview',
      description: 'Coding challenges, algorithms, and technical problem-solving',
      icon: Code,
      color: 'bg-blue-500',
      duration: '45-60 minutes'
    },
    {
      id: 'system-design',
      title: 'System Design',
      description: 'Architecture discussions, scalability, and system planning',
      icon: Brain,
      color: 'bg-purple-500',
      duration: '30-45 minutes'
    },
    {
      id: 'behavioral',
      title: 'Behavioral Interview',
      description: 'Leadership, teamwork, and past experience discussions',
      icon: MessageSquare,
      color: 'bg-green-500',
      duration: '30-40 minutes'
    }
  ];

  // Load interview history on component mount
  useEffect(() => {
    loadInterviewHistory();
    loadInterviewStats();
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Load interview history from backend
  const loadInterviewHistory = async () => {
    try {
      const response = await fetch('/api/mock-interview/history');
      if (response.ok) {
        const data = await response.json();
        setInterviewHistory(data.interviews || []);
      }
    } catch (error) {
      console.error('Error loading interview history:', error);
    }
  };

  // Load interview statistics
  const loadInterviewStats = async () => {
    try {
      const response = await fetch('/api/mock-interview/stats');
      if (response.ok) {
        const data = await response.json();
        console.log('Interview stats response:', data);
        console.log('Stats object:', data.stats);
        setInterviewStats(data.stats || {});
      }
    } catch (error) {
      console.error('Error loading interview stats:', error);
    }
  };

  // Start a new interview
  const startInterview = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/mock-interview/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: interviewMode,
          userLevel: 'intermediate' // TODO: Get from user profile
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Interview start response:', data);
        console.log('Welcome message type:', typeof data.welcomeMessage);
        console.log('Welcome message value:', data.welcomeMessage);
        
        setSessionData(data.session);
        setIsInterviewActive(true);
        setActiveTab('interview');
        
        // Add welcome message - ensure it's a string
        const welcomeMessageText = typeof data.welcomeMessage === 'string' 
          ? data.welcomeMessage 
          : 'Welcome to your interview! Let\'s begin with the first question.';
        
        const welcomeMessage = {
          id: Date.now(),
          speaker: 'interviewer',
          message: welcomeMessageText,
          timestamp: new Date(),
          type: 'welcome'
        };
        setConversation([welcomeMessage]);
        
        // Set first question
        if (data.firstQuestion) {
          setCurrentQuestion(data.firstQuestion);
        }
      } else {
        throw new Error('Failed to start interview');
      }
    } catch (error) {
      console.error('Error starting interview:', error);
      alert('Failed to start interview. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit answer and get next question
  const submitAnswer = async () => {
    if (!userAnswer.trim() || !sessionData) return;

    setIsLoading(true);
    
    // Add user answer to conversation
    const userMessage = {
      id: Date.now(),
      speaker: 'candidate',
      message: userAnswer,
      timestamp: new Date(),
      type: 'answer'
    };
    
    setConversation(prev => [...prev, userMessage]);
    setUserAnswer('');

    try {
      const response = await fetch('/api/mock-interview/submit-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionData.id,
          questionId: currentQuestion?.id,
          answer: userMessage.message,
          mode: interviewMode
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add interviewer feedback - ensure message is a string
        const feedbackText = typeof data.feedback === 'string' 
          ? data.feedback 
          : 'Thank you for your answer. Let me provide some feedback.';
        
        const feedbackMessage = {
          id: Date.now() + 1,
          speaker: 'interviewer',
          message: feedbackText,
          timestamp: new Date(),
          type: 'feedback',
          score: data.score || 0,
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : []
        };
        
        setConversation(prev => [...prev, feedbackMessage]);
        
        // Set next question or end interview
        if (data.nextQuestion) {
          setCurrentQuestion(data.nextQuestion);
        } else if (data.interviewComplete) {
          // Interview is complete
          setActiveTab('feedback');
          setFeedback(data.finalFeedback);
          setIsInterviewActive(false);
          
          // Reload history and stats
          loadInterviewHistory();
          loadInterviewStats();
        }
      } else {
        throw new Error('Failed to submit answer');
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('Failed to submit answer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle job description analysis
  const handleJobAnalyzed = (jobInfo) => {
    setJobData(jobInfo);
    setShowJobUpload(false);
    // Start the interview with the analyzed job
    startInterviewWithJob(jobInfo);
  };

  // Start interview with specific job
  const startInterviewWithJob = async (jobInfo) => {
    try {
      setIsLoading(true);
      setActiveTab('interview');
      
      const response = await fetch('/api/mock-interview/start-with-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: interviewMode,
          userLevel: 'intermediate',
          jobDescription: jobInfo.jobDescription,
          jobTitle: jobInfo.jobTitle,
          company: jobInfo.company
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Job-specific interview started:', data);
        
        setSessionData(data.session);
        setIsInterviewActive(true);
        
        // Add welcome message
        const welcomeMessage = {
          id: Date.now(),
          speaker: 'interviewer',
          message: data.welcomeMessage,
          timestamp: new Date(),
          type: 'welcome'
        };
        setConversation([welcomeMessage]);
        
        // Set first question
        if (data.firstQuestion) {
          setCurrentQuestion(data.firstQuestion);
        }
        
        // Store job context for the interview
        setJobData({
          ...jobInfo,
          analysis: data.jobAnalysis,
          totalQuestions: data.totalQuestions
        });
        
      } else {
        throw new Error('Failed to start job-specific interview');
      }
    } catch (error) {
      console.error('Error starting job-specific interview:', error);
      alert('Failed to start interview. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // End interview early
  const endInterview = async () => {
    if (!sessionData) return;
    
    try {
      const response = await fetch('/api/mock-interview/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionData.id
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setFeedback(data.feedback);
        setActiveTab('feedback');
        setIsInterviewActive(false);
        
        // Reload history and stats
        loadInterviewHistory();
        loadInterviewStats();
      }
    } catch (error) {
      console.error('Error ending interview:', error);
    }
  };

  // Save interview feedback
  const saveInterview = async () => {
    if (!sessionData || !feedback) return;
    
    try {
      const response = await fetch('/api/mock-interview/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionData.id,
          feedback: feedback,
          mode: interviewMode
        }),
      });

      if (response.ok) {
        alert('Interview saved successfully!');
        navigate('/');
      }
    } catch (error) {
      console.error('Error saving interview:', error);
      alert('Failed to save interview.');
    }
  };

  // Get interview mode icon
  const getModeIcon = (modeId) => {
    const mode = interviewModes.find(m => m.id === modeId);
    return mode ? mode.icon : MessageSquare;
  };

  // Get interview mode color
  const getModeColor = (modeId) => {
    const mode = interviewModes.find(m => m.id === modeId);
    return mode ? mode.color : 'bg-gray-500';
  };

  // Format interview duration
  const formatDuration = (minutes) => {
    // Ensure minutes is a valid number
    const mins = Number(minutes) || 0;
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  };

  // Render job upload screen
  if (showJobUpload) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => setShowJobUpload(false)}
            className="flex items-center text-secondary-600 hover:text-secondary-900 mb-4"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Back to Interview Selection
          </button>
        </div>
        <JobDescriptionUpload
          onJobAnalyzed={handleJobAnalyzed}
          onCancel={() => setShowJobUpload(false)}
        />
      </div>
    );
  }

  // Render start screen
  if (activeTab === 'start') {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-secondary-900 mb-4">
            Mock Interview Preparation
          </h1>
          <p className="text-secondary-600 text-lg">
            Practice technical interviews with AI and get personalized feedback
          </p>
        </div>

        {/* Interview Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {interviewModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <div
                key={mode.id}
                className={`card cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  interviewMode === mode.id ? 'ring-2 ring-primary-500' : ''
                }`}
                onClick={() => setInterviewMode(mode.id)}
              >
                <div className={`${mode.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                  {mode.title}
                </h3>
                <p className="text-secondary-600 mb-3">
                  {mode.description}
                </p>
                <div className="flex items-center justify-center text-sm text-secondary-500">
                  <Clock className="h-4 w-4 mr-1" />
                  {mode.duration}
                </div>
              </div>
            );
          })}
        </div>

        {/* Interview Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Generic Interview */}
          <div className="card text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-secondary-100 rounded-full mx-auto mb-4">
              <Play className="h-8 w-8 text-secondary-600" />
            </div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-2">
              Generic Practice
            </h3>
            <p className="text-secondary-600 mb-4">
              Practice with general questions for your skill level
            </p>
            <button
              onClick={startInterview}
              disabled={isLoading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Generic Interview
                </>
              )}
            </button>
          </div>

          {/* Job-Specific Interview */}
          <div className="card text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mx-auto mb-4">
              <Briefcase className="h-8 w-8 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-2">
              Job-Specific Practice
            </h3>
            <p className="text-secondary-600 mb-4">
              Upload a job description for tailored interview questions
            </p>
            <button
              onClick={() => setShowJobUpload(true)}
              className="btn-primary w-full"
            >
              <Briefcase className="h-4 w-4 mr-2" />
              Upload Job Description
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-secondary-900 mb-1">
              {String(interviewStats?.totalInterviews || 0)}
            </h3>
            <p className="text-sm text-secondary-600">Total Interviews</p>
          </div>
          
          <div className="card text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-secondary-900 mb-1">
              {String(interviewStats?.averageScore || 0)}%
            </h3>
            <p className="text-sm text-secondary-600">Average Score</p>
          </div>
          
          <div className="card text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-2xl font-bold text-secondary-900 mb-1">
              {String(interviewStats?.questionsAnswered || 0)}
            </h3>
            <p className="text-sm text-secondary-600">Questions Answered</p>
          </div>
          
          <div className="card text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mx-auto mb-3">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <h3 className="text-2xl font-bold text-secondary-900 mb-1">
              {formatDuration(interviewStats?.totalTime || 0)}
            </h3>
            <p className="text-sm text-secondary-600">Total Practice Time</p>
          </div>
        </div>
      </div>
    );
  }

  // Render active interview
  if (activeTab === 'interview') {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Interview Header */}
        <div className="card mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab('start')}
                className="text-secondary-600 hover:text-secondary-800 p-1"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-secondary-900">
                  {String(interviewModes.find(m => m.id === interviewMode)?.title || 'Interview')}
                </h1>
                <p className="text-sm text-secondary-600">
                  Session ID: {String(sessionData?.id || 'Loading...')}
                </p>
                {/* Job Context Display */}
                {jobData && (
                  <div className="mt-2 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary-600" />
                    <span className="text-sm text-primary-600 font-medium">
                      {jobData.jobTitle} at {jobData.company || 'Company'}
                    </span>
                    <span className="text-xs text-secondary-500">
                      ({jobData.totalQuestions || 5} questions)
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={endInterview}
                className="btn-secondary text-sm px-3 py-2"
              >
                <Square className="h-4 w-4 mr-1" />
                End Interview
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Question */}
          <div className="card">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center">
              <BookOpen className="h-5 w-5 mr-2 text-primary-600" />
              Current Question
            </h2>
            
            {currentQuestion && (
              <div className="space-y-4">
                <div className="bg-secondary-50 p-4 rounded-lg">
                  <h3 className="font-medium text-secondary-900 mb-2">
                    {String(currentQuestion?.title || 'Loading question...')}
                  </h3>
                  <p className="text-secondary-700 text-sm">
                    {String(currentQuestion?.description || 'Question description will appear here...')}
                  </p>
                  {currentQuestion?.hints && Array.isArray(currentQuestion.hints) && (
                    <div className="mt-3 pt-3 border-t border-secondary-200">
                      <p className="text-xs text-secondary-500 mb-1">💡 Hints:</p>
                      <ul className="text-xs text-secondary-600 space-y-1">
                        {currentQuestion.hints.map((hint, idx) => (
                          <li key={idx}>• {String(hint || '')}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Your Answer
                  </label>
                  <textarea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    className="input-field w-full h-32 resize-none"
                    disabled={isLoading}
                  />
                </div>
                
                <button
                  onClick={submitAnswer}
                  disabled={!userAnswer.trim() || isLoading}
                  className="btn-primary w-full flex items-center justify-center"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Submit Answer
                </button>
              </div>
            )}
          </div>

          {/* Interview Chat */}
          <div className="card">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center">
              <MessageSquare className="h-5 w-5 mr-2 text-primary-600" />
              Interview Conversation
            </h2>
            
            <div className="h-96 overflow-y-auto space-y-4 custom-scrollbar">
              {conversation.map((msg) => {
                console.log('Rendering message:', msg);
                console.log('Message type:', typeof msg.message);
                console.log('Message value:', msg.message);
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.speaker === 'candidate' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-lg ${
                        msg.speaker === 'candidate'
                          ? 'bg-primary-600 text-white'
                          : 'bg-secondary-100 text-secondary-900'
                      }`}
                    >
                      <p className="text-sm">{String(msg?.message || '')}</p>
                    
                    {msg.type === 'feedback' && msg.score !== undefined && (
                      <div className="mt-2 pt-2 border-t border-secondary-200">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">Score:</span>
                          <span className={`px-2 py-1 rounded-full ${
                            (msg.score || 0) >= 8 ? 'bg-green-100 text-green-800' :
                            (msg.score || 0) >= 6 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {String(msg.score || 0)}/10
                          </span>
                        </div>
                        
                        {msg?.suggestions && Array.isArray(msg.suggestions) && msg.suggestions.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium mb-1">Suggestions:</p>
                            <ul className="text-xs space-y-1">
                              {msg.suggestions.map((suggestion, idx) => (
                                <li key={idx}>• {String(suggestion || '')}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
              <div ref={chatEndRef} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render feedback screen
  if (activeTab === 'feedback') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-secondary-900 mb-4">
            Interview Complete!
          </h1>
          <p className="text-secondary-600 text-lg">
            Here's your performance analysis and feedback
          </p>
        </div>

        {feedback && (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="card text-center">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">
                Overall Performance
              </h2>
              <div className="text-6xl font-bold text-primary-600 mb-2">
                {String(feedback?.overallScore || 0)}/10
              </div>
              <p className="text-secondary-600">
                {(feedback?.overallScore || 0) >= 8 ? 'Excellent!' :
                 (feedback?.overallScore || 0) >= 6 ? 'Good job!' :
                 (feedback?.overallScore || 0) >= 4 ? 'Keep practicing!' :
                 'More practice needed'}
              </p>
            </div>

            {/* Detailed Feedback */}
            <div className="card">
              <h2 className="text-xl font-semibold text-secondary-900 mb-4">
                Detailed Feedback
              </h2>
              <div className="space-y-4">
                {feedback?.categories && Array.isArray(feedback.categories) && feedback.categories.map((category, idx) => (
                  <div key={idx} className="border-b border-secondary-200 pb-4 last:border-b-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-secondary-900">
                        {String(category?.name || 'Category')}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        (category?.score || 0) >= 8 ? 'bg-green-100 text-green-800' :
                        (category?.score || 0) >= 6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {String(category?.score || 0)}/10
                      </span>
                    </div>
                    <p className="text-sm text-secondary-600 mb-2">
                      {String(category?.feedback || 'No feedback available')}
                    </p>
                    {category?.suggestions && Array.isArray(category.suggestions) && (
                      <ul className="text-sm text-secondary-600 space-y-1">
                        {category.suggestions.map((suggestion, sIdx) => (
                          <li key={sIdx} className="flex items-start">
                            <span className="text-primary-600 mr-2">•</span>
                            {String(suggestion || '')}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setActiveTab('start')}
                className="btn-secondary px-6 py-3"
              >
                <Play className="h-5 w-5 mr-2" />
                Practice Again
              </button>
              <button
                onClick={saveInterview}
                className="btn-primary px-6 py-3"
              >
                <Save className="h-5 w-5 mr-2" />
                Save & Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default MockInterview;
