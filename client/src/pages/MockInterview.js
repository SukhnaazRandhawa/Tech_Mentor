import React from 'react';

const MockInterview = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-secondary-900 mb-4">
          Mock Interview Practice
        </h1>
        <p className="text-secondary-600 mb-8">
          This feature will be implemented in Phase 3. You'll be able to:
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="card text-center">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-lg font-semibold mb-2">AI Interviewer</h3>
            <p className="text-sm text-secondary-600">
              Practice with realistic AI interviewers
            </p>
          </div>
          
          <div className="text-4xl mb-4">💻</div>
          <div className="card text-center">
            <h3 className="text-lg font-semibold mb-2">Coding Challenges</h3>
            <p className="text-sm text-secondary-600">
              Solve real coding problems during interviews
            </p>
          </div>
          
          <div className="card text-center">
            <div className="text-4xl mb-4">🏗️</div>
            <h3 className="text-lg font-semibold mb-2">System Design</h3>
            <p className="text-sm text-secondary-600">
              Practice system design discussions
            </p>
          </div>
          
          <div className="card text-center">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="text-lg font-semibold mb-2">Performance Analytics</h3>
            <p className="text-sm text-secondary-600">
              Track your improvement over time
            </p>
          </div>
        </div>
        
        <div className="mt-8">
          <p className="text-secondary-500">
            Coming soon! This will help you ace your technical interviews.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MockInterview;
