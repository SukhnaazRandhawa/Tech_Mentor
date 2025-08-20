const express = require('express');
const auth = require('../middleware/auth');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const router = express.Router();

// OpenAI API configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Store active sessions (in production, use a database)
const activeSessions = new Map();

// @route POST /api/tutoring/start-session
// @desc Start a new tutoring session
// @access Private
router.post('/start-session', auth, async (req, res) => {
  try {
    const { topic, skillLevel } = req.body;
    const userId = req.user.id;

    if (!topic || !skillLevel) {
      return res.status(400).json({ message: 'Topic and skill level are required' });
    }

    // Create session ID
    const sessionId = `session_${userId}_${Date.now()}`;

    // Initialize session data
    const sessionData = {
      id: sessionId,
      userId,
      topic: topic.trim(),
      skillLevel,
      startTime: new Date(),
      messages: [],
      isActive: true
    };

    // Store session
    activeSessions.set(sessionId, sessionData);

    // Generate initial AI response
    const systemPrompt = `You are an expert AI tutor specializing in ${topic}. The student's skill level is ${skillLevel}. 
    Your role is to:
    1. Provide clear, step-by-step explanations
    2. Ask guiding questions to promote understanding
    3. Give practical examples and exercises
    4. Adapt your teaching style to the ${skillLevel} level
    5. Encourage hands-on coding practice
    
    Always respond in JSON format with:
    {
      "message": "your response text",
      "concepts": ["concept1", "concept2"],
      "hints": ["hint1", "hint2"]
    }`;

    const initialPrompt = `Welcome the student to a ${topic} tutoring session. Ask what specific aspect they'd like to start with and provide 3-4 beginner-friendly suggestions for ${skillLevel} level.`;

    const aiResponse = await callOpenAI(systemPrompt, initialPrompt);

    res.json({
      session: sessionData,
      aiResponse
    });

  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ message: 'Server error starting session' });
  }
});

// @route POST /api/tutoring/chat
// @desc Send message to AI tutor
// @access Private
router.post('/chat', auth, async (req, res) => {
  try {
    const { sessionId, message, codeSnippet, skillLevel } = req.body;
    const userId = req.user.id;

    if (!sessionId || !message) {
      return res.status(400).json({ message: 'Session ID and message are required' });
    }

    // Get session
    const session = activeSessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Add user message to session
    session.messages.push({
      role: 'user',
      content: message,
      codeSnippet,
      timestamp: new Date()
    });

    // Prepare context for AI
    const systemPrompt = `You are an expert AI tutor for ${session.topic}. Student level: ${skillLevel}.
    Provide helpful, educational responses. If code is shared, review and provide feedback.
    
    Respond in JSON format:
    {
      "message": "your response",
      "concepts": ["relevant concepts"],
      "hints": ["helpful hints"]
    }`;

    // Build conversation context
    let conversationContext = `Topic: ${session.topic}\nSkill Level: ${skillLevel}\n\n`;
    
    // Include recent messages for context (last 5 messages)
    const recentMessages = session.messages.slice(-5);
    recentMessages.forEach(msg => {
      conversationContext += `${msg.role}: ${msg.content}\n`;
      if (msg.codeSnippet) {
        conversationContext += `Code: ${msg.codeSnippet}\n`;
      }
    });

    conversationContext += `\nStudent's current message: ${message}`;
    if (codeSnippet) {
      conversationContext += `\nStudent's code: ${codeSnippet}`;
    }

    const aiResponse = await callOpenAI(systemPrompt, conversationContext);

    // Add AI response to session
    session.messages.push({
      role: 'assistant',
      content: aiResponse.message,
      concepts: aiResponse.concepts,
      hints: aiResponse.hints,
      timestamp: new Date()
    });

    res.json({
      response: aiResponse
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ message: 'Server error processing chat' });
  }
});

// @route POST /api/tutoring/execute-code
// @desc Execute user code
// @access Private
router.post('/execute-code', auth, async (req, res) => {
  try {
    const { code, language, sessionId } = req.body;
    const userId = req.user.id;

    if (!code || !language) {
      return res.status(400).json({ message: 'Code and language are required' });
    }

    // Verify session
    const session = activeSessions.get(sessionId);
    if (sessionId && (!session || session.userId !== userId)) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const executionResult = await executeCode(code, language);
    
    res.json({
      result: executionResult
    });

  } catch (error) {
    console.error('Code execution error:', error);
    res.status(500).json({ 
      result: { 
        error: 'Code execution failed', 
        status: 'error',
        output: '',
        executionTime: '0ms',
        memory: '0MB'
      }
    });
  }
});

