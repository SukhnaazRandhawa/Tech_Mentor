import React from 'react';

const TutoringSession = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-secondary-900 mb-4">
          Interactive Tutoring Session
        </h1>
        <p className="text-secondary-600 mb-8">
          This feature will be implemented in Phase 1. You'll be able to:
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="card text-center">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-lg font-semibold mb-2">AI Chat</h3>
            <p className="text-sm text-secondary-600">
              Interactive conversations with AI tutor
            </p>
          </div>
          
          <div className="card text-center">
            <div className="text-4xl mb-4">💻</div>
            <h3 className="text-lg font-semibold mb-2">Code Editor</h3>
            <p className="text-sm text-secondary-600">
              Write and execute code in real-time
            </p>
          </div>
          
          <div className="card text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-semibold mb-2">Progress Tracking</h3>
            <p className="text-sm text-secondary-600">
              Monitor your learning progress
            </p>
          </div>
        </div>
        
        <div className="mt-8">
          <p className="text-secondary-500">
            Coming soon! This will be the core feature of CodeMentor AI.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TutoringSession;
