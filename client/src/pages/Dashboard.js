import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle,
  Clock,
  MessageSquare,
  Play,
  Target,
  TrendingUp
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
const { user } = useAuth();
const navigate = useNavigate();
const [dashboardData, setDashboardData] = useState({
  recentActivity: [],
  todaysGoal: null,
  stats: {
    lessonsCompleted: 0,
    overallProgress: 0,
    mockInterviews: 0,
    jobPreps: 0
  },
  skills: {}
});
const [recentSessions, setRecentSessions] = useState([]);
const [isLoading, setIsLoading] = useState(true);

// Fetch dashboard data from backend (not localStorage!)
useEffect(() => {
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all data from backend endpoints
      const [activityRes, goalRes, statsRes, skillsRes, sessionsRes] = await Promise.all([
        fetch('/api/dashboard/recent-activity'),
        fetch('/api/dashboard/today-goal'),
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/skills'),
        fetch('/api/tutoring/sessions')
      ]);

      // Parse responses
      const activityData = activityRes.ok ? await activityRes.json() : { activities: [] };
      const goalData = goalRes.ok ? await goalRes.json() : { goal: null };
      const statsData = statsRes.ok ? await statsRes.json() : { stats: { lessonsCompleted: 0, overallProgress: 0, mockInterviews: 0, jobPreps: 0 } };
      const skillsData = skillsRes.ok ? await skillsRes.json() : { skills: {} };
      const sessionsData = sessionsRes.ok ? await sessionsRes.json() : { sessions: [] };

      setDashboardData({
        recentActivity: activityData.activities || [],
        todaysGoal: goalData.goal,
        stats: statsData.stats || { lessonsCompleted: 0, overallProgress: 0, mockInterviews: 0, jobPreps: 0 },
        skills: skillsData.skills || {}
      });

      setRecentSessions(sessionsData.sessions ? sessionsData.sessions.slice(0, 3) : []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setDefaultEmptyState();
    } finally {
      setIsLoading(false);
    }
  };

  const setDefaultEmptyState = () => {
    setDashboardData({
      recentActivity: [],
      todaysGoal: {
        title: 'Start Your Learning Journey',
        description: 'Choose your first skill to learn',
        estimatedTime: 30
      },
      stats: { lessonsCompleted: 0, overallProgress: 0, mockInterviews: 0, jobPreps: 0 },
      skills: {}
    });
    setRecentSessions([]);
  };

  fetchDashboardData();
}, []);

const formatSkillName = (skillKey) => {
  // Convert camelCase to proper display name
  return skillKey
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const getSkillProgress = (skillLevel) => {
  return Math.min(skillLevel * 10, 100);
};

const getSkillColor = (level) => {
  if (level >= 8) return 'text-accent-600';
  if (level >= 6) return 'text-primary-600';
  if (level >= 4) return 'text-yellow-600';
  return 'text-secondary-500';
};

const quickActions = [
  {
    title: 'Continue Learning',
    description: dashboardData.recentActivity.length > 0 
      ? 'Resume your last tutoring session' 
      : 'Start your first lesson',
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

const userSkills = Object.entries(dashboardData.skills);

return (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {/* Welcome Section */}
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-secondary-900 mb-2">
        👋 Welcome back, {user?.name || 'Student'}!
      </h1>
      <p className="text-secondary-600">
        {dashboardData.recentActivity.length > 0 
          ? "Ready to continue your CS learning journey? Let's make today productive!"
          : "Welcome to CodeMentor AI! Let's start your CS learning journey today!"
        }
      </p>
    </div>

    {/* Quick Actions */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {quickActions.map((action, index) => {
        const Icon = action.icon;
        return (
          <Link key={index} to={action.href} className="group block">
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
            <Link to="/profile" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View Details
            </Link>
          </div>
          <p className="text-sm text-secondary-600 mb-4">
            Track your learning journey across different CS concepts
          </p>
          
          {/* Skills Progress */}
          {userSkills.length > 0 ? (
            <div className="space-y-6">
              {userSkills.map(([skillKey, skillData]) => (
                <div key={skillKey} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-secondary-700">
                      {skillData.displayName || formatSkillName(skillKey)}
                    </span>
                    <span className={`text-sm font-semibold ${getSkillColor(skillData.level)}`}>
                      Level {skillData.level}/10
                    </span>
                  </div>
                  
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${getSkillProgress(skillData.level)}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-secondary-500">
                    <span>Last updated: {new Date(skillData.lastUpdated).toLocaleDateString()}</span>
                    <span>{skillData.level * 10}% mastery</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-16 w-16 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-secondary-900 mb-2">No skills tracked yet</h3>
              <p className="text-secondary-600 mb-4">
                Start learning to see your progress here!
              </p>
              <div className="space-y-2">
                <Link to="/tutoring" className="btn-primary inline-flex items-center">
                  <Play className="h-4 w-4 mr-2" />
                  Start Learning
                </Link>
                <p className="text-sm text-secondary-500">
                  or <Link to="/job-prep" className="text-primary-600 hover:text-primary-700 underline">
                    create a learning path
                  </Link> first
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today's Goal */}
      <div className="card">
        <div className="flex items-center mb-4">
          <Target className="h-5 w-5 text-primary-600 mr-2" />
          <h3 className="text-lg font-semibold text-secondary-900">Today's Goal</h3>
        </div>
        
        {dashboardData.todaysGoal ? (
          <>
            <div className="bg-primary-50 rounded-lg p-4 mb-4">
              <p className="text-primary-800 font-medium">
                {dashboardData.todaysGoal.title}
              </p>
              {dashboardData.todaysGoal.description && (
                <p className="text-primary-600 text-sm mt-1">
                  {dashboardData.todaysGoal.description}
                </p>
              )}
              <div className="flex items-center mt-2 text-sm text-primary-600">
                <Clock className="h-4 w-4 mr-1" />
                <span>Estimated: {dashboardData.todaysGoal.estimatedTime} minutes</span>
              </div>
            </div>
            
            <Link to="/tutoring" className="btn-primary w-full flex items-center justify-center">
              <Play className="h-4 w-4 mr-2" />
              Start Learning
            </Link>
          </>
        ) : (
          <div className="text-center py-8">
            <Target className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
            <p className="text-secondary-500 mb-4">No goal set for today</p>
            <Link to="/tutoring" className="btn-primary">
              Set Learning Goal
            </Link>
          </div>
        )}
      </div>
    </div>

    {/* Recent Activity & Stats */}
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Recent Activity */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-secondary-900">Recent Activity</h2>
          <Link to="/profile" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            View All
          </Link>
        </div>
        
        {dashboardData.recentActivity.length > 0 ? (
          <div className="space-y-4">
            {dashboardData.recentActivity.map((activity) => {
              const getIconComponent = (iconName) => {
                switch (iconName) {
                  case 'CheckCircle': return CheckCircle;
                  case 'Briefcase': return Briefcase;
                  case 'BookOpen': return BookOpen;
                  case 'MessageSquare': return MessageSquare;
                  default: return CheckCircle;
                }
              };
              
              const Icon = getIconComponent(activity.icon);
              return (
                <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-secondary-50 transition-colors">
                  <div className="p-2 rounded-full bg-secondary-100">
                    <Icon className={`h-4 w-4 ${activity.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-secondary-900">{activity.title}</p>
                    <p className="text-xs text-secondary-500">{activity.timestamp}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
            <p className="text-secondary-600 mb-4">No recent activity yet</p>
            <p className="text-secondary-500 text-sm">
              Start learning to see your activities here!
            </p>
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-secondary-900">Recent Sessions</h2>
          <Link to="/tutoring" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            Start New
          </Link>
        </div>
        
        {recentSessions.length > 0 ? (
          <div className="space-y-4">
            {recentSessions.map((session) => (
              <div key={session.id} className="p-3 rounded-lg hover:bg-secondary-50 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-secondary-900">{session.topic}</h4>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    {session.status}
                  </span>
                </div>
                <div className="text-xs text-secondary-500">
                  Level: {session.skillLevel} • {session.conversationCount} messages
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <BookOpen className="h-8 w-8 text-secondary-400 mx-auto mb-2" />
            <p className="text-secondary-500 text-sm">No tutoring sessions yet</p>
            <Link to="/tutoring" className="text-primary-600 hover:text-primary-700 text-sm font-medium mt-2 inline-block">
              Start your first session
            </Link>
          </div>
        )}
      </div>
    </div>

    {/* Stats Overview */}
    <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="card text-center">
        <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg mx-auto mb-3">
          <BookOpen className="h-6 w-6 text-primary-600" />
        </div>
        <h3 className="text-2xl font-bold text-secondary-900 mb-1">
          {dashboardData.stats.lessonsCompleted}
        </h3>
        <p className="text-sm text-secondary-600">Lessons Completed</p>
      </div>
      
      <div className="card text-center">
        <div className="flex items-center justify-center w-12 h-12 bg-accent-100 rounded-lg mx-auto mb-3">
          <TrendingUp className="h-6 w-6 text-accent-600" />
        </div>
        <h3 className="text-2xl font-bold text-secondary-900 mb-1">
          {dashboardData.stats.overallProgress}%
        </h3>
        <p className="text-sm text-secondary-600">Overall Progress</p>
      </div>
      
      <div className="card text-center">
        <div className="flex items-center justify-center w-12 h-12 bg-secondary-100 rounded-lg mx-auto mb-3">
          <MessageSquare className="h-6 w-6 text-secondary-600" />
        </div>
        <h3 className="text-2xl font-bold text-secondary-900 mb-1">
          {dashboardData.stats.mockInterviews}
        </h3>
        <p className="text-sm text-secondary-600">Mock Interviews</p>
      </div>
      
      <div className="card text-center">
        <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mx-auto mb-3">
          <Briefcase className="h-6 w-6 text-yellow-600" />
        </div>
        <h3 className="text-2xl font-bold text-secondary-900 mb-1">
          {userSkills.length}
        </h3>
        <p className="text-sm text-secondary-600">Skills Tracked</p>
      </div>
    </div>
  </div>
);
};

export default Dashboard;