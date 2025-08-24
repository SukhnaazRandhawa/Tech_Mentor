import {
    AlertCircle,
    Award,
    BarChart3,
    Brain,
    Calendar,
    CheckCircle,
    Clock,
    Code,
    MessageSquare,
    Target,
    TrendingUp,
    XCircle
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

const EnhancedInterviewFeedback = ({ feedback, onPracticeAgain, onGoToDashboard, jobData, sessionData }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hiringProbability, setHiringProbability] = useState(null);
  const [detailedAnalysis, setDetailedAnalysis] = useState(null);

  // Analyze feedback and generate hiring probability
  useEffect(() => {
    if (feedback) {
      analyzeHiringProbability();
    }
  }, [feedback]);

  const analyzeHiringProbability = async () => {
    setIsAnalyzing(true);
    
    try {
      // Use OpenAI to analyze the feedback and provide realistic hiring probability
      const response = await fetch('/api/mock-interview/analyze-hiring-probability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedback: feedback,
          jobData: jobData,
          scores: feedback.overallScore || 7
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setHiringProbability(data.hiringProbability);
        setDetailedAnalysis(data.detailedAnalysis);
      } else {
        // Fallback analysis
        generateFallbackAnalysis();
      }
    } catch (error) {
      console.error('Error analyzing hiring probability:', error);
      generateFallbackAnalysis();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateFallbackAnalysis = () => {
    const overallScore = feedback.overallScore || 7;
    
    // Calculate hiring probability based on score
    let probability = 0;
    let analysis = {};
    
    if (overallScore >= 9) {
      probability = 85;
      analysis = {
        status: 'Excellent',
        message: 'You have a very high chance of getting hired. Your performance demonstrates exceptional skills.',
        strengths: ['Strong technical foundation', 'Excellent communication', 'Outstanding problem-solving'],
        improvements: ['Continue refining advanced concepts', 'Maintain current performance level'],
        timeline: 'Immediate hiring potential',
        confidence: 'Very High'
      };
    } else if (overallScore >= 7) {
      probability = 65;
      analysis = {
        status: 'Good',
        message: 'You have a good chance of getting hired with some preparation.',
        strengths: ['Solid technical skills', 'Good communication', 'Reasonable problem-solving'],
        improvements: ['Work on advanced topics', 'Improve time management', 'Practice more complex scenarios'],
        timeline: '2-4 weeks of preparation needed',
        confidence: 'High'
      };
    } else if (overallScore >= 5) {
      probability = 40;
      analysis = {
        status: 'Fair',
        message: 'You have potential but need significant improvement before applying.',
        strengths: ['Basic understanding', 'Some communication skills'],
        improvements: ['Strengthen fundamentals', 'Practice extensively', 'Improve communication'],
        timeline: '2-3 months of preparation needed',
        confidence: 'Medium'
      };
    } else {
      probability = 15;
      analysis = {
        status: 'Needs Work',
        message: 'Significant improvement needed before considering job applications.',
        strengths: ['Willingness to learn', 'Basic concepts'],
        improvements: ['Build strong foundation', 'Extensive practice', 'Professional development'],
        timeline: '4-6 months of preparation needed',
        confidence: 'Low'
      };
    }
    
    setHiringProbability(probability);
    setDetailedAnalysis(analysis);
  };

  const getProbabilityColor = (probability) => {
    if (probability >= 80) return 'text-green-600';
    if (probability >= 60) return 'text-blue-600';
    if (probability >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProbabilityBgColor = (probability) => {
    if (probability >= 80) return 'bg-green-100';
    if (probability >= 60) return 'bg-blue-100';
    if (probability >= 40) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Excellent':
        return <Award className="h-6 w-6 text-green-600" />;
      case 'Good':
        return <CheckCircle className="h-6 w-6 text-blue-600" />;
      case 'Fair':
        return <AlertCircle className="h-6 w-6 text-yellow-600" />;
      case 'Needs Work':
        return <XCircle className="h-6 w-6 text-red-600" />;
      default:
        return <Target className="h-6 w-6 text-secondary-600" />;
    }
  };

  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-secondary-900 mb-2">
            Analyzing Your Performance
          </h2>
          <p className="text-secondary-600">
            Calculating hiring probability and generating detailed feedback...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-secondary-900 mb-4">
            Interview Complete! 🎯
          </h1>
          <p className="text-xl text-secondary-600">
            Here's your realistic performance analysis and hiring probability
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Overall Performance */}
          <div className="lg:col-span-1 space-y-6">
            {/* Overall Score */}
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                Overall Performance
              </h3>
              <div className="text-6xl font-bold text-primary-600 mb-2">
                {feedback.overallScore || 7}/10
              </div>
              <p className="text-secondary-600 mb-4">
                {feedback.summary || 'Good job! Keep practicing to improve.'}
              </p>
              
              {/* Performance Status */}
              {detailedAnalysis && (
                <div className="flex items-center justify-center space-x-2 text-sm">
                  {getStatusIcon(detailedAnalysis.status)}
                  <span className="font-medium text-secondary-700">
                    {detailedAnalysis.status}
                  </span>
                </div>
              )}
            </div>

            {/* Hiring Probability */}
            {hiringProbability !== null && (
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                  Hiring Probability
                </h3>
                <div className={`text-5xl font-bold mb-2 ${getProbabilityColor(hiringProbability)}`}>
                  {hiringProbability}%
                </div>
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getProbabilityBgColor(hiringProbability)} ${getProbabilityColor(hiringProbability)}`}>
                  {hiringProbability >= 80 ? 'Very High' : 
                   hiringProbability >= 60 ? 'High' : 
                   hiringProbability >= 40 ? 'Medium' : 'Low'} Chance
                </div>
                
                {detailedAnalysis && (
                  <div className="mt-4 text-sm text-secondary-600">
                    <p className="mb-2">{detailedAnalysis.message}</p>
                    <div className="flex items-center justify-center space-x-2 text-xs">
                      <Clock className="h-4 w-4" />
                      <span>{detailedAnalysis.timeline}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                Interview Summary
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary-600">Questions Answered</span>
                  <span className="text-sm font-medium text-secondary-900">
                    {feedback.categories?.length || 3}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary-600">Duration</span>
                  <span className="text-sm font-medium text-secondary-900">
                    {sessionData?.duration || 'N/A'} min
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary-600">Job Type</span>
                  <span className="text-sm font-medium text-secondary-900">
                    {jobData?.jobTitle || 'Technical Role'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Detailed Analysis */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detailed Feedback */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                Detailed Performance Analysis
              </h3>
              
              {feedback.categories && (
                <div className="space-y-4">
                  {feedback.categories.map((category, index) => (
                    <div key={index} className="border border-secondary-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-secondary-900 flex items-center">
                          {category.name === 'Technical Knowledge' && <Code className="h-4 w-4 mr-2 text-blue-600" />}
                          {category.name === 'Problem Solving' && <Brain className="h-4 w-4 mr-2 text-green-600" />}
                          {category.name === 'Communication' && <MessageSquare className="h-4 w-4 mr-2 text-purple-600" />}
                          {category.name}
                        </h4>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          category.score >= 8 ? 'bg-green-100 text-green-800' :
                          category.score >= 6 ? 'bg-blue-100 text-blue-800' :
                          category.score >= 4 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {category.score}/10
                        </span>
                      </div>
                      
                      <p className="text-sm text-secondary-700 mb-3">
                        {category.feedback}
                      </p>
                      
                      {category.suggestions && (
                        <div>
                          <p className="text-xs font-medium text-secondary-600 mb-2">Improvement Suggestions:</p>
                          <ul className="text-xs text-secondary-600 space-y-1">
                            {category.suggestions.map((suggestion, idx) => (
                              <li key={idx} className="flex items-start">
                                <TrendingUp className="h-3 w-3 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                {suggestion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Plan */}
            {detailedAnalysis && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                  Your Action Plan
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Strengths */}
                  <div>
                    <h4 className="font-medium text-green-700 mb-3 flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Your Strengths
                    </h4>
                    <ul className="space-y-2">
                      {detailedAnalysis.strengths?.map((strength, idx) => (
                        <li key={idx} className="text-sm text-green-600 flex items-start">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 mt-2 flex-shrink-0"></div>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Areas for Improvement */}
                  <div>
                    <h4 className="font-medium text-orange-700 mb-3 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Focus Areas
                    </h4>
                    <ul className="space-y-2">
                      {detailedAnalysis.improvements?.map((improvement, idx) => (
                        <li key={idx} className="text-sm text-orange-600 flex items-start">
                          <div className="w-2 h-2 bg-orange-500 rounded-full mr-2 mt-2 flex-shrink-0"></div>
                          {improvement}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Timeline */}
                <div className="mt-6 p-4 bg-secondary-50 rounded-lg">
                  <h4 className="font-medium text-secondary-900 mb-2 flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Preparation Timeline
                  </h4>
                  <p className="text-sm text-secondary-700">
                    <span className="font-medium">Estimated time to job readiness:</span> {detailedAnalysis.timeline}
                  </p>
                  <p className="text-sm text-secondary-600 mt-1">
                    Confidence level: <span className="font-medium">{detailedAnalysis.confidence}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
          <button
            onClick={onPracticeAgain}
            className="btn-secondary flex items-center justify-center px-8 py-3 text-lg"
          >
            <TrendingUp className="h-5 w-5 mr-2" />
            Practice Again
          </button>
          
          <button
            onClick={onGoToDashboard}
            className="btn-primary flex items-center justify-center px-8 py-3 text-lg"
          >
            <BarChart3 className="h-5 w-5 mr-2" />
            Save & Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedInterviewFeedback;
