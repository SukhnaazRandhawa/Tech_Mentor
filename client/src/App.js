import React from 'react';
import { Toaster } from 'react-hot-toast';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import PrivateRoute from './components/auth/PrivateRoute';
import Navbar from './components/layout/Navbar';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Dashboard from './pages/Dashboard';
import JobPreparation from './pages/JobPreparation';
import Login from './pages/Login';
import MockInterview from './pages/MockInterview';
import Profile from './pages/Profile';
import Register from './pages/Register';
import TutoringSession from './pages/TutoringSession';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <div className="min-h-screen bg-secondary-50">
            <Navbar />
            <main className="pt-16">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/" element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                } />
                <Route path="/tutoring" element={
                  <PrivateRoute>
                    <TutoringSession />
                  </PrivateRoute>
                } />
                <Route path="/tutoring/:sessionId" element={
                  <PrivateRoute>
                    <TutoringSession />
                  </PrivateRoute>
                } />
                <Route path="/job-prep" element={
                  <PrivateRoute>
                    <JobPreparation />
                  </PrivateRoute>
                } />
                <Route path="/mock-interview" element={
                  <PrivateRoute>
                    <MockInterview />
                  </PrivateRoute>
                } />
                <Route path="/profile" element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                } />
              </Routes>
            </main>
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#22c55e',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </div>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
