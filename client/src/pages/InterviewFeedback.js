import { ChevronLeft, Download, Mail, Star, Target, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const InterviewFeedback = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadFeedback = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/mock-interview/feedback/${interviewId}`);
        
        if (response.ok) {
          const data = await response.json();
          setFeedback(data.feedback);
        } else if (response.status === 404) {
          setError('Feedback not found');
        } else {
          setError('Failed to load feedback');
        }
      } catch (error) {
        console.error('Error loading feedback:', error);
        setError('Failed to load feedback');
      } finally {
        setLoading(false);
      }
    };

    if (interviewId) {
      loadFeedback();
    }
  }, [interviewId]);

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    if (score >= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score) => {
    if (score >= 8) return 'bg-green-100';
    if (score >= 6) return 'bg-yellow-100';
    if (score >= 4) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const getPerformanceMessage = (score) => {
    if (score >= 8) return 'Excellent performance! You demonstrated strong technical skills and communication.';
    if (score >= 6) return 'Good job! You showed solid understanding with room for improvement.';
    if (score >= 4) return 'Keep practicing! Focus on the areas mentioned below to improve.';
    return 'More practice needed. Review the feedback and work on the suggested improvements.';
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-secondary-600">Loading feedback...</p>
        </div>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <Target className="h-16 w-16 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-secondary-900 mb-2">Feedback Not Found</h2>
            <p className="text-secondary-600 mb-6">{error || 'The requested feedback could not be found.'}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-secondary-600 hover:text-secondary-900 mb-6 transition-colors"
        >
          <ChevronLeft className="h-5 w-5 mr-2" />
          Back to Dashboard
        </button>
        
        <div className="text-center">
          <h1 className="text-3xl font-bold text-secondary-900 mb-2">
            Interview Feedback
          </h1>
          <p className="text-secondary-600">
            {feedback.jobTitle} at {feedback.company} • {feedback.duration} minutes
          </p>
          <p className="text-sm text-secondary-500 mt-1">
            Completed on {new Date(feedback.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>

      {/* Overall Score */}
      <div className="card text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <Star className="h-8 w-8 text-yellow-500 mr-2" />
          <h2 className="text-2xl font-semibold text-secondary-900">Overall Performance</h2>
        </div>
        
        <div className={`text-8xl font-bold mb-4 ${getScoreColor(feedback.overallScore)}`}>
          {feedback.overallScore}/10
        </div>
        
        <div className={`inline-block px-6 py-3 rounded-full ${getScoreBgColor(feedback.overallScore)}`}>
          <p className={`font-medium ${getScoreColor(feedback.overallScore)}`}>
            {getPerformanceMessage(feedback.overallScore)}
          </p>
        </div>
      </div>

      {/* Summary */}
      {feedback.summary && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-secondary-900 mb-4 flex items-center">
            <TrendingUp className="h-6 w-6 text-primary-600 mr-2" />
            Summary
          </h2>
          <p className="text-secondary-700 leading-relaxed">{feedback.summary}</p>
        </div>
      )}

      {/* Detailed Feedback Categories */}
      {feedback.categories && feedback.categories.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-secondary-900 mb-6">Detailed Feedback</h2>
          <div className="space-y-6">
            {feedback.categories.map((category, idx) => (
              <div key={idx} className="border-b border-secondary-200 pb-6 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-secondary-900">
                    {category.name}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getScoreBgColor(category.score)} ${getScoreColor(category.score)}`}>
                      {category.score}/10
                    </span>
                  </div>
                </div>
                
                <p className="text-secondary-700 mb-4 leading-relaxed">
                  {category.feedback}
                </p>
                
                {category.suggestions && category.suggestions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-secondary-900 mb-2">Suggestions for Improvement:</h4>
                    <ul className="space-y-2">
                      {category.suggestions.map((suggestion, sIdx) => (
                        <li key={sIdx} className="flex items-start">
                          <span className="text-primary-600 mr-3 mt-1">•</span>
                          <span className="text-secondary-700">{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {feedback.strengths && feedback.strengths.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-secondary-900 mb-4 text-green-600">Strengths</h2>
          <ul className="space-y-2">
            {feedback.strengths.map((strength, idx) => (
              <li key={idx} className="flex items-start">
                <span className="text-green-600 mr-3 mt-1">✓</span>
                <span className="text-secondary-700">{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Areas for Improvement */}
      {feedback.improvements && feedback.improvements.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-secondary-900 mb-4 text-orange-600">Areas for Improvement</h2>
          <ul className="space-y-2">
            {feedback.improvements.map((improvement, idx) => (
              <li key={idx} className="flex items-start">
                <span className="text-orange-600 mr-3 mt-1">•</span>
                <span className="text-secondary-700">{improvement}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Plan */}
      {feedback.actionPlan && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-secondary-900 mb-4 flex items-center">
            <Target className="h-6 w-6 text-primary-600 mr-2" />
            Action Plan
          </h2>
          <p className="text-secondary-700 leading-relaxed">{feedback.actionPlan}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={() => navigate('/mock-interview')}
          className="btn-primary flex items-center justify-center"
        >
          <Target className="h-5 w-5 mr-2" />
          Practice Again
        </button>
        
        <button
          onClick={() => {
            // Copy feedback to clipboard
            const feedbackText = `Interview Feedback - ${feedback.jobTitle} at ${feedback.company}
Overall Score: ${feedback.overallScore}/10

${feedback.summary || ''}

${feedback.categories?.map(cat => `${cat.name}: ${cat.score}/10 - ${cat.feedback}`).join('\n\n') || ''}

${feedback.actionPlan || ''}`;
            
            navigator.clipboard.writeText(feedbackText).then(() => {
              alert('Feedback copied to clipboard!');
            });
          }}
          className="btn-secondary flex items-center justify-center"
        >
          <Download className="h-5 w-5 mr-2" />
          Copy Feedback
        </button>
        
        <button
          onClick={() => {
            // Email feedback (simulated)
            const subject = `Interview Feedback - ${feedback.jobTitle}`;
            const body = `Hi,\n\nPlease find my interview feedback attached.\n\nBest regards`;
            window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
          }}
          className="btn-secondary flex items-center justify-center"
        >
          <Mail className="h-5 w-5 mr-2" />
          Email Feedback
        </button>
      </div>
    </div>
  );
};

export default InterviewFeedback;
