import Editor from '@monaco-editor/react';
import { Camera, CameraOff, Code, MessageSquare, Mic, Play, Square, Volume2, VolumeX } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import io from 'socket.io-client';

const VoiceInterview = ({ 
  currentQuestion, 
  onAnswerSubmit, 
  onInterviewEnd, 
  onConversationUpdate,
  jobData,
  sessionData 
}) => {
  // Voice and camera state
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [interviewerSpeaking, setInterviewerSpeaking] = useState(false);
  
  // Code editor state
  const [currentCode, setCurrentCode] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  
  // Speech recognition and synthesis
  const [transcript, setTranscript] = useState('');
  const [speechText, setSpeechText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // ✨ NEW: Interview phase state
  const [interviewPhase, setInterviewPhase] = useState('greeting'); // greeting, questioning, complete
  const [isWaitingForUserResponse, setIsWaitingForUserResponse] = useState(false);
  
  // ✨ ENHANCED: Structured interview phases and memory
  const [conversationMemory, setConversationMemory] = useState({
    topicsDiscussed: [],
    userResponses: [],
    currentTopic: 'introduction',
    followUpNeeded: [],
    interviewProgress: 0,
    currentPhase: 'introduction',
    topicCoverage: {},
    phaseStartTime: Date.now(),
    lastTopicChange: Date.now()
  });
  
  const [isInConversation, setIsInConversation] = useState(false);
  
  // ✨ NEW: Add session persistence to handle disconnections
  const [sessionLost, setSessionLost] = useState(false);
  const sessionDataRef = useRef(null);
  const conversationMemoryRef = useRef(null);

  // Store session data in refs so it persists through disconnections
  useEffect(() => {
    sessionDataRef.current = sessionData;
  }, [sessionData]);

  useEffect(() => {
    conversationMemoryRef.current = conversationMemory;
    // ✨ NEW: Pass conversation memory updates to parent component
    if (onConversationUpdate) {
      onConversationUpdate(conversationMemory);
    }
  }, [conversationMemory, onConversationUpdate]);
  
  const hasGreetingBeenSpokenRef = useRef(false);
  // Refs
  const webcamRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthesisRef = useRef(null);
  const socketRef = useRef(null);
  
  // Initialize WebSocket connection
  useEffect(() => {
    // Connect to WebSocket server with proper configuration
    socketRef.current = io('http://localhost:5001', {
      auth: {
        token: 'test-token-123' // Use auth token from context
      },
      transports: ['websocket', 'polling'],
      timeout: 10000
    });
    
    // Authenticate with WebSocket server
    socketRef.current.emit('authenticate', { token: 'test-token-123' });
    
    // Wait for authentication before joining session
    socketRef.current.on('authenticated', (data) => {
      console.log('WebSocket authenticated:', data);
      
      // Join interview session after authentication
      if (sessionData?.id) {
        socketRef.current.emit('join-interview-session', sessionData.id);
      }
    });
    
    // Handle authentication errors
    socketRef.current.on('authentication_error', (data) => {
      console.error('WebSocket authentication failed:', data);
    });
    
    // Handle WebSocket errors
    socketRef.current.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    // Handle connection errors
    socketRef.current.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
    
    // ✨ ENHANCED: Listen for structured conversation responses
    socketRef.current.on('interview:conversation-response', (data) => {
      console.log('Received conversation response:', data);
      
      const { aiResponse, conversationUpdate, interviewStatus, finalFeedback } = data;
      
      // Enhanced conversation memory update with structured progression
      if (conversationUpdate) {
        setConversationMemory(prev => {
          const updatedMemory = {
            ...prev,
            ...conversationUpdate,
            topicsDiscussed: [...new Set([...prev.topicsDiscussed, ...(conversationUpdate.newTopics || [])])],
            lastTopicChange: Date.now()
          };
          
          // Log topic transition for debugging
          if (conversationUpdate.currentTopic !== prev.currentTopic) {
            console.log(`🔄 Topic transition: ${prev.currentTopic} → ${conversationUpdate.currentTopic}`);
          }
          
          return updatedMemory;
        });
      }
      
      // Handle different conversation scenarios
      if (interviewStatus === 'interview_complete') {
        // ✨ FIXED: Properly handle natural completion
        console.log('🏁 Interview completed naturally');
        speakText(aiResponse.message);
        
        // Wait for AI to finish speaking, then end
        setTimeout(() => {
          onInterviewEnd(finalFeedback); // This will show the feedback screen
        }, 4000); // Give AI time to speak
        
      } else if (interviewStatus === 'continue_conversation') {
        // AI is continuing the conversation naturally
        speakText(aiResponse.message);
        setIsProcessing(false);
        
        // Update UI to show current topic and progress
        console.log(`💬 AI response: ${aiResponse.message} (${aiResponse.type})`);
        
      } else if (interviewStatus === 'topic_transition') {
        // AI is transitioning to a new topic
        speakText(aiResponse.transitionMessage || aiResponse.message);
        setIsProcessing(false);
        
        // Show topic transition in UI
        console.log(`🔄 Topic transition to: ${conversationUpdate.currentTopic}`);
      }
    });
    
    // Keep the old handler for backward compatibility during transition
    socketRef.current.on('interview:ai-response', (data) => {
      if (data.interviewComplete) {
        onInterviewEnd(data.finalFeedback);
      } else if (data.nextQuestion) {
        speakQuestion(data.nextQuestion);
      }
      
      // Speak the feedback
      if (data.feedback) {
        speakText(data.feedback);
      }
    });
    
    // Listen for processing status
    socketRef.current.on('interview:processing-status', (data) => {
      console.log('Processing status:', data);
    });
    
    // Listen for errors
    socketRef.current.on('interview:error', (data) => {
      console.error('Interview error:', data);
      speakText(`Error: ${data.message}`);
    });
    
    // Listen for general WebSocket errors
    socketRef.current.on('error', (data) => {
      console.error('WebSocket error:', data);
    });
    
    // Listen for connection status
    socketRef.current.on('connect', () => {
      console.log('WebSocket connected successfully');
    });
    
    socketRef.current.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [sessionData?.id]);
  
  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        setTranscript(finalTranscript);
        setSpeechText(finalTranscript + interimTranscript);
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
    
    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
      synthesisRef.current = window.speechSynthesis;
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);
  
  // Start listening for user's answer
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      setTranscript('');
      setSpeechText('');
      
      // Notify server that user started speaking
      if (socketRef.current && sessionData?.id) {
        socketRef.current.emit('interview:voice-start', {
          sessionId: sessionData.id
        });
      }
      
      recognitionRef.current.start();
    }
  }, [isListening, sessionData?.id]);
  
  // ✨ NEW: Enhanced stopListening for continuous conversation
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setIsProcessing(true);
      
      if (transcript.trim()) {
        if (interviewPhase === 'greeting') {
          // Handle greeting response
          handleGreetingResponse(transcript);
        } else if (interviewPhase === 'questioning') {
          // NEW: Handle as continuous conversation instead of discrete Q&A
          handleContinuousConversation(transcript);
        }
      }
    }
  }, [isListening, transcript, interviewPhase, conversationMemory]);
  
  // Process user's answer via WebSocket for real-time communication
  const processAnswerViaWebSocket = (answer) => {
    if (socketRef.current && sessionData?.id) {
      // ✅ FIXED: Use the new conversation flow instead of old discrete Q&A
      console.log('🔄 Sending conversation turn via WebSocket');
      socketRef.current.emit('interview:conversation-turn', {
        sessionId: sessionData.id,
        userResponse: answer,
        conversationMemory: conversationMemory,
        jobContext: {
          jobTitle: jobData?.jobTitle || sessionData?.jobTitle,
          company: jobData?.company || sessionData?.company,
          jobAnalysis: sessionData?.jobAnalysis || jobData?.analysis?.jobAnalysis
        }
      });
      
      setIsProcessing(true);
      
    } else {
      console.warn('⚠️ WebSocket not available, falling back to HTTP');
      // Fallback to HTTP if WebSocket not available
      processAnswer(answer);
    }
  };
  
  // ✨ NEW: Handle greeting response
  const handleGreetingResponse = (response) => {
    const lowerResponse = response.toLowerCase();
    
    // Check if user is ready to start
    if (lowerResponse.includes('yes') || lowerResponse.includes('ready') || 
        lowerResponse.includes('let\'s start') || lowerResponse.includes('begin')) {
      
      // User is ready - emit greeting complete event
      if (socketRef.current && sessionData?.id) {
        socketRef.current.emit('interview:greeting-complete', {
          sessionId: sessionData.id,
          userResponse: response,
          readyToStart: true
        });
      }
      
      speakText("Great! Let's begin with the first question.");
      
      // Move to questioning phase
      setTimeout(() => {
        setInterviewPhase('questioning');
        setIsWaitingForUserResponse(false);
        setIsInConversation(true);
        
        // Initialize with a proper conversation starter instead of discrete question
        setConversationMemory(prev => ({
          ...prev,
          currentTopic: 'introduction and background',
          interviewProgress: 0
        }));
        
        // Send first conversational prompt to backend
        if (socketRef.current && sessionData?.id) {
          const initialMemory = {
            topicsDiscussed: ['introduction'],
            userResponses: [],
            currentTopic: 'introduction and background',
            followUpNeeded: [],
            interviewProgress: 0,
            currentPhase: 'introduction',
            topicCoverage: {},
            phaseStartTime: Date.now(),
            lastTopicChange: Date.now()
          };
          
          // ✅ CORRECTED: Use the actual job analysis from the session data
          const jobContext = {
            jobTitle: jobData?.jobTitle || sessionData?.jobTitle || 'Technical Role',
            company: jobData?.company || sessionData?.company || 'Company',
            // Try multiple paths to find the correct job analysis
            jobAnalysis: sessionData?.jobAnalysis || // From backend session
                         jobData?.analysis?.jobAnalysis || // From frontend analysis
                         jobData?.jobAnalysis || // Direct path
                         null // Let backend handle fallback
          };
          
          console.log('📋 Initial job context:', JSON.stringify(jobContext, null, 2));
          
          socketRef.current.emit('interview:conversation-turn', {
            sessionId: sessionData.id,
            userResponse: "I'm ready to begin the interview",
            conversationMemory: initialMemory,
            jobContext: jobContext
          });
        }
        
        setIsProcessing(false);
      }, 2000); // Wait for AI to finish speaking
      
    } else {
      // User might need clarification
      const clarification = "No problem! Take your time. Just let me know when you're ready to start the interview by saying 'I'm ready' or 'let's begin'.";
      speakText(clarification);
      setIsProcessing(false);
    }
  };

  // ✨ CORRECTED: Use actual job analysis instead of fallbacks
  const handleContinuousConversation = (userResponse) => {
    console.log('🔄 Processing continuous conversation response:', userResponse);
    
    const newMemory = {
      ...conversationMemory,
      userResponses: [...conversationMemory.userResponses, {
        response: userResponse,
        timestamp: new Date(),
        topic: conversationMemory.currentTopic,
        isSubstantial: userResponse.length > 30,
        containsKeywords: extractKeywords(userResponse, conversationMemory.currentTopic)
      }],
      interviewProgress: conversationMemory.interviewProgress + 1,
      topicCoverage: {
        ...conversationMemory.topicCoverage,
        [conversationMemory.currentTopic]: true
      }
    };
    
    console.log('📝 Updated conversation memory:', newMemory);
    setConversationMemory(newMemory);
    
    // ✅ CORRECTED: Use the actual job analysis from the session data
    const jobContext = {
      jobTitle: jobData?.jobTitle || sessionData?.jobTitle || 'Technical Role',
      company: jobData?.company || sessionData?.company || 'Company',
      // Try multiple paths to find the correct job analysis
      jobAnalysis: sessionData?.jobAnalysis || // From backend session
                   jobData?.analysis?.jobAnalysis || // From frontend analysis
                   jobData?.jobAnalysis || // Direct path
                   null // Let backend handle fallback
    };
    
    console.log('📋 Job context being sent:', JSON.stringify(jobContext, null, 2));
    
    if (socketRef.current && sessionData?.id) {
      console.log('📡 Sending conversation turn to backend...');
      socketRef.current.emit('interview:conversation-turn', {
        sessionId: sessionData.id,
        userResponse: userResponse,
        conversationMemory: newMemory,
        jobContext: jobContext
      });
    } else {
      console.error('❌ Cannot send conversation turn: socket or session not available');
    }
  };

  // ✨ NEW: Helper function to extract keywords from user responses
  const extractKeywords = (response, topic) => {
    const topicKeywords = getTopicKeywords(topic);
    return topicKeywords.filter(keyword => 
      response.toLowerCase().includes(keyword.toLowerCase())
    );
  };

  // ✨ NEW: Helper function to get topic keywords
  const getTopicKeywords = (topic) => {
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
  };

  // ✨ REMOVED: Old helper function that was overriding real job analysis with fallbacks

  // ✨ ENHANCED: Generate feedback with session loss handling
  // ✨ ENHANCED: Generate feedback with comprehensive session handling