// @route POST /api/tutoring/end-session
// @desc End tutoring session
// @access Private
router.post('/end-session', auth, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    const session = activeSessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Mark session as ended
    session.isActive = false;
    session.endTime = new Date();

    // In production, save to database here
    
    res.json({ message: 'Session ended successfully' });

  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ message: 'Server error ending session' });
  }
});

// Helper function to call OpenAI API
async function callOpenAI(systemPrompt, userPrompt) {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await axios.post(OPENAI_API_URL, {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const aiMessage = response.data.choices[0].message.content;
    
    // Try to parse JSON response
    try {
      return JSON.parse(aiMessage);
    } catch (parseError) {
      // Fallback if AI doesn't return valid JSON
      return {
        message: aiMessage,
        concepts: [],
        hints: []
      };
    }

  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    
    // Fallback response
    return {
      message: "I'm having trouble connecting to the AI service right now. Please try again in a moment.",
      concepts: [],
      hints: ["Check your connection", "Try rephrasing your question"]
    };
  }
}

// Helper function to execute code
async function executeCode(code, language) {
  const startTime = Date.now();
  
  try {
    let result;
    
    switch (language.toLowerCase()) {
      case 'python':
        result = await executePython(code);
        break;
      case 'javascript':
        result = await executeJavaScript(code);
        break;
      case 'typescript':
        result = await executeTypeScript(code);
        break;
      case 'c':
        result = await executeC(code);
        break;
      case 'cpp':
      case 'c++':
        result = await executeCpp(code);
        break;
      case 'java':
        result = await executeJava(code);
        break;
      default:
        throw new Error(`Language ${language} not supported`);
    }

    const executionTime = Date.now() - startTime;
    
    return {
      ...result,
      executionTime: `${executionTime}ms`,
      status: result.error ? 'error' : 'success'
    };

  } catch (error) {
    return {
      error: error.message,
      output: '',
      executionTime: `${Date.now() - startTime}ms`,
      memory: '0MB',
      status: 'error'
    };
  }
}

// Language-specific execution functions
async function executePython(code) {
  return new Promise((resolve) => {
    const pythonProcess = spawn('python3', ['-c', code]);
    let output = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    pythonProcess.on('close', (exitCode) => {
      resolve({
        output: output || (error ? '' : 'No output'),
        error: error || null,
        memory: '< 1MB'
      });
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      pythonProcess.kill();
      resolve({
        output: '',
        error: 'Execution timeout (10s limit)',
        memory: '0MB'
      });
    }, 10000);
  });
}

async function executeJavaScript(code) {
  return new Promise((resolve) => {
    const nodeProcess = spawn('node', ['-e', code]);
    let output = '';
    let error = '';

    nodeProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    nodeProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    nodeProcess.on('close', (exitCode) => {
      resolve({
        output: output || (error ? '' : 'No output'),
        error: error || null,
        memory: '< 1MB'
      });
    });

    setTimeout(() => {
      nodeProcess.kill();
      resolve({
        output: '',
        error: 'Execution timeout (10s limit)',
        memory: '0MB'
      });
    }, 10000);
  });
}

async function executeTypeScript(code) {
  try {
    // Create temporary file
    const tempDir = os.tmpdir();
    const fileName = `temp_${Date.now()}.ts`;
    const filePath = path.join(tempDir, fileName);
    
    await fs.writeFile(filePath, code);
    
    return new Promise((resolve) => {
      // Compile and run TypeScript
      const tsProcess = spawn('npx', ['ts-node', filePath]);
      let output = '';
      let error = '';

      tsProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      tsProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      tsProcess.on('close', async (exitCode) => {
        // Clean up temp file
        try {
          await fs.unlink(filePath);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }

        resolve({
          output: output || (error ? '' : 'No output'),
          error: error || null,
          memory: '< 1MB'
        });
      });

      setTimeout(async () => {
        tsProcess.kill();
        try {
          await fs.unlink(filePath);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
        resolve({
          output: '',
          error: 'Execution timeout (10s limit)',
          memory: '0MB'
        });
      }, 10000);
    });
  } catch (error) {
    return {
      output: '',
      error: error.message,
      memory: '0MB'
    };
  }
}

async function executeC(code) {
  try {
    const tempDir = os.tmpdir();
    const fileName = `temp_${Date.now()}`;
    const sourceFile = path.join(tempDir, `${fileName}.c`);
    const execFile = path.join(tempDir, fileName);
    
    await fs.writeFile(sourceFile, code);
    
    return new Promise((resolve) => {
      // Compile first
      const compileProcess = spawn('gcc', [sourceFile, '-o', execFile]);
      
      compileProcess.on('close', (compileCode) => {
        if (compileCode !== 0) {
          resolve({
            output: '',
            error: 'Compilation failed',
            memory: '0MB'
          });
          return;
        }
        
        // Execute compiled program
        const execProcess = spawn(execFile);
        let output = '';
        let error = '';

        execProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        execProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        execProcess.on('close', async (exitCode) => {
          // Cleanup
          try {
            await fs.unlink(sourceFile);
            await fs.unlink(execFile);
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
          }

          resolve({
            output: output || (error ? '' : 'No output'),
            error: error || null,
            memory: '< 1MB'
          });
        });

        setTimeout(async () => {
          execProcess.kill();
          try {
            await fs.unlink(sourceFile);
            await fs.unlink(execFile);
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
          }
          resolve({
            output: '',
            error: 'Execution timeout (10s limit)',
            memory: '0MB'
          });
        }, 10000);
      });
    });
  } catch (error) {
    return {
      output: '',
      error: error.message,
      memory: '0MB'
    };
  }
}

async function executeCpp(code) {
  try {
    const tempDir = os.tmpdir();
    const fileName = `temp_${Date.now()}`;
    const sourceFile = path.join(tempDir, `${fileName}.cpp`);
    const execFile = path.join(tempDir, fileName);
    
    await fs.writeFile(sourceFile, code);
    
    return new Promise((resolve) => {
      // Compile with g++
      const compileProcess = spawn('g++', [sourceFile, '-o', execFile]);
      
      compileProcess.on('close', (compileCode) => {
        if (compileCode !== 0) {
          resolve({
            output: '',
            error: 'Compilation failed',
            memory: '0MB'
          });
          return;
        }
        
        // Execute compiled program
        const execProcess = spawn(execFile);
        let output = '';
        let error = '';

        execProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        execProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        execProcess.on('close', async (exitCode) => {
          // Cleanup
          try {
            await fs.unlink(sourceFile);
            await fs.unlink(execFile);
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
          }

          resolve({
            output: output || (error ? '' : 'No output'),
            error: error || null,
            memory: '< 1MB'
          });
        });

        setTimeout(async () => {
          execProcess.kill();
          try {
            await fs.unlink(sourceFile);
            await fs.unlink(execFile);
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
          }
          resolve({
            output: '',
            error: 'Execution timeout (10s limit)',
            memory: '0MB'
          });
        }, 10000);
      });
    });
  } catch (error) {
    return {
      output: '',
      error: error.message,
      memory: '0MB'
    };
  }
}

async function executeJava(code) {
  try {
    const tempDir = os.tmpdir();
    const fileName = `Temp${Date.now()}`;
    const sourceFile = path.join(tempDir, `${fileName}.java`);
    const classFile = path.join(tempDir, `${fileName}.class`);
    
    // Wrap code in a class if not already wrapped
    let wrappedCode = code;
    if (!code.includes('class ') && !code.includes('public class ')) {
      wrappedCode = `public class ${fileName} {
        public static void main(String[] args) {
          ${code}
        }
      }`;
    } else {
      // Replace class name to match filename
      wrappedCode = code.replace(/class\s+\w+/, `class ${fileName}`);
    }
    
    await fs.writeFile(sourceFile, wrappedCode);
    
    return new Promise((resolve) => {
      // Compile Java
      const compileProcess = spawn('javac', [sourceFile]);
      
      compileProcess.on('close', (compileCode) => {
        if (compileCode !== 0) {
          resolve({
            output: '',
            error: 'Compilation failed',
            memory: '0MB'
          });
          return;
        }
        
        // Execute Java program
        const execProcess = spawn('java', ['-cp', tempDir, fileName]);
        let output = '';
        let error = '';

        execProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        execProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        execProcess.on('close', async (exitCode) => {
          // Cleanup
          try {
            await fs.unlink(sourceFile);
            await fs.unlink(classFile);
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
          }

          resolve({
            output: output || (error ? '' : 'No output'),
            error: error || null,
            memory: '< 1MB'
          });
        });

        setTimeout(async () => {
          execProcess.kill();
          try {
            await fs.unlink(sourceFile);
            await fs.unlink(classFile);
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
          }
          resolve({
            output: '',
            error: 'Execution timeout (10s limit)',
            memory: '0MB'
          });
        }, 10000);
      });
    });
  } catch (error) {
    return {
      output: '',
      error: error.message,
      memory: '0MB'
    };
  }
}

module.exports = router;