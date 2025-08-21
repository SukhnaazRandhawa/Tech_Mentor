import { BookOpen, Clock, FileText, Rocket, Search, Target } from 'lucide-react';
import React, { useState } from 'react';

const JobPreparation = () => {
  const [activeTab, setActiveTab] = useState('analysis');
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [learningPath, setLearningPath] = useState(null);

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
        estimatedSalary: '$120,000 - $150,000'
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
      
      const path = {
        title: `Learning Path for ${jobTitle}`,
        estimatedDuration: '12-16 weeks',
        phases: [
          {
            name: 'Foundation (Weeks 1-4)',
            skills: ['Python Basics', 'React Fundamentals', 'Database Design'],
            resources: ['Online courses', 'Practice projects', 'Documentation'],
            milestones: ['Complete Python course', 'Build simple React app', 'Design database schema']
          },
          {
            name: 'Intermediate (Weeks 5-8)',
            skills: ['Advanced Python', 'State Management', 'API Design'],
            resources: ['Advanced tutorials', 'Real projects', 'Code reviews'],
            milestones: ['Build API with FastAPI', 'Implement Redux', 'Create RESTful services']
          },
          {
            name: 'Advanced (Weeks 9-12)',
            skills: ['System Design', 'Cloud Services', 'Performance Optimization'],
            resources: ['System design books', 'AWS labs', 'Performance testing'],
            milestones: ['Design scalable architecture', 'Deploy to AWS', 'Optimize performance']
          }
        ]
      };
      
      setLearningPath(path);
      setActiveTab('learning');
    } catch (error) {
      console.error('Error generating learning path:', error);
      alert('Failed to generate learning path. Please try again.');
    }
  };

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
                  <div className="inline-flex items-center px-4 py-2 bg-primary-100 text-primary-800 rounded-full">
                    <Clock className="h-4 w-4 mr-2" />
                    Estimated Duration: {learningPath.estimatedDuration}
                  </div>
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-secondary-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-secondary-900">
                    E-commerce Platform
                  </h3>
                  <div className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                    Intermediate
                  </div>
                </div>
                
                <p className="text-secondary-600 mb-4 text-sm">
                  Build a full-stack e-commerce application with user authentication, product management, and payment integration.
                </p>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-secondary-900 mb-2 text-sm">Skills Covered</h4>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-secondary-100 text-secondary-700 text-xs rounded-full">React</span>
                      <span className="px-2 py-1 bg-secondary-100 text-secondary-700 text-xs rounded-full">Node.js</span>
                      <span className="px-2 py-1 bg-secondary-100 text-secondary-700 text-xs rounded-full">MongoDB</span>
                      <span className="px-2 py-1 bg-secondary-100 text-secondary-700 text-xs rounded-full">Stripe API</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-secondary-600">
                      <Clock className="h-4 w-4 mr-1" />
                      4-6 weeks
                    </div>
                    <div className="flex items-center text-sm text-secondary-600">
                      <span className="text-yellow-500">★</span>
                      95% relevant
                    </div>
                  </div>
                  
                  <button className="btn-primary w-full">
                    Start Project
                  </button>
                </div>
              </div>

              <div className="border border-secondary-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-secondary-900">
                    Real-time Chat Application
                  </h3>
                  <div className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                    Intermediate
                  </div>
                </div>
                
                <p className="text-secondary-600 mb-4 text-sm">
                  Create a chat app with WebSocket integration, user presence, and message history.
                </p>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-secondary-900 mb-2 text-sm">Skills Covered</h4>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-secondary-100 text-secondary-700 text-xs rounded-full">React</span>
                      <span className="px-2 py-1 bg-secondary-100 text-secondary-700 text-xs rounded-full">Socket.io</span>
                      <span className="px-2 py-1 bg-secondary-100 text-secondary-700 text-xs rounded-full">Express</span>
                      <span className="px-2 py-1 bg-secondary-100 text-secondary-700 text-xs rounded-full">Redis</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-secondary-600">
                      <Clock className="h-4 w-4 mr-1" />
                      3-4 weeks
                    </div>
                    <div className="flex items-center text-sm text-secondary-600">
                      <span className="text-yellow-500">★</span>
                      88% relevant
                    </div>
                  </div>
                  
                  <button className="btn-primary w-full">
                    Start Project
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobPreparation;
