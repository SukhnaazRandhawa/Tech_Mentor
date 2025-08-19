# CodeMentor AI - Your Personal CS Career Coach

An AI-powered platform that helps computer science students and professionals learn programming concepts through interactive tutoring, prepares them for specific job requirements, and conducts mock interviews - all in one integrated experience.

## 🚀 Features

### 1. Interactive CS Tutoring
- **Socratic Teaching Method**: AI guides students through discovery rather than giving direct answers
- **Real-time Code Execution**: Write and run code with instant feedback
- **Personalized Learning**: Adapts to your skill level and learning style
- **Visual Learning**: Diagrams and visualizations for complex concepts

### 2. Job-Targeted Learning
- **Job Description Analysis**: Upload job postings to get skill requirements
- **Skill Gap Assessment**: Identify what you need to learn for specific roles
- **Personalized Learning Paths**: Custom study plans based on job requirements
- **Project-Based Learning**: Build real projects relevant to your target role

### 3. Mock Interview System
- **AI Interviewer**: Realistic technical interview simulation
- **Coding Challenges**: Practice with job-specific problems
- **System Design Discussions**: Learn to discuss architecture and design
- **Performance Analytics**: Track improvement over time

## 🛠️ Tech Stack

### Frontend
- **React.js** - Main UI framework
- **Tailwind CSS** - Modern, utility-first CSS framework
- **CodeMirror** - Professional code editor component
- **Socket.io-client** - Real-time communication
- **Framer Motion** - Smooth animations and transitions

### Backend
- **Node.js + Express** - Server framework
- **Socket.io** - WebSocket connections for real-time features
- **MongoDB + Mongoose** - Database and ORM
- **JWT** - Secure authentication
- **OpenAI API** - AI tutoring intelligence

### External Services
- **OpenAI GPT-4/3.5** - AI conversations and analysis
- **Judge0 API** - Secure code execution
- **MongoDB Atlas** - Cloud database (optional)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **MongoDB** (local installation or MongoDB Atlas account)
- **Git**

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd TechMentor
```

### 2. Install Dependencies
```bash
# Install all dependencies (frontend + backend)
npm run install-all

# Or install separately:
npm install                    # Root dependencies
cd server && npm install      # Backend dependencies
cd ../client && npm install   # Frontend dependencies
```

### 3. Environment Setup

#### Backend (.env file in server directory)
```bash
cd server
cp env.example .env
```

Edit `.env` with your configuration:
```env
# Server Configuration
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/codementor-ai

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Judge0 API (for code execution)
JUDGE0_API_KEY=your-judge0-api-key-here
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
```

#### Frontend (.env file in client directory)
```bash
cd client
```

Create `.env` file:
```env
REACT_APP_API_URL=http://localhost:5001
REACT_APP_SERVER_URL=http://localhost:5001
```

### 4. Start MongoDB
```bash
# Local MongoDB
mongod

# Or use MongoDB Atlas (cloud)
```

### 5. Run the Application
```bash
# Development mode (runs both frontend and backend)
npm run dev

# Or run separately:
npm run server    # Backend only (port 5000)
npm run client    # Frontend only (port 3000)
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5001
- **Health Check**: http://localhost:5001/health

## 📁 Project Structure

```
TechMentor/
├── client/                 # React frontend
│   ├── public/            # Static files
│   ├── src/               # Source code
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # React contexts
│   │   ├── pages/         # Page components
│   │   └── index.js       # Entry point
│   ├── package.json       # Frontend dependencies
│   └── tailwind.config.js # Tailwind configuration
├── server/                 # Node.js backend
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   ├── middleware/        # Custom middleware
│   ├── index.js           # Server entry point
│   └── package.json       # Backend dependencies
├── package.json            # Root package.json
└── README.md              # This file
```

## 🔧 Development

### Available Scripts

#### Root Level
```bash
npm run dev              # Start both frontend and backend
npm run install-all      # Install all dependencies
npm run build            # Build frontend for production
npm start                # Start production server
```

#### Frontend (client/)
```bash
npm start                # Start development server
npm run build            # Build for production
npm test                 # Run tests
npm run eject            # Eject from Create React App
```

#### Backend (server/)
```bash
npm run dev              # Start with nodemon (development)
npm start                # Start production server
npm test                 # Run tests
```

### Code Style
- **Frontend**: ESLint + Prettier (configured in package.json)
- **Backend**: Standard JavaScript practices
- **Database**: Mongoose schemas with validation

## 🧪 Testing

```bash
# Frontend tests
cd client && npm test

# Backend tests
cd server && npm test
```

## 🚀 Deployment

### Frontend (Vercel/Netlify)
```bash
cd client
npm run build
# Deploy the build folder
```

### Backend (Railway/Render/Heroku)
```bash
cd server
# Set environment variables
# Deploy to your preferred platform
```

## 🔑 API Keys Setup

### 1. OpenAI API
- Visit [OpenAI Platform](https://platform.openai.com/)
- Create an account and get your API key
- Add to `.env` file

### 2. Judge0 API (Code Execution)
- Visit [Judge0 RapidAPI](https://rapidapi.com/judge0-official/api/judge0-ce/)
- Subscribe to get your API key
- Add to `.env` file

### 3. MongoDB Atlas (Optional)
- Visit [MongoDB Atlas](https://www.mongodb.com/atlas)
- Create a free cluster
- Get your connection string
- Add to `.env` file

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues:

1. Check the [Issues](https://github.com/yourusername/TechMentor/issues) page
2. Create a new issue with detailed information
3. Include error logs and steps to reproduce

## 🎯 Roadmap

### Phase 1: Core Tutoring ✅
- [x] User authentication
- [x] Basic chat interface
- [x] Code editor
- [x] Code execution
- [x] Progress tracking

### Phase 2: Job Preparation 🚧
- [ ] Job description analysis
- [ ] Skill gap assessment
- [ ] Learning path generation
- [ ] Project suggestions

### Phase 3: Mock Interviews 📋
- [ ] Interview conductor
- [ ] Coding challenges
- [ ] System design discussions
- [ ] Performance analytics

### Phase 4: Polish & Deploy 📋
- [ ] Enhanced UI/UX
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] Production deployment

## 🙏 Acknowledgments

- OpenAI for providing the AI capabilities
- Judge0 for secure code execution
- The React and Node.js communities
- All contributors and beta testers

---

**Happy Coding! 🚀**

If you find this project helpful, please give it a ⭐ star!