const generateInterviewFeedback = async () => {
  try {
    // ✅ STOP AI SPEAKING IMMEDIATELY
    stopAISpeaking();
    
    console.log('📊 Requesting final feedback generation...');
    
    // Use stored session data if current session is lost
    const sessionToUse = sessionData || sessionDataRef.current;
    const memoryToUse = conversationMemory || conversationMemoryRef.current;
    
    console.log('🔍 Session data available:', !!sessionToUse);
    console.log('🔍 Memory data available:', !!memoryToUse);
    console.log('🔍 Response count:', memoryToUse?.userResponses?.length || 0);
    
    // ✨ ENHANCED: Always try to generate feedback, even without session ID
    const requestBody = {
      sessionId: sessionToUse?.id || `fallback-${Date.now()}`,
      conversationMemory: memoryToUse,
      jobContext: {
        jobTitle: jobData?.jobTitle || sessionToUse?.jobTitle || 'Technical Role',
        company: jobData?.company || sessionToUse?.company || 'Company',
        jobAnalysis: sessionToUse?.jobAnalysis || jobData?.analysis?.jobAnalysis
      }
    };
    
    console.log('📤 Sending feedback request:', JSON.stringify({
      sessionId: requestBody.sessionId,
      responseCount: requestBody.conversationMemory?.userResponses?.length || 0,
      hasJobContext: !!requestBody.jobContext.jobAnalysis
    }, null, 2));
    
    // ✨ ENHANCED: Always attempt server feedback first
    let serverFeedback = null;
    try {
      const response = await fetch('/api/mock-interview/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Server feedback received:', data.feedback);
        serverFeedback = data.feedback;
      } else {
        console.warn('⚠️ Server feedback failed:', response.status, response.statusText);
      }
    } catch (serverError) {
      console.warn('⚠️ Server feedback error:', serverError.message);
    }
    
    // ✨ ENHANCED: Validate feedback quality
    let finalFeedback = serverFeedback;
    
    if (!finalFeedback || finalFeedback.overallScore === 0) {
      console.warn('⚠️ Server feedback invalid, generating local fallback');
      finalFeedback = generateLocalFeedbackFromMemory(memoryToUse);
    }
    
    // ✨ ENHANCED: Final validation
    if (!finalFeedback || typeof finalFeedback.overallScore !== 'number') {
      console.error('❌ All feedback generation failed, using emergency fallback');
      finalFeedback = generateEmergencyFeedback(memoryToUse);
    }
    
    console.log('✅ Final feedback validated:', {
      source: serverFeedback ? 'server' : 'local',
      score: finalFeedback.overallScore,
      categories: finalFeedback.categories?.length || 0
    });
    
    onInterviewEnd(finalFeedback);
    
  } catch (error) {
    console.error('❌ Error in feedback generation:', error);
    stopAISpeaking(); // Also stop on error
    const emergencyFeedback = generateEmergencyFeedback(conversationMemory || conversationMemoryRef.current);
    onInterviewEnd(emergencyFeedback);
  }
};

