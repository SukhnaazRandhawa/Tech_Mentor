import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle,
  Clock,
  MessageSquare,
  Play,
  Target
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// Removed localStorage imports - now using backend API

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recentActivity, setRecentActivity] = useState([]);
  const [todayGoal, setTodayGoal] = useState(null);
  const [stats, setStats] = useState({});
  const [recentSessions, setRecentSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardSkills, setDashboardSkills] = useState([]);
  const [savedInterviews, setSavedInterviews] = useState([]);

  // Fetch dashboard data from backend
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        
        // Helper function to fetch with retry logic
        const fetchWithRetry = async (url, options = {}) => {
          try {
            const response = await fetch(url, options);
            if (response.ok) {
              return response;
            } else if (response.status === 429) {
              // Rate limit hit - wait and retry once
              console.log(`Rate limit hit for ${url}, waiting 2 seconds before retry...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              return await fetch(url, options);
            }
            return response;
          } catch (error) {
            console.error(`Error fetching ${url}:`, error);
            throw error;
          }
        };
        
        // Fetch today's goal
        try {
          const goalResponse = await fetchWithRetry('/api/dashboard/today-goal');
          if (goalResponse.ok) {
            const goalData = await goalResponse.json();
            setTodayGoal(goalData.goal);
          }
        } catch (error) {
          console.error('Error fetching today\'s goal:', error);
        }
        
        // Fetch statistics
        try {
          const statsResponse = await fetchWithRetry('/api/dashboard/stats');
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            setStats(statsData.stats);
          }
        } catch (error) {
          console.error('Error fetching stats:', error);
        }
        
        // Fetch recent tutoring sessions
        try {
          const sessionsResponse = await fetchWithRetry('/api/tutoring/sessions');
          if (sessionsResponse.ok) {
            const sessionsData = await sessionsResponse.json();
            
            // Sort sessions by completion time (newest completed first, then active sessions)
            const sortedSessions = sessionsData.sessions.sort((a, b) => {
              // If both are completed, sort by end time (newest first)
              if (a.status === 'completed' && b.status === 'completed') {
                const aEndTime = a.endTime ? new Date(a.endTime) : new Date(0);
                const bEndTime = b.endTime ? new Date(b.endTime) : new Date(0);
                return bEndTime - aEndTime;
              }
              
              // If only one is completed, put completed ones first
              if (a.status === 'completed' && b.status !== 'completed') return -1;
              if (a.status !== 'completed' && b.status === 'completed') return 1;
              
              // If both are active, sort by start time (newest first)
              const aStartTime = a.startTime ? new Date(a.startTime) : new Date(0);
              const bStartTime = b.startTime ? new Date(b.startTime) : new Date(0);
              return bStartTime - aStartTime;
            });
            
            setRecentSessions(sortedSessions.slice(0, 5)); // Show last 5 sessions instead of 3
          }
        } catch (error) {
          console.error('Error fetching recent sessions:', error);
        }
        
        // Load skill progress data from backend
        try {
          const skillsResponse = await fetchWithRetry('/api/dashboard/skills');
          if (skillsResponse.ok) {
            const skillsData = await skillsResponse.json();
            console.log('Dashboard skills from backend:', skillsData);
            
            // Convert backend skills format to dashboard format
            const skillsArray = Object.entries(skillsData.skills || {}).map(([name, data]) => ({
              name,
              currentLevel: data.level || 0,
              masteryLevel: (data.level || 0) * 10,
              totalSessions: data.totalSessions || 0,
              jobsApplied: data.jobsApplied || []
            }));
            
            setDashboardSkills(skillsArray);
            
            // Calculate overall progress
            const totalSkills = skillsArray.length;
            const totalProgress = skillsArray.reduce((sum, skill) => sum + skill.masteryLevel, 0);
            const overallProgress = totalSkills > 0 ? Math.round(totalProgress / totalSkills) : 0;
            
            console.log('Overall progress calculated:', overallProgress);
            setStats(prev => ({
              ...prev,
              overallProgress: overallProgress
            }));
          }
        } catch (error) {
          console.error('Error loading skills from backend:', error);
          setDashboardSkills([]);
        }
        
        // Fetch saved interviews
        try {
          const interviewsResponse = await fetchWithRetry('/api/mock-interview/saved');
          if (interviewsResponse.ok) {
            const interviewsData = await interviewsResponse.json();
            setSavedInterviews(interviewsData.interviews || []);
          }
        } catch (error) {
          console.error('Error loading saved interviews:', error);
          setSavedInterviews([]);
        }
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Fallback to default data if API fails
        setDefaultData();
      } finally {
        setIsLoading(false);
      }
    };

    const setDefaultData = () => {
      setRecentActivity([
        {
          id: 1,
          type: 'lesson',
          timestamp: 'Start learning to see activity here',
          icon: CheckCircle,
          color: 'text-secondary-500'
        }
      ]);
      setTodayGoal({
        title: 'Set your first learning goal',
        description: 'Click on "Set Goal" to create your first learning objective',
        estimatedTime: 30,
        isDefault: true
      });
      setStats({
        lessonsCompleted: 0,
        overallProgress: 0,
        mockInterviews: 0,
        jobPreps: 0
      });
    };

    fetchDashboardData();
  }, []);

  // Removed old localStorage functions - now using backend data

  const getSkillDisplayName = (skill) => {
    // Convert skill names to display format
    const displayNames = {
      'python': 'Python',
      'javascript': 'JavaScript',
      'algorithms': 'Algorithms',
      'data structures': 'Data Structures',
      'system design': 'System Design',
      'machine learning': 'Machine Learning',
      'database design': 'Database Design',
      'web development': 'Web Development'
    };
    return displayNames[skill] || skill.charAt(0).toUpperCase() + skill.slice(1);
  };

  const getSkillColor = (level) => {
    if (level >= 8) return 'text-accent-600';
    if (level >= 6) return 'text-primary-600';
    if (level >= 4) return 'text-yellow-600';
    return 'text-secondary-500';
  };

  // Extract skill name from topic for progress tracking
  const extractSkillFromTopic = (topic) => {
    if (!topic) return null;
    
    // Map common topics to skill names
    const skillMap = {
      'python': 'Python',
      'javascript': 'JavaScript',
      'react': 'React',
      'aws': 'AWS',
      'system design': 'System Design',
      'sql': 'SQL',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'html': 'HTML'
    };
    
    const lowerTopic = topic.toLowerCase();
    for (const [key, skillName] of Object.entries(skillMap)) {
      if (lowerTopic.includes(key)) {
        return skillName;
      }
    }
    
    // If no exact match, return the first word capitalized
    return topic.split(' ')[0].charAt(0).toUpperCase() + topic.split(' ')[0].slice(1);
  };

  // Handle clicking on a recent session to continue it
  const handleSessionClick = (session) => {
    // Navigate to specific session URL to resume conversation
    navigate(`/tutoring/${session.id}`);
  };

  const quickActions = [
    {
      title: 'Continue Learning',
      description: 'Resume your last tutoring session',
      icon: BookOpen,
      href: '/tutoring',
      color: 'bg-primary-500',
      textColor: 'text-white'
    },
    {
      title: 'New Job Prep',
      description: 'Start preparing for a specific role',
      icon: Briefcase,
      href: '/job-prep',
      color: 'bg-accent-500',
      textColor: 'text-white'
    },
    {
      title: 'Mock Interview',
      description: 'Practice with AI interviewer',
      icon: MessageSquare,
      href: '/mock-interview',
      color: 'bg-secondary-600',
      textColor: 'text-white'
    }
  ];

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-secondary-200 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="h-64 bg-secondary-200 rounded"></div>
            <div className="h-64 bg-secondary-200 rounded"></div>
            <div className="h-64 bg-secondary-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <style>{`
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
        .custom-scrollbar {
          position: relative;
        }
        .custom-scrollbar::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 20px;
          background: linear-gradient(transparent, white);
          pointer-events: none;
          border-radius: 0 0 8px 8px;
        }
        .custom-scrollbar::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 20px;
          background: linear-gradient(white, transparent);
          pointer-events: none;
          border-radius: 8px 8px 0 0;
          z-index: 1;
        }
      `}</style>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 mb-2">
          👋 Welcome back, {user?.name || 'Student'}!
        </h1>
        <p className="text-secondary-600">
          Ready to continue your CS learning journey? Let's make today productive!
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {quickActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Link
              key={index}
              to={action.href}
              className="group block"
            >
              <div className={`${action.color} ${action.textColor} p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 group-hover:scale-105`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{action.title}</h3>
                    <p className="text-sm opacity-90">{action.description}</p>
                  </div>
                  <Icon className="h-8 w-8" />
                </div>
                <div className="flex items-center mt-4 text-sm opacity-90">
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Progress Overview */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-secondary-900">Your Progress</h2>
              <div className="flex items-center space-x-3">
                {dashboardSkills.length > 6 && (
                  <span className="text-xs text-secondary-500 bg-secondary-100 px-2 py-1 rounded-full">
                    {dashboardSkills.length} skills
                  </span>
                )}
                <Link to="/profile" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                  View Details
                </Link>
              </div>
            </div>
            <p className="text-sm text-secondary-600 mb-4">
              Track your learning journey across different CS concepts
            </p>
            
            <div className="max-h-72 sm:max-h-80 lg:max-h-96 overflow-y-auto pr-2 space-y-6 custom-scrollbar border border-secondary-100 rounded-lg p-4 relative">
              {dashboardSkills.length > 0 ? (
                dashboardSkills.map((skill) => (
                  <div key={skill.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-secondary-700">
                        {getSkillDisplayName(skill.name)}
                      </span>
                      <span className={`text-sm font-semibold ${getSkillColor(skill.currentLevel)}`}>
                        Level {skill.currentLevel}/10
                      </span>
                    </div>
                    
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${skill.masteryLevel}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-secondary-500">
                      <span>{skill.totalSessions} tutoring sessions</span>
                      <span>{skill.masteryLevel}% mastery</span>
                    </div>
                    
                    {skill.jobsApplied.length > 0 && (
                      <div className="text-xs text-secondary-400">
                        Applied to: {skill.jobsApplied.slice(0, 2).join(', ')}
                        {skill.jobsApplied.length > 2 && ` +${skill.jobsApplied.length - 2} more`}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-secondary-500 mb-4">No learning paths created yet</p>
                  <p className="text-sm text-secondary-400 mb-3">
                    Create your first learning path to start tracking progress
                  </p>
                  <p className="text-xs text-secondary-400 mb-4">
                    💡 <Link to="/job-prep" className="text-primary-500 hover:text-primary-600 underline">Go to Job Prep</Link> to analyze a job and create a learning path
                  </p>
                  <div className="text-xs text-secondary-400">
                    <p>Example of what you'll see after creating a learning path:</p>
                    <div className="mt-2 p-3 bg-secondary-50 rounded text-left">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-secondary-700">JavaScript</span>
                        <span className="text-primary-600">Level 0/10</span>
                      </div>
                      <div className="w-full bg-secondary-200 rounded-full h-2 mb-1">
                        <div className="bg-primary-600 h-2 rounded-full" style={{ width: '0%' }}></div>
                      </div>
                      <div className="text-secondary-500">0 tutoring sessions • 0% mastery</div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Scroll indicator */}
              {dashboardSkills.length > 6 && (
                <div className="text-center pt-2 border-t border-secondary-100">
                  <div className="text-xs text-secondary-400 flex items-center justify-center">
                    <span className="mr-1">Scroll to see more skills</span>
                    <svg className="w-3 h-3 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Today's Goal */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Target className="h-5 w-5 text-primary-600 mr-2" />
              <h3 className="text-lg font-semibold text-secondary-900">Today's Goal</h3>
            </div>
            {!todayGoal?.isDefault && (
              <button className="text-sm text-primary-600 hover:text-primary-700">
                Edit
              </button>
            )}
          </div>
          
          {todayGoal ? (
            <>
              <div className="bg-primary-50 rounded-lg p-4 mb-4">
                <p className="text-primary-800 font-medium">
                  {todayGoal.title}
                </p>
                {todayGoal.description && (
                  <p className="text-primary-600 text-sm mt-1">
                    {todayGoal.description}
                  </p>
                )}
                <div className="flex items-center mt-2 text-sm text-primary-600">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>Estimated: {todayGoal.estimatedTime} minutes</span>
                </div>
              </div>
              
              <Link to="/tutoring" className="btn-primary w-full flex items-center justify-center">
                <Play className="h-4 w-4 mr-2" />
                Start Learning
              </Link>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-secondary-500 mb-4">No goal set for today</p>
              <button className="btn-primary">
                Set Today's Goal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent Tutoring Sessions */}
      <div className="mt-8">
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-secondary-900">Recent Tutoring Sessions</h2>
            <Link to="/tutoring" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              Start New Session
            </Link>
          </div>
          
          <div className="max-h-64 overflow-y-auto pr-2 space-y-4 custom-scrollbar border border-secondary-100 rounded-lg p-4">
            {recentSessions.length > 0 ? (
              recentSessions.map((session) => (
                <div 
                  key={session.id} 
                  className="p-3 rounded-lg hover:bg-secondary-50 transition-colors cursor-pointer"
                  onClick={() => handleSessionClick(session)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-secondary-900">{session.topic}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      session.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {session.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-secondary-500">
                    <span>Level: {session.skillLevel}</span>
                    <span>{session.conversationCount} messages</span>
                  </div>
                  {session.duration && (
                    <div className="mt-1 text-xs text-secondary-400">
                      Duration: {session.duration} minutes
                    </div>
                  )}
                  
                  {/* Show skill progress if available */}
                  {session.topic && (
                    <div className="mt-2">
                      {(() => {
                        const skillName = extractSkillFromTopic(session.topic);
                        if (skillName) {
                          const skillData = dashboardSkills.find(s => s.name === skillName);
                          if (skillData) {
                            return (
                              <div className="text-xs text-primary-600">
                                Skill Progress: {skillData.masteryLevel}% (Level {skillData.currentLevel}/10)
                              </div>
                            );
                          }
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <BookOpen className="h-8 w-8 text-secondary-400 mx-auto mb-2" />
                <p className="text-secondary-500 text-sm">No tutoring sessions yet</p>
                <Link to="/tutoring" className="text-primary-600 hover:text-primary-700 text-sm font-medium mt-2 inline-block">
                  Start your first session
                </Link>
              </div>
            )}
            
            {/* Scroll indicator for sessions */}
            {recentSessions.length > 3 && (
              <div className="text-center pt-2 border-t border-secondary-100">
                <div className="text-xs text-secondary-400 flex items-center justify-center">
                  <span className="mr-1">Scroll to see more sessions</span>
                  <svg className="w-3 h-3 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved Interview Feedback */}
      {savedInterviews.length > 0 && (
        <div className="mt-8">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-secondary-900">Recent Interview Feedback</h2>
              <span className="text-sm text-secondary-500">{savedInterviews.length} saved</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedInterviews.slice(0, 6).map((interview) => (
                <div key={interview.id} className="bg-secondary-50 rounded-lg p-4 border border-secondary-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-secondary-900 text-sm">
                      {interview.jobTitle}
                    </h3>
                    <span className="text-xs text-secondary-500">
                      {new Date(interview.date).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <p className="text-xs text-secondary-600 mb-2">
                    {interview.company} • {interview.duration} min
                  </p>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-1">
                      <span className="text-lg font-bold text-primary-600">
                        {interview.overallScore}/10
                      </span>
                      <span className="text-xs text-secondary-500">Overall</span>
                    </div>
                    
                    <div className="text-xs text-secondary-500">
                      {interview.categories?.length || 0} categories
                    </div>
                  </div>
                  
                  <div className="text-xs text-secondary-600 line-clamp-2">
                    {interview.summary?.substring(0, 80)}...
                  </div>
                  
                  <div className="mt-3 flex space-x-2">
                    <button 
                      onClick={() => navigate(`/interview-feedback/${interview.id}`)}
                      className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded hover:bg-primary-200 transition-colors"
                    >
                      View Details
                    </button>
                    <button 
                      onClick={() => navigate('/mock-interview')}
                      className="text-xs bg-secondary-100 text-secondary-700 px-2 py-1 rounded hover:bg-secondary-200 transition-colors"
                    >
                      Practice Again
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {savedInterviews.length > 6 && (
              <div className="mt-4 text-center">
                <button 
                  onClick={() => navigate('/mock-interview')}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  View All Saved Interviews →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">

        
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-secondary-100 rounded-lg mx-auto mb-3">
            <MessageSquare className="h-6 w-6 text-secondary-600" />
          </div>
          <h3 className="text-2xl font-bold text-secondary-900 mb-1">
            {stats.mockInterviews || 0}
          </h3>
          <p className="text-sm text-secondary-600">Mock Interviews</p>
        </div>
        
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mx-auto mb-3">
            <Briefcase className="h-6 w-6 text-yellow-600" />
          </div>
          <h3 className="text-2xl font-bold text-secondary-900 mb-1">
            {dashboardSkills.length || 0}
          </h3>
          <p className="text-sm text-secondary-600">Skills Tracked</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;