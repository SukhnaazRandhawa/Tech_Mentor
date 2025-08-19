import React from 'react';

const Profile = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-secondary-900 mb-4">
          User Profile
        </h1>
        <p className="text-secondary-600 mb-8">
          This feature will be implemented soon. You'll be able to:
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="card text-center">
            <div className="text-4xl mb-4">👤</div>
            <h3 className="text-lg font-semibold mb-2">Profile Management</h3>
            <p className="text-sm text-secondary-600">
              Update your personal information and preferences
            </p>
          </div>
          
          <div className="card text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-semibold mb-2">Skill Management</h3>
            <p className="text-sm text-secondary-600">
              View and update your skill levels
            </p>
          </div>
          
          <div className="card text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-lg font-semibold mb-2">Learning Goals</h3>
            <p className="text-sm text-secondary-600">
              Set and track your learning objectives
            </p>
          </div>
          
          <div className="card text-center">
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-lg font-semibold mb-2">Preferences</h3>
            <p className="text-sm text-secondary-600">
              Customize your learning experience
            </p>
          </div>
        </div>
        
        <div className="mt-8">
          <p className="text-secondary-500">
            Coming soon! This will help you manage your account and preferences.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Profile;
