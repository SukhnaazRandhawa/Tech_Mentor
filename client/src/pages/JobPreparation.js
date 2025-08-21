import { BookOpen, Clock, FileText, Rocket, Search, Target } from 'lucide-react';
import React, { useEffect, useState } from 'react';

const JobPreparation = () => {
  const [activeTab, setActiveTab] = useState('analysis');
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [preparationTime, setPreparationTime] = useState('12-16');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [learningPath, setLearningPath] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedLearningPaths, setSavedLearningPaths] = useState([]);

  const analyzeJob = async () => {
    if (!jobDescription.trim() || !jobTitle.trim()) {
      alert('Please enter both job title and description');
      return;
    }

    setIsAnalyzing(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const result = {
        requiredSkills: [
          { name: 'Python', level: 8, importance: 'high' },
          { name: 'React', level: 7, importance: 'high' },
          { name: 'AWS', level: 6, importance: 'medium' },
          { name: 'System Design', level: 7, importance: 'high' },
          { name: 'SQL', level: 6, importance: 'medium' }
        ],
        experienceLevel: 'Mid-Senior',
        estimatedSalary: '$120,000 - $150,000',
        preparationTime: preparationTime
      };
      
      setAnalysisResult(result);
      setActiveTab('gaps');
    } catch (error) {
      console.error('Error analyzing job:', error);
      alert('Failed to analyze job description. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateLearningPath = async () => {
    if (!analysisResult) return;
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Customize learning path based on available time
      let phases = [];
      let estimatedDuration = '';
      
      if (preparationTime === '2-4') {
        phases = [
          {
            name: 'Intensive Foundation (Weeks 1-2)',
            skills: ['Python Basics', 'React Fundamentals'],
            resources: ['CodeMentor AI Tutoring', 'Fast-track courses', 'Documentation'],
            milestones: ['Complete Python basics', 'Build simple React app'],
            platformLearning: ['2 tutoring sessions on Python', '1 tutoring session on React']
          },
          {
            name: 'Core Skills (Weeks 3-4)',
            skills: ['API Design', 'Basic System Design'],
            resources: ['CodeMentor AI Tutoring', 'Practice projects', 'Documentation'],
            milestones: ['Build simple API', 'Design basic system'],
            platformLearning: ['2 tutoring sessions on API design', '1 tutoring session on system design']
          }
        ];
        estimatedDuration = '2-4 weeks';
      } else if (preparationTime === '4-8') {
        phases = [
          {
            name: 'Foundation (Weeks 1-3)',
            skills: ['Python Basics', 'React Fundamentals', 'Database Design'],
            resources: ['CodeMentor AI Tutoring', 'Online courses', 'Documentation'],
            milestones: ['Complete Python course', 'Build React app', 'Design database'],
            platformLearning: ['3 tutoring sessions on Python', '2 tutoring sessions on React', '1 tutoring session on databases']
          },
          {
            name: 'Intermediate (Weeks 4-6)',
            skills: ['Advanced Python', 'State Management', 'API Design'],
            resources: ['CodeMentor AI Tutoring', 'Practice projects', 'Code reviews'],
            milestones: ['Build API with FastAPI', 'Implement Redux', 'Create RESTful services'],
            platformLearning: ['2 tutoring sessions on advanced Python', '2 tutoring sessions on state management', '1 tutoring session on API design']
          },
          {
            name: 'Advanced (Weeks 7-8)',
            skills: ['System Design', 'Performance Optimization'],
            resources: ['CodeMentor AI Tutoring', 'System design books', 'Performance testing'],
            milestones: ['Design scalable architecture', 'Optimize performance'],
            platformLearning: ['2 tutoring sessions on system design', '1 tutoring session on performance optimization']
          }
        ];
        estimatedDuration = '4-8 weeks';
      } else if (preparationTime === '8-12') {
        phases = [
          {
            name: 'Foundation (Weeks 1-4)',
            skills: ['Python Basics', 'React Fundamentals', 'Database Design'],
            resources: ['CodeMentor AI Tutoring', 'Online courses', 'Practice projects', 'Documentation'],
            milestones: ['Complete Python course', 'Build simple React app', 'Design database schema'],
            platformLearning: ['4 tutoring sessions on Python', '3 tutoring sessions on React', '2 tutoring sessions on databases']
          },
          {
            name: 'Intermediate (Weeks 5-8)',
            skills: ['Advanced Python', 'State Management', 'API Design'],
            resources: ['CodeMentor AI Tutoring', 'Advanced tutorials', 'Real projects', 'Code reviews'],
            milestones: ['Build API with FastAPI', 'Implement Redux', 'Create RESTful services'],
            platformLearning: ['3 tutoring sessions on advanced Python', '2 tutoring sessions on state management', '2 tutoring sessions on API design']
          },
          {
            name: 'Advanced (Weeks 9-12)',
            skills: ['System Design', 'Cloud Services', 'Performance Optimization'],
            resources: ['CodeMentor AI Tutoring', 'System design books', 'AWS labs', 'Performance testing'],
            milestones: ['Design scalable architecture', 'Deploy to AWS', 'Optimize performance'],
            platformLearning: ['3 tutoring sessions on system design', '2 tutoring sessions on cloud services', '1 tutoring session on performance']
          }
        ];
        estimatedDuration = '8-12 weeks';
      } else {
        // Default 12-16 weeks
        phases = [
          {
            name: 'Foundation (Weeks 1-4)',
            skills: ['Python Basics', 'React Fundamentals', 'Database Design'],
            resources: ['CodeMentor AI Tutoring', 'Online courses', 'Practice projects', 'Documentation'],
            milestones: ['Complete Python course', 'Build simple React app', 'Design database schema'],
            platformLearning: ['4 tutoring sessions on Python', '3 tutoring sessions on React', '2 tutoring sessions on databases']
          },
          {
            name: 'Intermediate (Weeks 5-8)',
            skills: ['Advanced Python', 'State Management', 'API Design'],
            resources: ['CodeMentor AI Tutoring', 'Advanced tutorials', 'Real projects', 'Code reviews'],
            milestones: ['Build API with FastAPI', 'Implement Redux', 'Create RESTful services'],
            platformLearning: ['3 tutoring sessions on advanced Python', '2 tutoring sessions on state management', '2 tutoring sessions on API design']
          },
          {
            name: 'Advanced (Weeks 9-12)',
            skills: ['System Design', 'Cloud Services', 'Performance Optimization'],
            resources: ['CodeMentor AI Tutoring', 'System design books', 'AWS labs', 'Performance testing'],
            milestones: ['Design scalable architecture', 'Deploy to AWS', 'Optimize performance'],
            platformLearning: ['3 tutoring sessions on system design', '2 tutoring sessions on cloud services', '1 tutoring session on performance']
          },
          {
            name: 'Expertise (Weeks 13-16)',
            skills: ['Leadership', 'Architecture Patterns', 'Best Practices'],
            resources: ['CodeMentor AI Tutoring', 'Leadership books', 'Code reviews', 'Mentoring'],
            milestones: ['Lead technical discussions', 'Implement patterns', 'Mentor others'],
            platformLearning: ['2 tutoring sessions on leadership', '2 tutoring sessions on architecture', '1 tutoring session on mentoring']
          }
        ];
        estimatedDuration = '12-16 weeks';
      }
      
      const path = {
        title: `Learning Path for ${jobTitle}`,
        estimatedDuration: estimatedDuration,
        phases: phases
      };
      
      setLearningPath(path);
      setActiveTab('learning');
    } catch (error) {
      console.error('Error generating learning path:', error);
      alert('Failed to generate learning path. Please try again.');
    }
  };

  const saveLearningPath = async () => {
    if (!learningPath || !analysisResult) return;
    
    setIsSaving(true);
    
    try {
      // Create a comprehensive learning path object
      const pathToSave = {
        id: Date.now(),
        jobTitle: jobTitle,
        company: company || 'Unknown Company',
        dateCreated: new Date().toISOString(),
        preparationTime: preparationTime,
        analysisResult: analysisResult,
        learningPath: learningPath,
        progress: {
          overallProgress: 0,
          skills: analysisResult.requiredSkills.map(skill => ({
            name: skill.name,
            requiredLevel: skill.level,
            currentLevel: 0, // Will be updated based on tutoring sessions
            progress: 0,
            status: 'not-started', // not-started, in-progress, completed
            tutoringSessions: 0,
            lastUpdated: new Date().toISOString()
          }))
        }
      };
      
      // Save to localStorage
      const existingPaths = JSON.parse(localStorage.getItem('savedLearningPaths') || '[]');
      existingPaths.push(pathToSave);
      localStorage.setItem('savedLearningPaths', JSON.stringify(existingPaths));
      
      // Update state
      setSavedLearningPaths(existingPaths);
      
      // Also save to a general progress tracking
      const userProgress = JSON.parse(localStorage.getItem('userSkillProgress') || '{}');
      
      analysisResult.requiredSkills.forEach(skill => {
        if (!userProgress[skill.name]) {
          userProgress[skill.name] = {
            currentLevel: 0,
            totalSessions: 0,
            lastSession: null,
            masteryLevel: 0, // 0-100%
            jobsApplied: []
          };
        }
        // Add this job to the skill's job list
        if (!userProgress[skill.name].jobsApplied.includes(jobTitle)) {
          userProgress[skill.name].jobsApplied.push(jobTitle);
        }
      });
      
      localStorage.setItem('userSkillProgress', JSON.stringify(userProgress));
      
      alert('Learning path saved successfully! Your progress will now be tracked.');
    } catch (error) {
      console.error('Error saving learning path:', error);
      alert('Failed to save learning path. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getProjectSuggestions = (skillName) => {
    const projectDatabase = {
      'Python': [
        {
          title: 'Python Web API',
          description: 'Build a RESTful API using FastAPI with authentication, database integration, and automated testing.',
          skills: ['Python', 'FastAPI', 'SQLAlchemy', 'Pytest'],
          difficulty: 'Intermediate',
          estimatedTime: '2-3 weeks',
          relevance: 95
        },
        {
          title: 'Data Analysis Tool',
          description: 'Create a data analysis application using pandas, matplotlib, and scikit-learn for data visualization and machine learning.',
          skills: ['Python', 'Pandas', 'Matplotlib', 'Scikit-learn'],
          difficulty: 'Intermediate',
          estimatedTime: '3-4 weeks',
          relevance: 90
        }
      ],
      'React': [
        {
          title: 'React Dashboard',
          description: 'Build an interactive dashboard with charts, data tables, and real-time updates using React hooks and context.',
          skills: ['React', 'Chart.js', 'Context API', 'CSS Grid'],
          difficulty: 'Intermediate',
          estimatedTime: '2-3 weeks',
          relevance: 92
        },
        {
          title: 'React E-commerce',
          description: 'Create a product catalog with shopping cart, user authentication, and payment integration.',
          skills: ['React', 'Redux', 'Stripe API', 'Firebase'],
          difficulty: 'Advanced',
          estimatedTime: '4-5 weeks',
          relevance: 88
        }
      ],
      'AWS': [
        {
          title: 'Cloud Infrastructure',
          description: 'Deploy a full-stack application on AWS using EC2, RDS, S3, and CloudFront with CI/CD pipeline.',
          skills: ['AWS', 'Terraform', 'Docker', 'CI/CD'],
          difficulty: 'Advanced',
          estimatedTime: '3-4 weeks',
          relevance: 85
        }
      ],
      'System Design': [
        {
          title: 'Scalable Chat System',
          description: 'Design and implement a real-time chat system with user presence, message persistence, and load balancing.',
          skills: ['WebSockets', 'Redis', 'Load Balancing', 'Database Design'],
          difficulty: 'Advanced',
          estimatedTime: '4-5 weeks',
          relevance: 90
        }
      ],
      'SQL': [
        {
          title: 'Database Design',
          description: 'Design a normalized database schema for a social media platform with complex relationships and queries.',
          skills: ['SQL', 'Database Design', 'Indexing', 'Query Optimization'],
          difficulty: 'Intermediate',
          estimatedTime: '2-3 weeks',
          relevance: 87
        }
      ]
    };
    
    return projectDatabase[skillName] || [
      {
        title: 'General Practice Project',
        description: 'A project to practice the core concepts and best practices.',
        skills: [skillName, 'Best Practices', 'Testing'],
        difficulty: 'Intermediate',
        estimatedTime: '2-3 weeks',
        relevance: 75
      }
    ];
  };

  // Save data to localStorage whenever it changes
  useEffect(() => {
    const jobData = {
      jobTitle,
      company,
      jobDescription,
      preparationTime,
      analysisResult,
      learningPath
    };
    localStorage.setItem('jobPreparationData', JSON.stringify(jobData));
  }, [jobTitle, company, jobDescription, preparationTime, analysisResult, learningPath]);

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedJobData = localStorage.getItem('jobPreparationData');
    if (savedJobData) {
      try {
        const data = JSON.parse(savedJobData);
        if (data.jobTitle) setJobTitle(data.jobTitle);
        if (data.company) setCompany(data.company);
        if (data.jobDescription) setJobDescription(data.jobDescription);
        if (data.preparationTime) setPreparationTime(data.preparationTime);
        if (data.analysisResult) setAnalysisResult(data.analysisResult);
        if (data.learningPath) setLearningPath(data.learningPath);
      } catch (error) {
        console.error('Error loading saved job data:', error);
      }
    }
    
    // Load saved learning paths
    const savedPaths = localStorage.getItem('savedLearningPaths');
    if (savedPaths) {
      try {
        setSavedLearningPaths(JSON.parse(savedPaths));
      } catch (error) {
        console.error('Error loading saved learning paths:', error);
      }
    }
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 mb-4">
          Job-Targeted Learning
        </h1>
        <p className="text-secondary-600 max-w-2xl mx-auto">
          Analyze job postings, identify skill gaps, and get personalized learning paths.
        </p>
      </div>

      <div className="flex flex-wrap justify-center mb-8">
        <button
          onClick={() => setActiveTab('analysis')}
          className={`px-4 py-2 mx-1 mb-2 rounded-lg font-medium ${
            activeTab === 'analysis' ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-700'
          }`}
        >
          <FileText className="h-4 w-4 inline mr-2" />
          Job Analysis
        </button>
        <button
          onClick={() => setActiveTab('gaps')}
          className={`px-4 py-2 mx-1 mb-2 rounded-lg font-medium ${
            activeTab === 'gaps' ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-700'
          }`}
        >
          <Target className="h-4 w-4 inline mr-2" />
          Skill Gaps
        </button>
        <button
          onClick={() => setActiveTab('learning')}
          className={`px-4 py-2 mx-1 mb-2 rounded-lg font-medium ${
            activeTab === 'learning' ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-700'
          }`}
        >
          <BookOpen className="h-4 w-4 inline mr-2" />
          Learning Path
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2 mx-1 mb-2 rounded-lg font-medium ${
            activeTab === 'projects' ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-700'
          }`}
        >
          <Rocket className="h-4 w-4 inline mr-2" />
          Projects
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`px-4 py-2 mx-1 mb-2 rounded-lg font-medium ${
            activeTab === 'saved' ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-700'
          }`}
        >
          <BookOpen className="h-4 w-4 inline mr-2" />
          Saved Paths
        </button>
      </div>

      {activeTab === 'analysis' && (
        <div className="max-w-4xl mx-auto">
          <div className="card">
            <h2 className="text-2xl font-bold text-secondary-900 mb-6">
              Analyze Job Description
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Job Title *
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g., Senior Software Engineer"
                  className="input-field w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Company (Optional)
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g., Google, Microsoft, Startup Inc"
                  className="input-field w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Available Preparation Time *
                </label>
                <select
                  value={preparationTime}
                  onChange={(e) => setPreparationTime(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="2-4">2-4 weeks (Intensive)</option>
                  <option value="4-8">4-8 weeks (Fast-track)</option>
                  <option value="8-12">8-12 weeks (Standard)</option>
                  <option value="12-16">12-16 weeks (Comprehensive)</option>
                  <option value="16+">16+ weeks (Flexible)</option>
                </select>
                <p className="text-xs text-secondary-500 mt-1">
                  This will customize your learning path and project timeline.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Job Description *
                </label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here..."
                  rows={8}
                  className="input-field w-full resize-none"
                />
              </div>
              
              <div className="flex justify-center">
                <button
                  onClick={analyzeJob}
                  disabled={isAnalyzing || !jobDescription.trim() || !jobTitle.trim()}
                  className="btn-primary px-8 py-3 text-lg"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-4 mr-2" />
                      Analyze Job
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'gaps' && (
        <div className="max-w-6xl mx-auto">
          {analysisResult ? (
            <div className="space-y-6">
              {/* Analysis Summary */}
              <div className="card">
                <h2 className="text-2xl font-bold text-secondary-900 mb-4">
                  Job Analysis Results
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-secondary-50 rounded-lg">
                    <div className="text-2xl font-bold text-primary-600">
                      {analysisResult.requiredSkills.length}
                    </div>
                    <div className="text-sm text-secondary-600">Required Skills</div>
                  </div>
                  <div className="text-center p-4 bg-secondary-50 rounded-lg">
                    <div className="text-lg font-semibold text-secondary-700">
                      {analysisResult.experienceLevel}
                    </div>
                    <div className="text-sm text-secondary-600">Experience Level</div>
                  </div>
                  <div className="text-center p-4 bg-secondary-50 rounded-lg">
                    <div className="text-lg font-semibold text-secondary-700">
                      {analysisResult.estimatedSalary}
                    </div>
                    <div className="text-sm text-secondary-600">Estimated Salary</div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button 
                    onClick={generateLearningPath}
                    className="btn-primary"
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Generate Learning Path
                  </button>
                </div>
              </div>

              {/* Required Skills */}
              <div className="card">
                <h3 className="text-xl font-semibold text-secondary-900 mb-4">
                  Required Skills
                </h3>
                
                <div className="space-y-4">
                  {analysisResult.requiredSkills.map((skill, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border border-secondary-200 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-secondary-900">{skill.name}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            skill.importance === 'high' ? 'text-red-600 bg-red-100' : 
                            skill.importance === 'medium' ? 'text-yellow-600 bg-yellow-100' : 
                            'text-green-600 bg-green-100'
                          }`}>
                            {skill.importance} priority
                          </span>
                        </div>
                        
                        <div className="text-sm text-secondary-600">
                          Required Level: {skill.level}/10
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Target className="h-16 w-16 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                No Job Analysis Yet
              </h3>
              <p className="text-secondary-600 mb-4">
                Start by analyzing a job description to see your skill gaps.
              </p>
              <button
                onClick={() => setActiveTab('analysis')}
                className="btn-primary"
              >
                Analyze Job
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'learning' && (
        <div className="max-w-6xl mx-auto">
          {learningPath ? (
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-2xl font-bold text-secondary-900 mb-4">
                  {learningPath.title}
                </h2>
                
                <div className="text-center mb-6">
                  <div className="inline-flex items-center px-4 py-2 bg-primary-100 text-primary-800 rounded-full mb-4">
                    <Clock className="h-4 w-4 mr-2" />
                    Estimated Duration: {learningPath.estimatedDuration}
                  </div>
                  
                  <button
                    onClick={saveLearningPath}
                    disabled={isSaving}
                    className="btn-primary px-6 py-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <BookOpen className="h-4 w-4 mr-2" />
                        Save Learning Path
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-6">
                  {learningPath.phases.map((phase, index) => (
                    <div key={index} className="border border-secondary-200 rounded-lg p-6">
                      <div className="flex items-center mb-4">
                        <div className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                          {index + 1}
                        </div>
                        <h3 className="text-lg font-semibold text-secondary-900">
                          {phase.name}
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <h4 className="font-medium text-secondary-900 mb-2">Skills to Learn</h4>
                          <div className="space-y-1">
                            {phase.skills.map((skill, skillIndex) => (
                              <div key={skillIndex} className="text-sm text-secondary-600">
                                • {skill}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-secondary-900 mb-2">Resources</h4>
                          <div className="space-y-1">
                            {phase.resources.map((resource, resourceIndex) => (
                              <div key={resourceIndex} className="text-sm text-secondary-600">
                                • {resource}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-secondary-900 mb-2">Milestones</h4>
                          <div className="space-y-1">
                            {phase.milestones.map((milestone, milestoneIndex) => (
                              <div key={milestoneIndex} className="text-sm text-secondary-600">
                                • {milestone}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-secondary-900 mb-2 text-primary-600">Platform Learning</h4>
                          <div className="space-y-1">
                            {phase.platformLearning.map((platformItem, platformIndex) => (
                              <div key={platformIndex} className="text-sm text-primary-600 font-medium">
                                • {platformItem}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-16 w-16 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                No Learning Path Generated
              </h3>
              <p className="text-secondary-600 mb-4">
                Generate a learning path based on your job analysis.
              </p>
              <button
                onClick={() => setActiveTab('gaps')}
                className="btn-primary"
              >
                Generate Path
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="max-w-6xl mx-auto">
          <div className="card">
            <h2 className="text-2xl font-bold text-secondary-900 mb-6">
              Project Suggestions
              {analysisResult && (
                <span className="text-lg font-normal text-secondary-600 ml-2">
                  for {jobTitle}
                </span>
              )}
            </h2>
            
            {analysisResult ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {analysisResult.requiredSkills.map((skill, index) => {
                  // Generate project suggestions based on required skills
                  const projectSuggestions = getProjectSuggestions(skill.name);
                  return projectSuggestions.map((project, projectIndex) => (
                    <div key={`${index}-${projectIndex}`} className="border border-secondary-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-lg font-semibold text-secondary-900">
                          {project.title}
                        </h3>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          project.difficulty === 'Beginner' ? 'bg-green-100 text-green-800' :
                          project.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {project.difficulty}
                        </div>
                      </div>
                      
                      <p className="text-secondary-600 mb-4 text-sm">
                        {project.description}
                      </p>
                      
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium text-secondary-900 mb-2 text-sm">Skills Covered</h4>
                          <div className="flex flex-wrap gap-2">
                            {project.skills.map((skillName, skillIndex) => (
                              <span key={skillIndex} className="px-2 py-1 bg-secondary-100 text-secondary-700 text-xs rounded-full">
                                {skillName}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-secondary-600">
                            <Clock className="h-4 w-4 mr-1" />
                            {project.estimatedTime}
                          </div>
                          <div className="flex items-center text-sm text-secondary-600">
                            <span className="text-yellow-500">★</span>
                            {project.relevance}% relevant
                          </div>
                        </div>
                        
                        <button className="btn-primary w-full">
                          Start Project
                        </button>
                      </div>
                    </div>
                  ));
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Rocket className="h-16 w-16 text-secondary-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                  No Job Analysis Yet
                </h3>
                <p className="text-secondary-600 mb-4">
                  Analyze a job description first to get personalized project suggestions.
                </p>
                <button
                  onClick={() => setActiveTab('analysis')}
                  className="btn-primary"
                >
                  Analyze Job
                </button>
              </div>
                         )}
                      </div>
                    </div>
                  )}

      {/* Saved Learning Paths Tab */}
      {activeTab === 'saved' && (
        <div className="max-w-6xl mx-auto">
          <div className="card">
            <h2 className="text-2xl font-bold text-secondary-900 mb-6">
              Saved Learning Paths
            </h2>
            
            {savedLearningPaths.length > 0 ? (
              <div className="space-y-6">
                {savedLearningPaths.map((path) => (
                  <div key={path.id} className="border border-secondary-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-secondary-900">
                          {path.jobTitle}
                        </h3>
                        <p className="text-secondary-600">{path.company}</p>
                        <p className="text-sm text-secondary-500">
                          Created: {new Date(path.dateCreated).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-semibold text-primary-600">
                          {path.progress.overallProgress}%
                        </div>
                        <div className="text-sm text-secondary-600">Overall Progress</div>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <h4 className="font-medium text-secondary-900 mb-2">Skills Progress</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {path.progress.skills.map((skill, index) => (
                          <div key={index} className="bg-secondary-50 p-3 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-secondary-900">{skill.name}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                skill.status === 'completed' ? 'bg-green-100 text-green-800' :
                                skill.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {skill.status === 'completed' ? 'Completed' :
                                 skill.status === 'in-progress' ? 'In Progress' : 'Not Started'}
                              </span>
                            </div>
                            
                            <div className="text-sm text-secondary-600 mb-2">
                              Level: {skill.currentLevel}/{skill.requiredLevel}
                            </div>
                            
                            <div className="w-full bg-secondary-200 rounded-full h-2">
                              <div 
                                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${skill.progress}%` }}
                              ></div>
                            </div>
                            
                            <div className="text-xs text-secondary-500 mt-1">
                              {skill.tutoringSessions} tutoring sessions
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button className="btn-secondary text-sm">
                        View Details
                      </button>
                      <button className="btn-primary text-sm">
                        Continue Learning
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="h-16 w-16 text-secondary-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                  No Saved Learning Paths
                </h3>
                <p className="text-secondary-600 mb-4">
                  Save a learning path after generating it to track your progress.
                </p>
                <button
                  onClick={() => setActiveTab('analysis')}
                  className="btn-primary"
                >
                  Create Learning Path
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobPreparation;
