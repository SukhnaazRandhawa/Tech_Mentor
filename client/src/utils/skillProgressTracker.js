// Skill Progress Tracker
// This utility helps track user progress across different skills and jobs

export const updateSkillProgress = (skillName, sessionData) => {
  try {
    // Call backend to update skill progress
    fetch('/api/job-prep/update-progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        skillName,
        sessionData
      }),
    }).catch(error => {
      console.error('Error updating skill progress on backend:', error);
    });
    
    // Also update localStorage as fallback
    const userProgress = JSON.parse(localStorage.getItem('userSkillProgress') || '{}');
    
    if (!userProgress[skillName]) {
      userProgress[skillName] = {
        currentLevel: 0,
        totalSessions: 0,
        lastSession: null,
        masteryLevel: 0,
        jobsApplied: [],
        sessionHistory: []
      };
    }
    
    // Update skill progress based on tutoring session
    const skill = userProgress[skillName];
    skill.totalSessions += 1;
    skill.lastSession = new Date().toISOString();
    
    // Add session to history
    skill.sessionHistory.push({
      date: new Date().toISOString(),
      topic: sessionData.topic || 'General',
      duration: sessionData.duration || 0,
      concepts: sessionData.concepts || []
    });
    
    // Calculate mastery level based on sessions and concepts
    skill.masteryLevel = Math.min(100, skill.totalSessions * 15); // 15% per session, max 100%
    
    // Update current level (1-10 scale)
    skill.currentLevel = Math.min(10, Math.ceil(skill.masteryLevel / 10));
    
    // Save updated progress
    localStorage.setItem('userSkillProgress', JSON.stringify(userProgress));
    
    // Update all saved learning paths that use this skill
    updateLearningPathProgress(skillName, skill);
    
    return skill;
  } catch (error) {
    console.error('Error updating skill progress:', error);
    return null;
  }
};

export const updateLearningPathProgress = (skillName, skillData) => {
  try {
    const savedPaths = JSON.parse(localStorage.getItem('savedLearningPaths') || '[]');
    
    savedPaths.forEach(path => {
      const skillInPath = path.progress.skills.find(s => s.name === skillName);
      if (skillInPath) {
        // Update skill progress in learning path
        skillInPath.currentLevel = skillData.currentLevel;
        skillInPath.tutoringSessions = skillData.totalSessions;
        skillInPath.progress = skillData.masteryLevel;
        skillInPath.lastUpdated = new Date().toISOString();
        
        // Update status based on progress
        if (skillData.masteryLevel >= 100) {
          skillInPath.status = 'completed';
        } else if (skillData.masteryLevel > 0) {
          skillInPath.status = 'in-progress';
        }
        
        // Calculate overall progress for the learning path
        const totalSkills = path.progress.skills.length;
        const completedSkills = path.progress.skills.filter(s => s.status === 'completed').length;
        const inProgressSkills = path.progress.skills.filter(s => s.status === 'in-progress').length;
        
        path.progress.overallProgress = Math.round(
          ((completedSkills * 100) + (inProgressSkills * 50)) / totalSkills
        );
      }
    });
    
    localStorage.setItem('savedLearningPaths', JSON.stringify(savedPaths));
  } catch (error) {
    console.error('Error updating learning path progress:', error);
  }
};

export const getSkillProgress = (skillName) => {
  try {
    const userProgress = JSON.parse(localStorage.getItem('userSkillProgress') || '{}');
    return userProgress[skillName] || null;
  } catch (error) {
    console.error('Error getting skill progress:', error);
    return null;
  }
};

export const getAllSkillsProgress = () => {
  try {
    const userProgress = JSON.parse(localStorage.getItem('userSkillProgress') || '{}');
    return userProgress;
  } catch (error) {
    console.error('Error getting all skills progress:', error);
    return {};
  }
};

export const getJobRelevantSkills = (jobTitle) => {
  try {
    const savedPaths = JSON.parse(localStorage.getItem('savedLearningPaths') || '[]');
    const jobPath = savedPaths.find(path => path.jobTitle === jobTitle);
    
    if (jobPath) {
      return jobPath.progress.skills.map(skill => ({
        name: skill.name,
        requiredLevel: skill.requiredLevel,
        currentLevel: skill.currentLevel,
        progress: skill.progress,
        status: skill.status
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error getting job relevant skills:', error);
    return [];
  }
};

export const getOverallProgress = () => {
  try {
    const userProgress = JSON.parse(localStorage.getItem('userSkillProgress') || '{}');
    const skills = Object.values(userProgress);
    
    if (skills.length === 0) return 0;
    
    const totalMastery = skills.reduce((sum, skill) => sum + skill.masteryLevel, 0);
    return Math.round(totalMastery / skills.length);
  } catch (error) {
    console.error('Error calculating overall progress:', error);
    return 0;
  }
};

export const getSkillsForDashboard = () => {
  try {
    // Try to get data from backend first
    const userProgress = JSON.parse(localStorage.getItem('userSkillProgress') || '{}');
    const savedPaths = JSON.parse(localStorage.getItem('savedLearningPaths') || '[]');
    
    // Get all unique skills from learning paths
    const allSkills = new Set();
    savedPaths.forEach(path => {
      path.progress.skills.forEach(skill => {
        allSkills.add(skill.name);
      });
    });
    
    // Create dashboard skills data
    const dashboardSkills = Array.from(allSkills).map(skillName => {
      const skill = userProgress[skillName] || { currentLevel: 0, masteryLevel: 0 };
      const jobPaths = savedPaths.filter(path => 
        path.progress.skills.some(s => s.name === skillName)
      );
      
      return {
        name: skillName,
        currentLevel: skill.currentLevel,
        masteryLevel: skill.masteryLevel,
        totalSessions: skill.totalSessions || 0,
        jobsApplied: jobPaths.map(path => path.jobTitle),
        lastSession: skill.lastSession
      };
    });
    
    return dashboardSkills;
  } catch (error) {
    console.error('Error getting skills for dashboard:', error);
    return [];
  }
};