// ✨ ENHANCED: Local feedback generation with better scoring
const generateLocalFeedbackFromMemory = (memory) => {
  const responses = memory?.userResponses || [];
  const topicsCovered = memory?.topicsDiscussed || [];
  
  console.log(`🔧 Generating local feedback: ${responses.length} responses, ${topicsCovered.length} topics`);
  
  // ✨ ENHANCED: Better scoring algorithm
  let score = 4; // Base score for attempting interview
  
  // Response quantity scoring
  if (responses.length >= 1) score += 1; // Basic participation
  if (responses.length >= 2) score += 1; // Good participation  
  if (responses.length >= 3) score += 1; // Strong participation
  
  // Response quality scoring
  const averageLength = responses.reduce((sum, r) => sum + r.response.length, 0) / responses.length;
  if (averageLength > 50) score += 1; // Detailed responses
  if (averageLength > 100) score += 1; // Very detailed responses
  
  // Technical content scoring
  const technicalTerms = ['java', 'node', 'database', 'project', 'api', 'application', 
                         'development', 'microservice', 'security', 'platform', 'architecture'];
  
  const technicalContent = responses.some(r => {
    const response = r.response.toLowerCase();
    return technicalTerms.some(term => response.includes(term));
  });
  
  if (technicalContent) score += 1;
  
  // Topic coverage scoring
  if (topicsCovered.length >= 1) score += 0.5;
  if (topicsCovered.length >= 2) score += 0.5;
  
  score = Math.min(Math.round(score), 9); // Cap at 9 for partial interviews
  
  const responseCount = responses.length;
  const topicCount = topicsCovered.length;
  
  return {
    overallScore: score,
    summary: `Interview session with ${responseCount} technical responses covering ${topicCount} topic areas. ${
      responseCount >= 3 ? 'Strong engagement with technical discussion and good depth in responses.' : 
      responseCount >= 2 ? 'Good participation with some technical detail, though more depth would improve assessment.' :
      responseCount >= 1 ? 'Basic participation shown, but brief session limits comprehensive evaluation.' :
      'Very brief session - complete interviews provide much better skill assessment.'
    }`,
    categories: [
      {
        name: 'Technical Discussion',
        score: Math.min(score, 8),
        feedback: `Provided ${responseCount} technical responses. ${
          technicalContent ? 'Demonstrated good understanding of technical concepts including Java, microservices, and security.' : 
          'Basic technical discussion, could benefit from more specific technical examples.'
        }`,
        suggestions: responseCount >= 3 ? 
          ['Continue building on your strong technical foundation', 'Practice explaining complex architectures in detail'] :
          ['Complete longer interviews for comprehensive assessment', 'Provide specific technical examples with more detail', 'Practice explaining technical concepts step-by-step']
      },
      {
        name: 'Interview Engagement', 
        score: Math.min(score + 1, 8),
        feedback: `${responseCount >= 3 ? 'Excellent' : responseCount >= 2 ? 'Good' : 'Basic'} engagement with ${topicCount} topic areas during the session.`,
        suggestions: responseCount >= 3 ? 
          ['Maintain this level of engagement in future interviews', 'Continue with advanced technical topics'] :
          ['Practice completing full interview sessions', 'Work on sustained engagement throughout longer interviews']
      },
      {
        name: 'Communication',
        score: score,
        feedback: `Clear communication demonstrated in the ${responseCount} responses provided. ${
          averageLength > 100 ? 'Responses were detailed and well-structured.' :
          averageLength > 50 ? 'Good level of detail in explanations.' :
          'Responses were clear but could be more comprehensive.'
        }`,
        suggestions: averageLength > 100 ? 
          ['Excellent communication skills demonstrated', 'Continue with this level of detail'] :
          ['Practice providing more comprehensive explanations', 'Work on structured technical communication', 'Include specific examples in responses']
      }
    ],
    strengths: [
      responseCount >= 3 ? 'Strong interview engagement and participation' : responseCount >= 2 ? 'Good interview participation' : 'Willingness to engage with technical topics',
      technicalContent ? 'Demonstrated solid technical knowledge and understanding' : 'Basic technical understanding shown',
      topicCount >= 2 ? 'Successfully covered multiple technical areas' : topicCount >= 1 ? 'Engaged with interview topics effectively' : 'Participated in technical discussion'
    ],
    improvements: [
      responseCount < 4 ? 'Complete full interview sessions (8+ questions) for comprehensive assessment' : 'Continue building technical depth with advanced scenarios',
      'Provide more detailed explanations with specific technical examples',
      'Practice explaining complex technical concepts in a structured way',
      technicalContent ? 'Expand on advanced technical concepts and system design' : 'Include more specific technical terminology and examples'
    ],
    actionPlan: `Based on your ${responseCount} responses and ${score}/10 performance: ${
      score >= 8 ? 'You\'re performing well - continue with advanced technical interview practice and system design scenarios.' :
      score >= 6 ? 'Focus on completing full interviews (8+ questions) and providing more detailed technical explanations with specific examples.' :
      score >= 4 ? 'Work on fundamental technical communication skills and complete longer practice interviews to build confidence.' :
      'Start with basic technical interview practice, focusing on clear explanations and completing full interview sessions.'
    }`
  };
};

