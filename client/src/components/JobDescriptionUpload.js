import { AlertCircle, CheckCircle, FileText, Upload, X } from 'lucide-react';
import React, { useState } from 'react';

const JobDescriptionUpload = ({ onJobAnalyzed, onCancel }) => {
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!jobDescription.trim() || !jobTitle.trim()) {
      setError('Please provide both job title and job description');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      const response = await fetch('/api/mock-interview/analyze-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle,
          company,
          jobDescription
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysisResult(data);
        onJobAnalyzed({
          jobTitle,
          company,
          jobDescription,
          analysis: data
        });
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to analyze job description');
      }
    } catch (error) {
      console.error('Error analyzing job:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file type
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        // Handle text files
        const reader = new FileReader();
        reader.onload = (e) => {
          setJobDescription(e.target.result);
        };
        reader.readAsText(file);
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // For PDFs, show a message to copy-paste content
        setError('PDF files cannot be read directly. Please copy and paste the job description text instead.');
        setJobDescription('');
      } else if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
        // For Word documents, show a message to copy-paste content
        setError('Word documents cannot be read directly. Please copy and paste the job description text instead.');
        setJobDescription('');
      } else {
        // For other file types
        setError('Unsupported file type. Please use .txt files or copy-paste the content.');
        setJobDescription('');
      }
    }
  };

  const resetForm = () => {
    setJobDescription('');
    setJobTitle('');
    setCompany('');
    setAnalysisResult(null);
    setError('');
  };

  if (analysisResult) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-secondary-900">
            Job Analysis Complete! 🎯
          </h2>
          <button
            onClick={resetForm}
            className="text-secondary-500 hover:text-secondary-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Job Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-secondary-900">Job Details</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-secondary-600">Title:</span>
                <p className="text-secondary-900">{jobTitle}</p>
              </div>
              {company && (
                <div>
                  <span className="text-sm font-medium text-secondary-600">Company:</span>
                  <p className="text-secondary-900">{company}</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Analysis */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-secondary-900">AI Analysis</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-secondary-600">Experience Level:</span>
                <p className="text-secondary-900 capitalize">{analysisResult.jobAnalysis.experienceLevel}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-secondary-600">Required Skills:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {analysisResult.jobAnalysis.requiredSkills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Responsibilities */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-3">Key Responsibilities</h3>
          <ul className="space-y-2">
            {analysisResult.jobAnalysis.keyResponsibilities.map((responsibility, index) => (
              <li key={index} className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-secondary-700">{responsibility}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Company Culture */}
        {analysisResult.jobAnalysis.companyCulture && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-3">Company Culture</h3>
            <p className="text-secondary-700">{analysisResult.jobAnalysis.companyCulture}</p>
          </div>
        )}

        {/* Interview Questions Preview */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-3">
            Generated Interview Questions ({analysisResult.interviewQuestions.length})
          </h3>
          <div className="space-y-3">
            {analysisResult.interviewQuestions.slice(0, 3).map((question, index) => (
              <div key={index} className="bg-secondary-50 rounded-lg p-4">
                <h4 className="font-medium text-secondary-900 mb-2">
                  {question.title}
                </h4>
                <p className="text-sm text-secondary-700 mb-2">
                  {question.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-secondary-500">
                  <span>Type: {question.type}</span>
                  <span>Difficulty: {question.difficulty}</span>
                </div>
              </div>
            ))}
            {analysisResult.interviewQuestions.length > 3 && (
              <p className="text-sm text-secondary-500 text-center">
                +{analysisResult.interviewQuestions.length - 3} more questions will be used in the interview
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={resetForm}
            className="btn-secondary"
          >
            Analyze Different Job
          </button>
          <button
            onClick={() => onJobAnalyzed({
              jobTitle,
              company,
              jobDescription,
              analysis: analysisResult
            })}
            className="btn-primary"
          >
            Start Interview with This Job
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <div className="flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full">
            <FileText className="h-8 w-8 text-primary-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-secondary-900 mb-2">
          Job-Specific Interview Setup
        </h2>
        <p className="text-secondary-600">
          Upload or paste a job description to get AI-generated, tailored interview questions
        </p>
      </div>

      <div className="space-y-6">
        {/* Job Title and Company */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="jobTitle" className="block text-sm font-medium text-secondary-700 mb-2">
              Job Title *
            </label>
            <input
              id="jobTitle"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="input-field"
              placeholder="e.g., Senior Software Engineer"
              required
            />
          </div>
          <div>
            <label htmlFor="company" className="block text-sm font-medium text-secondary-700 mb-2">
              Company (Optional)
            </label>
            <input
              id="company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="input-field"
              placeholder="e.g., Google, Microsoft"
            />
          </div>
        </div>

        {/* Job Description */}
        <div>
          <label htmlFor="jobDescription" className="block text-sm font-medium text-secondary-700 mb-2">
            Job Description *
          </label>
          
          {/* File Upload */}
          <div className="mb-3">
            <label htmlFor="fileUpload" className="cursor-pointer">
              <div className="border-2 border-dashed border-secondary-300 rounded-lg p-4 text-center hover:border-primary-400 transition-colors">
                <Upload className="h-8 w-8 text-secondary-400 mx-auto mb-2" />
                <p className="text-sm text-secondary-600">
                  <span className="text-primary-600 font-medium">Click to upload</span> a job description file
                </p>
                <p className="text-xs text-secondary-500 mt-1">
                  Best with .txt files • For PDF/DOC, copy-paste the content
                </p>
              </div>
            </label>
            <input
              id="fileUpload"
              type="file"
              accept=".txt,.doc,.docx,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Text Input */}
          <textarea
            id="jobDescription"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="input-field min-h-32 resize-none"
            placeholder="Paste the job description here, or upload a file above. Include details about:
• Required skills and technologies
• Experience level and qualifications
• Key responsibilities and challenges
• Company culture and values"
            required
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !jobDescription.trim() || !jobTitle.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Analyzing Job...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Analyze Job Description
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobDescriptionUpload;
