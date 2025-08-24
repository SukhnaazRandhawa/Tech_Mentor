import axios from 'axios';
import React, { createContext, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Set up axios defaults and interceptors
  useEffect(() => {
    // Set base URL to backend server (bypass proxy if needed)
    axios.defaults.baseURL = 'http://localhost:5001';
    
    // Add request interceptor for debugging
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        console.log('🚀 Axios Request:', config.method?.toUpperCase(), config.url, config.data);
        return config;
      },
      (error) => {
        console.error('❌ Axios Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for debugging
    const responseInterceptor = axios.interceptors.response.use(
      (response) => {
        console.log('✅ Axios Response:', response.status, response.config.url, response.data);
        return response;
      },
      (error) => {
        console.error('❌ Axios Response Error:', error.response?.status, error.config?.url, error.message);
        return Promise.reject(error);
      }
    );

    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }

    // Cleanup interceptors
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setUser(response.data.user);
    } catch (error) {
      console.error('Error fetching user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data;
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      toast.success('Welcome back!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const register = async (userData) => {
    try {
      console.log('Starting registration request...');
      console.log('Request data:', userData);
      
      // Add timeout to prevent hanging requests
      const response = await axios.post('/api/auth/register', userData, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Registration response received:', response.data);
      
      const { token: newToken, user: newUser } = response.data;
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(newUser);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      toast.success('Account created successfully!');
      return { success: true };
    } catch (error) {
      console.error('Registration error details:', error);
      
      let message = 'Registration failed';
      if (error.code === 'ECONNABORTED') {
        message = 'Request timed out. Please try again.';
      } else if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.message) {
        message = error.message;
      }
      
      toast.error(message);
      return { success: false, message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
    toast.success('Logged out successfully');
  };

  const updateProfile = async (updates) => {
    try {
      const response = await axios.put('/api/auth/profile', updates);
      setUser(response.data.user);
      toast.success('Profile updated successfully!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const updateSkillLevel = async (skill, level) => {
    try {
      const response = await axios.put('/api/auth/skills', { skill, level });
      setUser(response.data.user);
      toast.success(`${skill} skill level updated!`);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Skill update failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    updateSkillLevel,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