// ✨ NEW: Emergency fallback for worst-case scenarios
const generateEmergencyFeedback = (memory) => {
  const responses = memory?.userResponses || [];
  
  return {
    overallScore: Math.min(responses.length + 3, 6), // 3-6 range based on participation
    summary: `Interview session attempted with ${responses.length} responses. Session ended early - complete interviews provide more comprehensive skill assessment.`,
    categories: [
      {
        name: 'Session Participation',
        score: Math.min(responses.length + 4, 7),
        feedback: `Participated in interview session with ${responses.length} responses.`,
        suggestions: ['Complete full interview sessions for better assessment', 'Practice with longer technical discussions']
      }
    ],
    strengths: ['Attempted technical interview practice', 'Showed willingness to engage'],
    improvements: ['Complete longer interview sessions', 'Practice detailed technical explanations'],
    actionPlan: 'Focus on completing full practice interviews to get comprehensive feedback on your technical skills.'
  };
  };
  
  // Fallback HTTP-based answer processing
  const processAnswer = async (answer) => {
    try {
      // Send answer to backend for processing
      const response = await fetch('/api/mock-interview/submit-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionData?.id,
          questionId: currentQuestion?.id,
          answer: answer,
          code: showCodeEditor ? currentCode : null
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Speak the feedback
        speakText(data.feedback);
        
        // Handle next question or interview completion
        if (data.interviewComplete) {
          onInterviewEnd(data.finalFeedback);
        } else if (data.nextQuestion) {
          // Speak the next question
          speakQuestion(data.nextQuestion);
        }
      }
    } catch (error) {
      console.error('Error processing answer:', error);
      speakText('Sorry, there was an error processing your answer. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Speak text using speech synthesis
  const speakText = (text) => {
    if (synthesisRef.current && !isMuted) {
      setInterviewerSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setInterviewerSpeaking(false);
      utterance.onerror = () => setInterviewerSpeaking(false);
      synthesisRef.current.speak(utterance);
    }
  };

  // ✅ NEW: Add function to stop AI speaking
  const stopAISpeaking = () => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel(); // Stop any ongoing speech
      setInterviewerSpeaking(false);
    }
  };
  
  //const hasGreetingBeenSpokenRef = useRef(false);
  // ✨ NEW: Add greeting function
  const startInterviewGreeting = () => {

    if (hasGreetingBeenSpokenRef.current) {
      console.log('Greeting already spoken, skipping...');
      return;
    }
    
    const jobTitle = jobData?.jobTitle || 'this technical role';
    const company = jobData?.company || 'the company';
    const requiredSkills = jobData?.analysis?.jobAnalysis?.requiredSkills || [];
    const skillCount = requiredSkills.length;
    
    // ✅ NEW: Dynamic greeting based on actual job requirements
    const greeting = `Hello! Welcome to your interview for ${jobTitle} at ${company}. 
      I'm your AI interviewer today. I've analyzed the job description and will be conducting a comprehensive interview 
      covering the ${skillCount} key skills and competencies required for this role, including both technical abilities 
      and behavioral scenarios relevant to your potential responsibilities. 
      
      The duration will depend on how thoroughly we explore each area - typically 15 to 20 minutes. 
      Are you ready to begin? Please let me know when you're ready to start.`;
    
    speakText(greeting);
    setIsWaitingForUserResponse(true);
    hasGreetingBeenSpokenRef.current = true;
  };
  
  // Speak the current question
  const speakQuestion = (question) => {
    const questionText = `${question.title}. ${question.description}`;
    speakText(questionText);
  };
  
    // ✨ NEW: Modified useEffect to handle interview phases
  useEffect(() => {
    if (interviewPhase === 'greeting') {
      startInterviewGreeting();
    } else if (interviewPhase === 'questioning' && currentQuestion) {
      // Start continuous conversation mode
      if (!isInConversation) {
        setIsInConversation(true);
      }
      speakQuestion(currentQuestion);
    }
  }, [interviewPhase, currentQuestion, isInConversation]);
  
  // ✨ ENHANCED: Debug logging to see job data structure and flow
  useEffect(() => {
    console.log('🔍 VoiceInterview jobData received:', JSON.stringify(jobData, null, 2));
    console.log('🔍 VoiceInterview sessionData received:', JSON.stringify(sessionData, null, 2));
    
    // Log the specific paths we're checking for job analysis
    console.log('🔍 Job analysis paths check:');
    console.log('  - sessionData?.jobAnalysis:', sessionData?.jobAnalysis);
    console.log('  - jobData?.analysis?.jobAnalysis:', jobData?.analysis?.jobAnalysis);
    console.log('  - jobData?.jobAnalysis:', jobData?.jobAnalysis);
    
    // Show what would be used for job context
    const testContext = {
      jobTitle: jobData?.jobTitle || sessionData?.jobTitle || 'Technical Role',
      company: jobData?.company || sessionData?.company || 'Company',
      jobAnalysis: sessionData?.jobAnalysis || 
                   jobData?.analysis?.jobAnalysis || 
                   jobData?.jobAnalysis || 
                   null
    };
    console.log('🔍 Test job context that would be sent:', JSON.stringify(testContext, null, 2));
  }, [jobData, sessionData]);
  
  // ✨ NEW: Update interview phase when jobData changes (from parent)
  
  
  // Toggle camera
  const toggleCamera = () => {
    setCameraEnabled(!cameraEnabled);
  };
  
  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (synthesisRef.current) {
      if (!isMuted) {
        synthesisRef.current.cancel();
      }
    }
  };
  
  // Handle code execution
  const handleCodeExecution = async () => {
    if (!currentCode.trim()) return;
    
    try {
      const response = await fetch('/api/execute-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: currentCode,
          language: selectedLanguage
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        speakText(`Code executed successfully. Output: ${result.output}`);
      }
    } catch (error) {
      console.error('Error executing code:', error);
      speakText('There was an error executing your code. Please check the syntax.');
    }
  };
  
  // Video constraints for webcam
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: 'user'
  };
  
  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header with Interview Info */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Code className="h-5 w-5 text-blue-400" />
              <span className="text-lg font-semibold text-white">
                AI-Powered Interview
              </span>
            </div>
            {jobData && (
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <span>🎯 {jobData.jobTitle} at {jobData.company || 'Company'}</span>
                <span>• {jobData?.analysis?.jobAnalysis?.requiredSkills?.length || 'Multiple'} key skills</span>
                <span>•</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  interviewPhase === 'greeting' ? 'bg-blue-600 text-white' :
                  interviewPhase === 'questioning' ? (
                    isInConversation ? 'bg-purple-600 text-white' : 'bg-green-600 text-white'
                  ) :
                  'bg-gray-600 text-white'
                }`}>
                  {interviewPhase === 'greeting' ? 'Introduction Phase' : 
                   interviewPhase === 'questioning' ? (
                     isInConversation ? 'Continuous Conversation' : 'Questioning Phase'
                   ) : 
                   'Complete'}
                </span>
              </div>
            )}
          </div>
          
          <button
            onClick={() => {
              stopAISpeaking(); // Stop AI speaking immediately
              onInterviewEnd(); // Then end the interview
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Square className="h-4 w-4" />
            <span>End Interview</span>
          </button>
        </div>
      </div>
      
      {/* Main Interview Interface */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Full Height Camera */}
        <div className="flex-1 relative bg-black">
          {cameraEnabled ? (
            <div className="relative h-full">
              <Webcam
                ref={webcamRef}
                audio={false}
                videoConstraints={videoConstraints}
                className="w-full h-full object-cover rounded-none"
                mirrored={true}
              />
              
              {/* User Info Overlay */}
              <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg">
                <div className="text-sm font-medium">You</div>
                <div className="text-xs text-gray-300">Live</div>
              </div>
              
              {/* AI Speaking Indicator */}
              {interviewerSpeaking && (
                <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-lg animate-pulse">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">AI Speaking</span>
                  </div>
                </div>
              )}
              
              {/* Status Indicators */}
              <div className="absolute bottom-20 left-4 right-4">
                {isListening && (
                  <div className="bg-green-600 text-white px-4 py-2 rounded-lg text-center animate-pulse">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                      <span className="font-medium">Listening... Speak now!</span>
                    </div>
                  </div>
                )}
                
                {isProcessing && (
                  <div className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span className="font-medium">Processing your answer...</span>
                    </div>
                  </div>
                )}
                
                {/* ✨ NEW: Greeting Phase Indicator */}
                
                {/* ✨ NEW: Conversation Progress Indicator */}
                {interviewPhase === 'questioning' && isInConversation && (
                  <div className="bg-green-600 text-white px-4 py-2 rounded-lg text-center mt-2">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                      <span className="font-medium">
                        Current Topic: {conversationMemory.currentTopic} • Progress: {conversationMemory.interviewProgress}/15
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Transcript Display */}
                {speechText && (
                  <div className="bg-black bg-opacity-70 text-white px-4 py-3 rounded-lg mt-2">
                    <p className="text-sm">
                      <span className="font-medium">Your answer:</span> {speechText}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <CameraOff className="h-24 w-24 mx-auto mb-4" />
                <p className="text-lg font-medium">Camera Off</p>
                <p className="text-sm">Click the camera button to enable</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Right Side - Question and Code Editor */}
        <div className="w-96 bg-gray-800 flex flex-col">
          {/* ✨ NEW: Interview Conversation Interface */}
          <div className="p-6 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <MessageSquare className="h-5 w-5 mr-2 text-blue-400" />
              Interview Conversation
            </h3>
            
              <div className="space-y-4">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h4 className="font-medium text-white mb-2">
                  Current Topic: {conversationMemory.currentTopic}
                  </h4>
                <p className="text-gray-300 text-sm">
                  Progress: {conversationMemory.interviewProgress}/15 conversation turns
                  </p>
                  
                {/* ✨ NEW: Enhanced topic coverage display */}
                    <div className="mt-3 pt-3 border-t border-gray-600">
                  <p className="text-xs text-gray-400 mb-1">Topics covered:</p>
                  <div className="flex flex-wrap gap-1">
                    {conversationMemory.topicsDiscussed.map((topic, idx) => (
                      <span key={idx} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {topic}
                      </span>
                    ))}
                  </div>
                  
                  {/* ✨ NEW: Show topic coverage status */}
                  {conversationMemory.topicCoverage && Object.keys(conversationMemory.topicCoverage).length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1">Coverage:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(conversationMemory.topicCoverage).map(([topic, covered]) => (
                          <span key={topic} className={`text-xs px-2 py-1 rounded ${
                            covered ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {topic}: {covered ? '✓' : '○'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                </div>
                
              {/* Code Editor Toggle - Keep this for technical interviews */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    {showCodeEditor ? 'Code Editor Active' : 'Add code if needed'}
                  </span>
                  <button
                    onClick={() => setShowCodeEditor(!showCodeEditor)}
                    className="bg-gray-600 hover:bg-gray-500 text-white text-sm px-3 py-1 rounded transition-colors"
                  >
                    {showCodeEditor ? 'Hide Editor' : 'Show Code Editor'}
                  </button>
                </div>
              </div>
          </div>
          
          {/* Code Editor */}
          {showCodeEditor && (
            <div className="flex-1 p-6 border-b border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <Code className="h-5 w-5 mr-2 text-blue-400" />
                  Code Editor
                </h3>
                
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="text-sm bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                  </select>
                  
                  <button
                    onClick={handleCodeExecution}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded transition-colors"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Run
                  </button>
                </div>
              </div>
              
              <div className="border border-gray-600 rounded-lg overflow-hidden">
                <Editor
                  height="300px"
                  language={selectedLanguage}
                  value={currentCode}
                  onChange={setCurrentCode}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              </div>
                    </div>
                  )}
        </div>
      </div>
      
      {/* Bottom Control Bar - Video Call Style */}
      <div className="bg-gray-800 border-t border-gray-700 p-4 flex-shrink-0">
        <div className="flex items-center justify-center space-x-6">
          {/* Microphone Control */}
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing}
            className={`p-4 rounded-full transition-all duration-200 ${
              isListening 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-500 text-white'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isListening ? (
              <Square className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </button>
          
          {/* Camera Toggle */}
          <button
            onClick={toggleCamera}
            className={`p-4 rounded-full transition-all duration-200 ${
              cameraEnabled 
                ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {cameraEnabled ? (
              <Camera className="h-6 w-6" />
            ) : (
              <CameraOff className="h-6 w-6" />
            )}
          </button>
          
          {/* Mute/Unmute AI */}
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition-all duration-200 ${
              isMuted 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-500 text-white'
            }`}
          >
            {isMuted ? (
              <VolumeX className="h-6 w-6" />
            ) : (
              <Volume2 className="h-6 w-6" />
            )}
          </button>
        </div>
        
        {/* Status Text */}
        <div className="text-center mt-3">
          <p className="text-sm text-gray-400">
            {interviewPhase === 'greeting' ? (
              'AI is introducing the interview...'
            ) : interviewPhase === 'questioning' ? (
              isListening ? 'Click the red button to stop recording' : 
              isProcessing ? 'AI is analyzing your response...' : 
              isInConversation ? 'Click the microphone to continue the conversation' :
              'Click the microphone to start answering'
            ) : 'Interview complete'}
          </p>
          
          {/* ✨ NEW: Conversation Progress Indicator */}
          {interviewPhase === 'questioning' && (
            <div className="mt-2 text-xs text-gray-500">
              <span>Progress: {conversationMemory.interviewProgress} responses</span>
              {conversationMemory.currentTopic !== 'introduction' && (
                <span className="ml-3">• Current: {conversationMemory.currentTopic}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceInterview;
