import Editor from '@monaco-editor/react';
import { Camera, CameraOff, Code, Mic, Play, Square, Volume2, VolumeX } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import io from 'socket.io-client';

const VoiceInterview = ({ 
  currentQuestion, 
  onAnswerSubmit, 
  onInterviewEnd, 
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
    
    // Listen for real-time responses
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
  
  // Stop listening and process answer
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setIsProcessing(true);
      
      // Process the final transcript via WebSocket
      if (transcript.trim()) {
        processAnswerViaWebSocket(transcript);
      }
    }
  }, [isListening, transcript, sessionData?.id]);
  
  // Process user's answer via WebSocket for real-time communication
  const processAnswerViaWebSocket = (answer) => {
    if (socketRef.current && sessionData?.id) {
      // Send answer via WebSocket for immediate processing
      socketRef.current.emit('interview:voice-end', {
        sessionId: sessionData.id,
        questionId: currentQuestion?.id,
        completeAnswer: answer,
        code: showCodeEditor ? currentCode : null
      });
      
      // Set a timeout for processing (30 seconds max)
      const processingTimeout = setTimeout(() => {
        if (isProcessing) {
          setIsProcessing(false);
          speakText('Processing is taking longer than expected. Please try again or contact support.');
        }
      }, 30000);
      
      // Listen for response to clear timeout
      const handleResponse = (data) => {
        clearTimeout(processingTimeout);
        setIsProcessing(false);
        
        // Remove the one-time listener
        socketRef.current.off('interview:ai-response', handleResponse);
      };
      
      socketRef.current.once('interview:ai-response', handleResponse);
      
    } else {
      // Fallback to HTTP if WebSocket not available
      processAnswer(answer);
    }
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
  
  // Speak the current question
  const speakQuestion = (question) => {
    const questionText = `${question.title}. ${question.description}`;
    speakText(questionText);
  };
  
  // Speak current question on mount
  useEffect(() => {
    if (currentQuestion) {
      speakQuestion(currentQuestion);
    }
  }, [currentQuestion]);
  
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
                <span>• {jobData.totalQuestions || 15} questions</span>
              </div>
            )}
          </div>
          
          <button
            onClick={onInterviewEnd}
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
          {/* Current Question */}
          <div className="p-6 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Code className="h-5 w-5 mr-2 text-blue-400" />
              Current Question
            </h3>
            
            {currentQuestion && (
              <div className="space-y-4">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h4 className="font-medium text-white mb-2">
                    {currentQuestion.title}
                  </h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {currentQuestion.description}
                  </p>
                  
                  {/* Question Context */}
                  {currentQuestion.context && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <p className="text-xs text-gray-400 mb-1">Context:</p>
                      <p className="text-xs text-gray-300">{currentQuestion.context}</p>
                    </div>
                  )}
                </div>
                
                {/* Code Editor Toggle */}
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
            )}
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
            {isListening ? 'Click the red button to stop recording' : 
             isProcessing ? 'Processing your answer...' : 
             'Click the microphone to start answering'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoiceInterview;
