#!/bin/bash

echo "🚀 Starting CodeMentor AI..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm run install-all

# Check if MongoDB is running (optional check)
echo "🔍 Checking MongoDB connection..."
if command -v mongod &> /dev/null; then
    if pgrep -x "mongod" > /dev/null; then
        echo "✅ MongoDB is running"
    else
        echo "⚠️  MongoDB is not running. Please start MongoDB or use MongoDB Atlas."
        echo "   To start local MongoDB: mongod"
    fi
else
    echo "⚠️  MongoDB is not installed. Please install MongoDB or use MongoDB Atlas."
fi

echo ""
echo "🎯 Next steps:"
echo "1. Copy server/env.example to server/.env and configure your environment variables"
echo "2. Create client/.env with:"
echo "   REACT_APP_API_URL=http://localhost:5000"
echo "   REACT_APP_SERVER_URL=http://localhost:5000"
echo "3. Get your API keys from OpenAI and Judge0"
echo "4. Run: npm run dev"
echo ""
echo "📚 For detailed setup instructions, see README.md"
echo ""
echo "🚀 Happy coding!"
