import {
  BarChart3,
  Briefcase,
  ChevronLeft,
  Clock,
  Mail,
  Play,
  Save,
  Target,
  TrendingUp
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JobDescriptionUpload from '../components/JobDescriptionUpload';
import VoiceInterview from '../components/VoiceInterview';
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
  
  // Interview phase state
  const [interviewPhase, setInterviewPhase] = useState('greeting'); // greeting, questioning, complete
  
  // ✨ NEW: Conversation memory state for tracking interview progress
  const [conversationMemory, setConversationMemory] = useState({
    userResponses: [],
    topicsDiscussed: [],
    currentTopic: null,
    followUpNeeded: [],
    interviewProgress: 0,
    currentPhase: 'introduction',
    topicCoverage: {},
    phaseStartTime: Date.now(),
    lastTopicChange: Date.now()
  });
  
  const chatEndRef = useRef(null);
  const [conversation, setConversation] = useState([]);

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
          userLevel: 'intermediate',
          jobDescription: jobData?.jobDescription,
          jobTitle: jobData?.jobTitle,
          company: jobData?.company
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Interview start response:', data);
        console.log('Welcome message type:', typeof data.welcomeMessage);
        console.log('Welcome message value:', data.welcomeMessage);
        
        setSessionData(data.session);
        setActiveTab('VoiceInterview');
        
        // ✨ NEW: Don't set currentQuestion immediately
        // Store the first question but don't show it yet
        if (data.interviewQuestions && data.interviewQuestions.length > 0) {
          setJobData(prev => ({
            ...prev,
            questions: data.interviewQuestions,
            totalQuestions: data.interviewQuestions.length
          }));
        }
        
        // ✨ NEW: Start with greeting phase instead of first question
        // The VoiceInterview component will handle the greeting
        setInterviewPhase('greeting');
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
          answer: userMessage.message
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
      setActiveTab('VoiceInterview');
      
      const response = await fetch('/api/mock-interview/start-with-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        
        // Store job context and questions for the interview
        setJobData({
          ...jobInfo,
          analysis: data.jobAnalysis,
          totalQuestions: data.totalQuestions,
          questions: data.interviewQuestions || []
        });
        
        // ✨ NEW: Start with greeting phase instead of first question
        setInterviewPhase('greeting');
        
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
    
    // Get current conversation progress from VoiceInterview component
    const conversationTurns = conversationMemory?.interviewProgress || 0;
    const minimumForFeedback = 8; // Minimum turns needed for meaningful feedback
    
    console.log(`🔚 Manual end: ${conversationTurns} conversation turns completed`);
    
    try {
      const response = await fetch('/api/mock-interview/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionData.id,
          conversationMemory: conversationMemory, // Pass the conversation data
          earlyTermination: conversationTurns < minimumForFeedback
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Received end interview feedback:', data.feedback);
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

  // ✅ ENHANCED: Save interview feedback with email option
  const handleSaveFeedback = async (sendEmail = false) => {
    if (!feedback || !sessionData) return;
    
    try {
      const response = await fetch('/api/mock-interview/save-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionData.id,
          feedback: feedback,
          emailCopy: sendEmail
        }),
      });
      
      const data = await response.json();
      
      if (data.message) {
        const message = sendEmail && data.emailSent ? 
          'Feedback saved and emailed to you!' : 
          'Feedback saved successfully!';
        
        // Show success message
        alert(message);
        
        // Redirect to dashboard after a delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (error) {
      console.error('Error saving feedback:', error);
      alert('Failed to save feedback');
    }
  };

  // Legacy save function for backward compatibility
  const saveInterview = () => handleSaveFeedback(false);



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
            AI-Powered Job Interview Practice
          </h1>
          <p className="text-secondary-600 text-lg">
            Upload a job description and get personalized interview questions tailored to the specific role
          </p>
        </div>

        {/* Main Job Upload Option */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="card text-center">
            <div className="flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mx-auto mb-6">
              <Briefcase className="h-10 w-10 text-primary-600" />
            </div>
            <h2 className="text-2xl font-semibold text-secondary-900 mb-3">
              Start Job-Specific Interview
            </h2>
            <p className="text-secondary-600 mb-6 text-lg">
              Our AI analyzes job descriptions and generates dynamic questions based on the specific skills and requirements for each role.
            </p>
            <button
              onClick={() => setShowJobUpload(true)}
              className="btn-primary text-lg px-8 py-4"
            >
              <Briefcase className="h-5 w-5 mr-2" />
              Upload Job Description & Start Interview
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
  if (activeTab === 'VoiceInterview') {
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
                  AI-Powered Interview
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
                      ({jobData?.analysis?.jobAnalysis?.requiredSkills?.length || 'Multiple'} skills)
                    </span>
                  </div>
                )}
                
                {/* Interview Phase Display */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-secondary-500">
                    🎯 {interviewPhase === 'greeting' ? 'Introduction Phase' : 
                         interviewPhase === 'questioning' ? `Question ${(jobData?.currentQuestionIndex || 0) + 1}/${jobData?.totalQuestions || 15}` : 
                         'Interview Complete'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* End Interview button removed - only VoiceInterview component has the button */}
          </div>
        </div>

        {/* Voice Interview Component */}
        <VoiceInterview
          currentQuestion={currentQuestion}
          onAnswerSubmit={(question) => setCurrentQuestion(question)}
          onInterviewEnd={(feedback) => {
            setFeedback(feedback);
            setActiveTab('feedback');
          }}
          onConversationUpdate={(memory) => {
            setConversationMemory(memory);
          }}
          jobData={jobData}
          sessionData={sessionData}
        />

      </div>
    );
  }

  // Render feedback screen
  if (activeTab === 'feedback') {
    // Show early termination screen if interview was ended early
    if (feedback?.incomplete && feedback?.earlyTermination) {
      return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-secondary-900 mb-4">
              Interview Ended Early
            </h1>
            <p className="text-secondary-600 text-lg">
              Complete the full interview to receive detailed feedback
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8 text-center mb-8">
            <div className="flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mx-auto mb-6">
              <Clock className="h-10 w-10 text-yellow-600" />
            </div>
            
            <h2 className="text-2xl font-semibold text-secondary-900 mb-4">
              Interview Incomplete
            </h2>
            
            <p className="text-secondary-600 mb-6">
              {feedback.summary}
            </p>
            
            <p className="text-secondary-700 mb-6">
              {feedback.recommendation}
            </p>

            {/* Next Steps */}
            <div className="bg-secondary-50 rounded-lg p-6 mb-6 text-left">
              <h3 className="font-semibold text-secondary-900 mb-3">To get comprehensive feedback:</h3>
              <ul className="space-y-2">
                {feedback.nextSteps?.map((step, idx) => (
                  <li key={idx} className="flex items-start">
                    <Target className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-secondary-700">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <button
                onClick={() => setActiveTab('start')}
                className="btn-primary flex items-center justify-center px-8 py-3 text-lg"
              >
                <Play className="h-5 w-5 mr-2" />
                Try Complete Interview
              </button>
              
              <button
                onClick={() => navigate('/')}
                className="btn-secondary flex items-center justify-center px-8 py-3 text-lg"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

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
                {feedback?.overallScore !== undefined ? feedback.overallScore : 0}/10
              </div>
              <p className="text-secondary-600">
                {(feedback?.overallScore !== undefined && feedback.overallScore >= 8) ? 'Excellent!' :
                 (feedback?.overallScore !== undefined && feedback.overallScore >= 6) ? 'Good job!' :
                 (feedback?.overallScore !== undefined && feedback.overallScore >= 4) ? 'Keep practicing!' :
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
                onClick={() => handleSaveFeedback(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Save className="h-5 w-5" />
                <span>Save & Go to Dashboard</span>
              </button>
              
              <button
                onClick={() => handleSaveFeedback(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Mail className="h-5 w-5" />
                <span>Save & Email Me</span>
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
