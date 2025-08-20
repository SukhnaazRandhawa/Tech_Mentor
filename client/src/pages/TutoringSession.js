import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import {
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
  
  // Refs
  const editorRef = useRef(null);
  const chatEndRef = useRef(null);
  const editorViewRef = useRef(null);
  
  // Initialize CodeMirror editor
  useEffect(() => {
    if (editorRef.current && !editorViewRef.current) {
      const extensions = [
        basicSetup,
        language === 'python' ? python() : javascript(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setCode(update.state.doc.toString());
          }
        })
      ];
      
      const state = EditorState.create({
        doc: getDefaultCode(language),
        extensions
      });
      
      const view = new EditorView({
        state,
        parent: editorRef.current
      });
      
      editorViewRef.current = view;
      setCode(getDefaultCode(language));
    }
  }, [language]);
  
  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);
  
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
helloWorld();`
    };
    return defaults[lang] || defaults.python;
  };
  
  // Start new tutoring session
  const startSession = async () => {
    if (!topic.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/tutoring/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), skillLevel })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSession(data.session);
        setIsSessionActive(true);
        
        // Add welcome message
        const welcomeMessage = {
          id: Date.now(),
          speaker: 'ai',
          message: `Welcome to your ${topic} tutoring session! I'm here to help you learn through guided discovery. What would you like to explore first?`,
          timestamp: new Date(),
          concepts: ['session start'],
          hints: ['Ask questions', 'Share your thoughts', 'Try coding']
        };
        setConversation([welcomeMessage]);
        
        // Update session topic to match what user actually selected
        setSession(prev => ({
          ...prev,
          topic: topic.trim()
        }));
      }
    } catch (error) {
      console.error('Error starting session:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Send message to AI tutor
  const sendMessage = async () => {
    if (!currentMessage.trim() || !session) return;
    
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
      const response = await fetch('/api/tutoring/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };
  
  // Execute code
  const executeCode = async () => {
    if (!code.trim() || !session) return;
    
    setIsExecuting(true);
    try {
      const response = await fetch('/api/tutoring/execute-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          language,
          sessionId: session.id
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setExecutionResult(data.result);
      }
    } catch (error) {
      console.error('Error executing code:', error);
      setExecutionResult({ error: 'Execution failed', status: 'error' });
    } finally {
      setIsExecuting(false);
    }
  };
  
  // End session
  const endSession = async () => {
    if (!session) return;
    
    try {
      await fetch('/api/tutoring/end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id })
      });
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };
  
  // Change language
  const changeLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    if (editorViewRef.current) {
      const extensions = [
        basicSetup,
        newLanguage === 'python' ? python() : javascript(),
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
                placeholder="e.g., Recursion, Binary Search, Dynamic Programming"
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
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-secondary-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-secondary-600 hover:text-secondary-800"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-secondary-900">
                {session?.topic} Tutoring
              </h1>
              <p className="text-sm text-secondary-600">
                Skill Level: {skillLevel.charAt(0).toUpperCase() + skillLevel.slice(1)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={saveSession}
              className="text-secondary-600 hover:text-secondary-800 p-2 rounded-md hover:bg-secondary-100"
              title="Save Session"
            >
              <Save className="h-5 w-5" />
            </button>
            <button
              onClick={endSession}
              className="btn-secondary flex items-center"
            >
              <Square className="h-4 w-4 mr-2" />
              End Session
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Chat */}
        <div className="w-1/2 flex flex-col border-r border-secondary-200">
          {/* Chat Header */}
          <div className="bg-secondary-50 px-4 py-3 border-b border-secondary-200">
            <h3 className="font-medium text-secondary-900 flex items-center">
              <MessageSquare className="h-4 w-4 mr-2" />
              AI Tutor Chat
            </h3>
          </div>
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {conversation.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.speaker === 'student' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
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
          <div className="p-4 border-t border-secondary-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask your AI tutor a question..."
                className="input-field flex-1"
              />
              <button
                onClick={sendMessage}
                disabled={!currentMessage.trim()}
                className="btn-primary px-4"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Right Panel - Code Editor & Execution */}
        <div className="w-1/2 flex flex-col">
          {/* Code Editor Header */}
          <div className="bg-secondary-50 px-4 py-3 border-b border-secondary-200">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-secondary-900 flex items-center">
                <Code className="h-4 w-4 mr-2" />
                Code Editor
              </h3>
              <div className="flex items-center space-x-2">
                <select
                  value={language}
                  onChange={(e) => changeLanguage(e.target.value)}
                  className="text-sm border border-secondary-300 rounded px-2 py-1 bg-white"
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                </select>
                <button
                  onClick={executeCode}
                  disabled={isExecuting || !code.trim()}
                  className="btn-primary px-3 py-1 text-sm flex items-center"
                >
                  {isExecuting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Run
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Code Editor */}
          <div className="flex-1 bg-secondary-900">
            <div ref={editorRef} className="h-full" />
          </div>
          
          {/* Execution Results */}
          {executionResult && (
            <div className="bg-secondary-50 border-t border-secondary-200 p-4">
              <h4 className="font-medium text-secondary-900 mb-2 flex items-center">
                <Play className="h-4 w-4 mr-2" />
                Execution Results
              </h4>
              
              {executionResult.error ? (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-red-800 text-sm">
                    <strong>Error:</strong> {executionResult.error}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="bg-white border border-secondary-200 rounded p-3">
                    <p className="text-secondary-900 text-sm font-medium">Output:</p>
                    <pre className="text-secondary-700 text-sm mt-1 whitespace-pre-wrap">
                      {executionResult.output}
                    </pre>
                  </div>
                  
                  <div className="flex space-x-4 text-xs text-secondary-600">
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
