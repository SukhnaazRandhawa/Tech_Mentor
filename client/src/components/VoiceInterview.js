import Editor from '@monaco-editor/react';
import { Camera, CameraOff, Code, Mic, Play, Square, Volume2, VolumeX } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';

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
      recognitionRef.current.start();
    }
  }, [isListening]);
  
  // Stop listening and process answer
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setIsProcessing(true);
      
      // Process the final transcript
      if (transcript.trim()) {
        processAnswer(transcript);
      }
    }
  }, [isListening, transcript]);
  
  // Process user's answer
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
    width: 640,
    height: 480,
    facingMode: 'user'
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Header with Interview Info */}
      <div className="bg-white border-b border-secondary-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Code className="h-5 w-5 text-primary-600" />
              <span className="text-lg font-semibold text-secondary-900">
                AI-Powered Interview
              </span>
            </div>
            {jobData && (
              <div className="flex items-center space-x-2 text-sm text-secondary-600">
                <span>🎯 {jobData.jobTitle} at {jobData.company || 'Company'}</span>
                <span>• {jobData.totalQuestions || 15} questions</span>
              </div>
            )}
          </div>
          
          <button
            onClick={onInterviewEnd}
            className="btn-secondary flex items-center space-x-2"
          >
            <Square className="h-4 w-4" />
            <span>End Interview</span>
          </button>
        </div>
      </div>
      
      {/* Main Interview Interface */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 bg-secondary-50">
        {/* Left Side - Camera and Voice Controls */}
        <div className="space-y-6">
          {/* Camera Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-secondary-900 flex items-center">
                <Camera className="h-5 w-5 mr-2 text-primary-600" />
                Your Camera
              </h3>
              <button
                onClick={toggleCamera}
                className="btn-secondary text-sm px-3 py-1"
              >
                {cameraEnabled ? (
                  <>
                    <CameraOff className="h-4 w-4 mr-1" />
                    Turn Off
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-1" />
                    Turn On
                  </>
                )}
              </button>
            </div>
            
            {cameraEnabled ? (
              <div className="relative">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  videoConstraints={videoConstraints}
                  className="w-full h-64 rounded-lg"
                  mirrored={true}
                />
                {interviewerSpeaking && (
                  <div className="absolute top-2 right-2 bg-primary-500 text-white px-2 py-1 rounded-full text-xs animate-pulse">
                    AI Speaking
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-64 bg-secondary-100 rounded-lg flex items-center justify-center">
                <CameraOff className="h-16 w-16 text-secondary-400" />
              </div>
            )}
          </div>
          
          {/* Voice Controls */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center">
              <Mic className="h-5 w-5 mr-2 text-primary-600" />
              Voice Controls
            </h3>
            
            <div className="space-y-4">
              {/* Recording Controls */}
              <div className="flex items-center justify-center space-x-4">
                {!isListening ? (
                  <button
                    onClick={startListening}
                    disabled={isProcessing}
                    className="btn-primary flex items-center space-x-2 px-6 py-3 disabled:opacity-50"
                  >
                    <Mic className="h-5 w-5" />
                    <span>Start Answering</span>
                  </button>
                ) : (
                  <button
                    onClick={stopListening}
                    className="btn-secondary flex items-center space-x-2 px-6 py-3"
                  >
                    <Square className="h-5 w-5" />
                    <span>Stop & Submit</span>
                  </button>
                )}
                
                <button
                  onClick={toggleMute}
                  className={`p-3 rounded-full ${
                    isMuted ? 'bg-red-100 text-red-600' : 'bg-secondary-100 text-secondary-600'
                  }`}
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
              </div>
              
              {/* Status Indicators */}
              <div className="text-center space-y-2">
                {isListening && (
                  <div className="flex items-center justify-center space-x-2 text-primary-600">
                    <div className="w-2 h-2 bg-primary-600 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Listening... Speak now!</span>
                  </div>
                )}
                
                {isProcessing && (
                  <div className="flex items-center justify-center space-x-2 text-secondary-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary-600"></div>
                    <span className="text-sm">Processing your answer...</span>
                  </div>
                )}
                
                {interviewerSpeaking && (
                  <div className="flex items-center justify-center space-x-2 text-green-600">
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">AI is speaking...</span>
                  </div>
                )}
              </div>
              
              {/* Transcript Display */}
              {speechText && (
                <div className="bg-secondary-50 rounded-lg p-3">
                  <p className="text-sm text-secondary-700">
                    <span className="font-medium">Your answer:</span> {speechText}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Right Side - Code Editor and Question */}
        <div className="space-y-6">
          {/* Current Question */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center">
              <Code className="h-5 w-5 mr-2 text-primary-600" />
              Current Question
            </h3>
            
            {currentQuestion && (
              <div className="space-y-4">
                <div className="bg-primary-50 p-4 rounded-lg">
                  <h4 className="font-medium text-primary-900 mb-2">
                    {currentQuestion.title}
                  </h4>
                  <p className="text-primary-700 text-sm">
                    {currentQuestion.description}
                  </p>
                  
                  {currentQuestion.hints && Array.isArray(currentQuestion.hints) && (
                    <div className="mt-3 pt-3 border-t border-primary-200">
                      <p className="text-xs text-primary-600 mb-1">💡 Hints:</p>
                      <ul className="text-xs text-primary-600 space-y-1">
                        {currentQuestion.hints.map((hint, idx) => (
                          <li key={idx}>• {hint}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {/* Code Editor Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary-600">
                    {showCodeEditor ? 'Code Editor Active' : 'Click to add code if needed'}
                  </span>
                  <button
                    onClick={() => setShowCodeEditor(!showCodeEditor)}
                    className="btn-secondary text-sm px-3 py-1"
                  >
                    {showCodeEditor ? 'Hide Editor' : 'Show Code Editor'}
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Code Editor */}
          {showCodeEditor && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-secondary-900 flex items-center">
                  <Code className="h-5 w-5 mr-2 text-primary-600" />
                  Code Editor
                </h3>
                
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="text-sm border border-secondary-300 rounded px-2 py-1"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                  </select>
                  
                  <button
                    onClick={handleCodeExecution}
                    className="btn-primary text-sm px-3 py-1"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Run Code
                  </button>
                </div>
              </div>
              
              <div className="border border-secondary-200 rounded-lg overflow-hidden">
                <Editor
                  height="300px"
                  language={selectedLanguage}
                  value={currentCode}
                  onChange={setCurrentCode}
                  theme="vs-light"
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
    </div>
  );
};

export default VoiceInterview;
