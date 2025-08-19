import React from 'react';

const JobPreparation = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-secondary-900 mb-4">
          Job-Targeted Learning
        </h1>
        <p className="text-secondary-600 mb-8">
          This feature will be implemented in Phase 2. You'll be able to:
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="card text-center">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">Job Analysis</h3>
            <p className="text-sm text-secondary-600">
              Upload job descriptions and analyze requirements
            </p>
          </div>
          
          <div className="card text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-lg font-semibold mb-2">Learning Paths</h3>
            <p className="text-sm text-secondary-600">
              Get personalized study plans based on job requirements
            </p>
          </div>
          
          <div className="card text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-semibold mb-2">Skill Gap Assessment</h3>
            <p className="text-sm text-secondary-600">
              Identify what you need to learn for specific roles
            </p>
          </div>
          
          <div className="card text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold mb-2">Project Suggestions</h3>
            <p className="text-sm text-secondary-600">
              Build real projects relevant to your target role
            </p>
          </div>
        </div>
        
        <div className="mt-8">
          <p className="text-secondary-500">
            Coming soon! This will help you prepare for specific job requirements.
          </p>
        </div>
      </div>
    </div>
  );
};

export default JobPreparation;
