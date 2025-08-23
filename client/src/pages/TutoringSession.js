import { cpp } from '@codemirror/lang-cpp';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import {
    AlertCircle,
    BookOpen,
    ChevronLeft,
    Code,
    MessageSquare,
    Play,
    Save,
    Send,
    Square
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

const TutoringSession = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  
  // State management
  const [session, setSession] = useState(null);
  const [topic, setTopic] = useState('');
  const [skillLevel, setSkillLevel] = useState('beginner');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [executionResult, setExecutionResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Refs
  const editorRef = useRef(null);
  const chatEndRef = useRef(null);
  const editorViewRef = useRef(null);

  // Supported programming languages
  const supportedLanguages = [
    { value: 'python', label: 'Python', extension: () => python() },
    { value: 'javascript', label: 'JavaScript', extension: () => javascript() },
    { value: 'typescript', label: 'TypeScript', extension: () => javascript() },
    { value: 'c', label: 'C', extension: () => cpp() },
    { value: 'cpp', label: 'C++', extension: () => cpp() },
    { value: 'java', label: 'Java', extension: () => java() },
    { value: 'html', label: 'HTML', extension: () => html() }
  ];
  
  // Initialize CodeMirror editor
  useEffect(() => {
    if (editorRef.current && !editorViewRef.current) {
      const currentLang = supportedLanguages.find(lang => lang.value === language);
      const defaultCode = getDefaultCode(language);
      
      const extensions = [
        basicSetup,
        currentLang ? currentLang.extension() : python(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setCode(update.state.doc.toString());
          }
        })
      ];
      
      const state = EditorState.create({
        doc: defaultCode,
        extensions
      });
      
      const view = new EditorView({
        state,
        parent: editorRef.current
      });
      
      editorViewRef.current = view;
      setCode(defaultCode);
    }
  }, [language]);

  // Initialize default code when session starts
  useEffect(() => {
    if (isSessionActive && !code) {
      const defaultCode = getDefaultCode(language);
      setCode(defaultCode);
      
      if (editorViewRef.current) {
        const state = EditorState.create({
          doc: defaultCode,
          extensions: editorViewRef.current.state.extensions
        });
        editorViewRef.current.setState(state);
      }
    }
  }, [isSessionActive]);
  
  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Load existing session if sessionId is provided
  useEffect(() => {
    if (sessionId) {
      loadExistingSession(sessionId);
    }
  }, [sessionId]);

  // Update session code when it changes
  useEffect(() => {
    if (session && session.id && code && isSessionActive) {
      // Debounce the update to avoid too many API calls
      const timeoutId = setTimeout(() => {
        updateSessionData({ code });
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [code, session, isSessionActive]);

  // Load existing session data and conversation history
  const loadExistingSession = async (id) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tutoring/sessions/${id}`, {
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const sessionData = data.session;
        
        // Set all the session data
        setSession(sessionData);
        setConversation(sessionData.conversation || []);
        setTopic(sessionData.topic || '');
        setSkillLevel(sessionData.skillLevel || 'beginner');
        setLanguage(sessionData.language || 'python');
        setIsSessionActive(true);
        
        // Update editor with session code if it exists
        if (sessionData.code && editorViewRef.current) {
          const currentLang = supportedLanguages.find(lang => lang.value === sessionData.language || 'python');
          const extensions = [
            basicSetup,
            currentLang ? currentLang.extension() : python(),
            oneDark,
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                setCode(update.state.doc.toString());
              }
            })
          ];
          
          const state = EditorState.create({
            doc: sessionData.code,
            extensions
          });
          
          editorViewRef.current.setState(state);
          setCode(sessionData.code);
        }
        
        console.log('Existing session loaded:', sessionData);
      } else {
        console.error('Failed to load session:', response.status);
        // If session not found, redirect to new session
        navigate('/tutoring');
      }
    } catch (error) {
      console.error('Error loading existing session:', error);
      // If error occurs, redirect to new session
      navigate('/tutoring');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get default code based on language
  const getDefaultCode = (lang) => {
    const defaults = {
      python: `# Welcome to Python tutoring!
# Start coding here...

def hello_world():
    print("Hello, World!")

# Call the function
hello_world()`,
      javascript: `// Welcome to JavaScript tutoring!
// Start coding here...

function helloWorld() {
    console.log("Hello, World!");
}

// Call the function
helloWorld();`,
      typescript: `// Welcome to TypeScript tutoring!
// Start coding here...

function helloWorld(): void {
    console.log("Hello, World!");
}

// Call the function
helloWorld();`,
      c: `// Welcome to C tutoring!
// Start coding here...

#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}`,
      cpp: `// Welcome to C++ tutoring!
// Start coding here...

#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`,
      java: `// Welcome to Java tutoring!
// Start coding here...

public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
      html: `<!-- Welcome to HTML tutoring! -->
<!-- Start coding here... -->

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World</title>
</head>
<body>
    <h1>Hello, World!</h1>
</body>
</html>`
    };
    return defaults[lang] || defaults.python;
  };
  
  // Start new tutoring session
  const startSession = async () => {
    if (!topic.trim()) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tutoring/start-session', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ topic: topic.trim(), skillLevel })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSession(data.session);
        setIsSessionActive(true);
        
        // Add welcome message from AI
        if (data.aiResponse) {
          const welcomeMessage = {
            id: Date.now(),
            speaker: 'ai',
            message: data.aiResponse.message,
            timestamp: new Date(),
            concepts: data.aiResponse.concepts || [],
            hints: data.aiResponse.hints || []
          };
          setConversation([welcomeMessage]);
        }
        
        // Update session topic
        setSession(prev => ({
          ...prev,
          topic: topic.trim()
        }));
      } else {
        const errorData = await response.json();
        console.error('Error starting session:', errorData);
        alert('Failed to start session. Please check your API configuration.');
      }
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Send message to AI tutor
  const sendMessage = async () => {
    if (!currentMessage.trim() || !session || isSendingMessage) return;
    
    setIsSendingMessage(true);
    const userMessage = {
      id: Date.now(),
      speaker: 'student',
      message: currentMessage.trim(),
      timestamp: new Date(),
      codeSnippet: code || null
    };
    
    setConversation(prev => [...prev, userMessage]);
    setCurrentMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tutoring/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId: session.id,
          message: userMessage.message,
          codeSnippet: userMessage.codeSnippet,
          skillLevel
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const aiMessage = {
          id: Date.now() + 1,
          speaker: 'ai',
          message: data.response.message,
          timestamp: new Date(),
          concepts: data.response.concepts || [],
          hints: data.response.hints || []
        };
        setConversation(prev => [...prev, aiMessage]);
      } else {
        const errorData = await response.json();
        console.error('Chat error:', errorData);
        
        // Add error message to chat
        const errorMessage = {
          id: Date.now() + 1,
          speaker: 'ai',
          message: "I'm having trouble responding right now. Please check your OpenAI API configuration and try again.",
          timestamp: new Date(),
          concepts: [],
          hints: ["Check API key", "Verify OpenAI credit balance"]
        };
        setConversation(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message to chat
      const errorMessage = {
        id: Date.now() + 1,
        speaker: 'ai',
        message: "Network error. Please check your connection and try again.",
        timestamp: new Date(),
        concepts: [],
        hints: ["Check internet connection", "Try again in a moment"]
      };
      setConversation(prev => [...prev, errorMessage]);
    } finally {
      setIsSendingMessage(false);
    }
  };
  
  // Execute code
  const executeCode = async () => {
    if (!code.trim() || !session) return;
    
    setIsExecuting(true);
    setExecutionResult(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tutoring/execute-code', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code: code.trim(),
          language,
          sessionId: session.id
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setExecutionResult(data.result);
      } else {
        const errorData = await response.json();
        setExecutionResult({ 
          error: errorData.message || 'Execution failed', 
          status: 'error',
          output: '',
          executionTime: '0ms',
          memory: '0MB'
        });
      }
    } catch (error) {
      console.error('Error executing code:', error);
      setExecutionResult({ 
        error: 'Network error during execution', 
        status: 'error',
        output: '',
        executionTime: '0ms',
        memory: '0MB'
      });
    } finally {
      setIsExecuting(false);
    }
  };
  
  // End session
  const endSession = async () => {
    if (!session) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tutoring/end-session', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId: session.id })
      });
      
      if (response.ok) {
        console.log('Session ended successfully');
        navigate('/');
      } else {
        const errorData = await response.json();
        console.error('Server error ending session:', errorData);
        // Still navigate to dashboard even if there's an error
        navigate('/');
      }
    } catch (error) {
      console.error('Error ending session:', error);
      // Navigate anyway to prevent the user from being stuck
      navigate('/');
    }
  };
  
  // Change language
  const changeLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    setExecutionResult(null); // Clear previous results
    
    if (editorViewRef.current) {
      const currentLang = supportedLanguages.find(lang => lang.value === newLanguage);
      const extensions = [
        basicSetup,
        currentLang ? currentLang.extension() : python(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setCode(update.state.doc.toString());
          }
        })
      ];
      
      const state = EditorState.create({
        doc: getDefaultCode(newLanguage),
        extensions
      });
      
      editorViewRef.current.setState(state);
      setCode(getDefaultCode(newLanguage));
    }
    
    // Update session with new language
    if (session && session.id) {
      updateSessionData({ language: newLanguage });
    }
  };

  // Update session data (code, language) on backend
  const updateSessionData = async (updates) => {
    if (!session || !session.id) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/tutoring/update-session', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId: session.id,
          ...updates
        })
      });
    } catch (error) {
      console.error('Error updating session:', error);
    }
  };
  
  // Save session
  const saveSession = () => {
    const sessionData = {
      session,
      conversation,
      code,
      language,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tutoring-session-${session?.topic}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Show loading state when resuming a session
  if (sessionId && isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-secondary-900 mb-4">
              Resuming Your Session...
            </h1>
            <p className="text-secondary-600">
              Loading your previous conversation and code
            </p>
          </div>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isSessionActive) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-secondary-900 mb-4">
              Start Your AI Tutoring Session
            </h1>
            <p className="text-secondary-600">
              Choose a topic and skill level to begin your personalized learning journey
            </p>
          </div>
          
          <div className="max-w-md mx-auto space-y-6">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                What would you like to learn?
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Machine Learning, Python Basics, React"
                className="input-field w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Your skill level
              </label>
              <select
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value)}
                className="input-field w-full"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            
            <button
              onClick={startSession}
              disabled={!topic.trim() || isLoading}
              className="btn-primary w-full flex items-center justify-center"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <BookOpen className="h-5 w-5 mr-2" />
                  Start Learning
                </>
              )}
            </button>
            
            {/* API Status Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">OpenAI API Required</p>
                  <p>Make sure your OpenAI API key is configured and has sufficient credits.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-secondary-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={() => navigate('/')}
              className="text-secondary-600 hover:text-secondary-800 p-1 sm:p-0"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-secondary-900">
                {session?.topic} Tutoring
                {sessionId && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    Resumed
                  </span>
                  )}
              </h1>
              <p className="text-xs sm:text-sm text-secondary-600">
                Skill Level: {skillLevel.charAt(0).toUpperCase() + skillLevel.slice(1)}
                {sessionId && session?.startTime && (
                  <span className="ml-2 text-green-600">
                    • Started: {new Date(session.startTime).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={saveSession}
              className="text-secondary-600 hover:text-secondary-800 p-1 sm:p-2 rounded-md hover:bg-secondary-100"
              title="Save Session"
            >
              <Save className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button
              onClick={endSession}
              className="btn-secondary flex items-center text-sm px-2 py-1 sm:px-3 sm:py-2"
            >
              <Square className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">End Session</span>
              <span className="sm:hidden">End</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel - Chat */}
        <div className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-secondary-200">
          {/* Chat Header */}
          <div className="bg-secondary-50 px-3 sm:px-4 py-3 border-b border-secondary-200">
            <h3 className="font-medium text-secondary-900 flex items-center text-sm sm:text-base">
              <MessageSquare className="h-4 w-4 mr-2" />
              AI Tutor Chat
            </h3>
          </div>
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
            {conversation.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.speaker === 'student' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 rounded-lg ${
                    msg.speaker === 'student'
                      ? 'bg-primary-600 text-white'
                      : 'bg-secondary-100 text-secondary-900'
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  {msg.concepts && msg.concepts.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-secondary-200">
                      <p className="text-xs text-secondary-500 mb-1">Concepts covered:</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.concepts.map((concept, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-secondary-200 text-secondary-700 text-xs rounded"
                          >
                            {concept}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {msg.hints && msg.hints.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-secondary-200">
                      <p className="text-xs text-secondary-500 mb-1">💡 Hints:</p>
                      <ul className="text-xs space-y-1">
                        {msg.hints.map((hint, idx) => (
                          <li key={idx} className="text-secondary-600">• {hint}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          
          {/* Chat Input */}
          <div className="p-3 sm:p-4 border-t border-secondary-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isSendingMessage && sendMessage()}
                placeholder="Ask your AI tutor a question..."
                className="input-field flex-1 text-sm"
                disabled={isSendingMessage}
              />
              <button
                onClick={sendMessage}
                disabled={!currentMessage.trim() || isSendingMessage}
                className="btn-primary px-3 sm:px-4 py-2"
              >
                {isSendingMessage ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Right Panel - Code Editor & Execution */}
        <div className="w-full lg:w-1/2 flex flex-col">
          {/* Code Editor Header */}
          <div className="bg-secondary-50 px-3 sm:px-4 py-3 border-b border-secondary-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <h3 className="font-medium text-secondary-900 flex items-center">
                <Code className="h-4 w-4 mr-2" />
                Code Editor
              </h3>
              <div className="flex items-center space-x-2">
                <select
                  value={language}
                  onChange={(e) => changeLanguage(e.target.value)}
                  className="text-sm border border-secondary-300 rounded px-2 py-1 bg-white flex-1 sm:flex-none"
                >
                  {supportedLanguages.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={executeCode}
                  disabled={isExecuting || !code.trim() || language === 'html'}
                  className="btn-primary px-2 sm:px-3 py-1 text-sm flex items-center"
                  title={language === 'html' ? 'HTML execution not supported' : 'Run code'}
                >
                  {isExecuting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Run</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Code Editor */}
          <div className="flex-1 bg-secondary-900">
            <div ref={editorRef} className="h-full min-h-[300px] sm:min-h-[400px]" />
          </div>
          
          {/* Execution Results */}
          {executionResult && (
            <div className="bg-secondary-50 border-t border-secondary-200 p-3 sm:p-4 max-h-48 sm:max-h-64 overflow-y-auto">
              <h4 className="font-medium text-secondary-900 mb-2 flex items-center">
                <Play className="h-4 w-4 mr-2" />
                <span className="text-sm sm:text-base">Execution Results</span>
              </h4>
              
              {executionResult.error ? (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-red-800 text-sm break-words">
                    <strong>Error:</strong> {executionResult.error}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="bg-white border border-secondary-200 rounded p-3">
                    <p className="text-secondary-700 text-sm font-medium">Output:</p>
                    <pre className="text-secondary-700 text-sm mt-1 whitespace-pre-wrap break-words overflow-x-auto">
                      {executionResult.output || 'No output'}
                    </pre>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 sm:gap-4 text-xs text-secondary-600">
                    <span>Time: {executionResult.executionTime}</span>
                    <span>Memory: {executionResult.memory}</span>
                    <span>Status: {executionResult.status}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutoringSession;