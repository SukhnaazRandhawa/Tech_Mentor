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
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const [recentActivity, setRecentActivity] = useState([]);
  const [todayGoal, setTodayGoal] = useState(null);
  const [stats, setStats] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Fetch dashboard data from backend
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch recent activity
        const activityResponse = await fetch('/api/dashboard/recent-activity');
        if (activityResponse.ok) {
          const activityData = await activityResponse.json();
          setRecentActivity(activityData.activities);
        }
        
        // Fetch today's goal
        const goalResponse = await fetch('/api/dashboard/today-goal');
        if (goalResponse.ok) {
          const goalData = await goalResponse.json();
          setTodayGoal(goalData.goal);
        }
        
        // Fetch statistics
        const statsResponse = await fetch('/api/dashboard/stats');
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData.stats);
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
          title: 'No recent activity',
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

  const getSkillProgress = (skill) => {
    const skillLevels = user?.skillLevels || {};
    const skillData = skillLevels[skill] || { level: 0 };
    return Math.min(skillData.level * 10, 100); // Convert 1-10 scale to percentage
  };

  const getSkillLevel = (skill) => {
    const skillLevels = user?.skillLevels || {};
    const skillData = skillLevels[skill] || { level: 0 };
    return skillData.level;
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
              <Link to="/profile" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                View Details
              </Link>
            </div>
            
            <div className="space-y-6">
              {['python', 'javascript', 'algorithms', 'systemDesign'].map((skill) => (
                <div key={skill} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-secondary-700 capitalize">
                      {skill === 'systemDesign' ? 'System Design' : skill}
                    </span>
                    <span className={`text-sm font-semibold ${getSkillColor(getSkillLevel(skill))}`}>
                      Level {getSkillLevel(skill)}/10
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${getSkillProgress(skill)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
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

      {/* Recent Activity */}
      <div className="mt-8">
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-secondary-900">Recent Activity</h2>
            <Link to="/profile" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View All
            </Link>
          </div>
          
          <div className="space-y-4">
            {recentActivity.map((activity) => {
              // Map icon names to icon components
              const getIconComponent = (iconName) => {
                switch (iconName) {
                  case 'CheckCircle':
                    return CheckCircle;
                  case 'Briefcase':
                    return Briefcase;
                  case 'BookOpen':
                    return BookOpen;
                  case 'MessageSquare':
                    return MessageSquare;
                  default:
                    return CheckCircle;
                }
              };
              
              const Icon = getIconComponent(activity.icon);
              return (
                <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-secondary-50 transition-colors">
                  <div className={`p-2 rounded-full bg-secondary-100`}>
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
        </div>
      </div>

      {/* Stats Overview */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg mx-auto mb-3">
            <BookOpen className="h-6 w-6 text-primary-600" />
          </div>
          <h3 className="text-2xl font-bold text-secondary-900 mb-1">
            {stats.lessonsCompleted || 0}
          </h3>
          <p className="text-sm text-secondary-600">Lessons Completed</p>
        </div>
        
        <div className="card text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-accent-100 rounded-lg mx-auto mb-3">
            <TrendingUp className="h-6 w-6 text-accent-600" />
          </div>
          <h3 className="text-2xl font-bold text-secondary-900 mb-1">
            {stats.overallProgress || 0}%
          </h3>
          <p className="text-sm text-secondary-600">Overall Progress</p>
        </div>
        
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
            {stats.jobPreps || 0}
          </h3>
          <p className="text-sm text-secondary-600">Job Preps</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
