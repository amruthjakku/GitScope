/**
 * GitLab Analytics Engine
 * 
 * Provides comprehensive analytics and insights for GitLab data
 * Including commit analysis, contribution patterns, and performance metrics
 */

import { GitLabError, ERROR_CODES } from '../errors/GitLabErrors.js';
import { formatGitLabDate, timeAgo, formatFileSize } from '../utils/helpers.js';

export class GitLabAnalytics {
  constructor(apiClient, options = {}) {
    this.api = apiClient;
    this.cache = options.cache || null;
    this.options = {
      defaultDays: 90,
      maxCommitsAnalysis: 1000,
      enableDetailedStats: true,
      ...options
    };
  }

  /**
   * Get comprehensive user commit activity analysis
   */
  async getUserCommitActivity(options = {}) {
    try {
      const {
        days = this.options.defaultDays,
        includeStats = true,
        includeHeatmap = true,
        includeLanguages = true,
        projectIds = null
      } = options;

      // Get user projects
      const projects = projectIds 
        ? await this._getProjectsByIds(projectIds)
        : await this.api.getUserProjects({ per_page: 100 });

      if (!projects || projects.length === 0) {
        return this._createEmptyActivity();
      }

      // Get current user info
      const currentUser = await this.api.getCurrentUser();
      
      // Calculate date range
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      // Fetch commits from all projects
      const commitActivity = await this._fetchCommitsFromProjects(
        projects, 
        currentUser, 
        since
      );

      // Generate analytics
      const analytics = {
        user: currentUser,
        projects: projects,
        commits: commitActivity.commits,
        totalCommits: commitActivity.commits.length,
        activeProjects: commitActivity.activeProjects,
        dateRange: {
          since,
          until: new Date().toISOString(),
          days
        },
        errors: commitActivity.errors
      };

      if (includeStats) {
        analytics.statistics = this.generateCommitStatistics(commitActivity.commits);
      }

      if (includeHeatmap) {
        analytics.heatmap = this.generateCommitHeatmap(commitActivity.commits, days);
      }

      if (includeLanguages) {
        analytics.languages = await this._analyzeProjectLanguages(projects);
      }

      return analytics;
    } catch (error) {
      throw new GitLabError(
        `Failed to analyze user commit activity: ${error.message}`,
        ERROR_CODES.API_ERROR,
        error
      );
    }
  }

  /**
   * Generate detailed commit statistics
   */
  generateCommitStatistics(commits) {
    if (!commits || commits.length === 0) {
      return this._createEmptyStats();
    }

    const stats = {
      total: commits.length,
      byDay: {},
      byWeek: {},
      byMonth: {},
      byHour: {},
      byDayOfWeek: {},
      streak: {
        current: 0,
        longest: 0
      },
      averages: {
        commitsPerDay: 0,
        commitsPerWeek: 0,
        commitsPerMonth: 0
      },
      patterns: {
        mostActiveDay: null,
        mostActiveHour: null,
        mostActiveProject: null
      },
      recent: commits.slice(0, 10),
      projectStats: {}
    };

    // Process each commit
    commits.forEach(commit => {
      const date = new Date(commit.created_at);
      const dayKey = date.toISOString().split('T')[0];
      const weekKey = this._getWeekKey(date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const hour = date.getHours();
      const dayOfWeek = date.getDay();

      // Count by time periods
      stats.byDay[dayKey] = (stats.byDay[dayKey] || 0) + 1;
      stats.byWeek[weekKey] = (stats.byWeek[weekKey] || 0) + 1;
      stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
      stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
      stats.byDayOfWeek[dayOfWeek] = (stats.byDayOfWeek[dayOfWeek] || 0) + 1;

      // Project statistics
      if (commit.project) {
        const projectId = commit.project.id;
        if (!stats.projectStats[projectId]) {
          stats.projectStats[projectId] = {
            name: commit.project.name,
            path: commit.project.path,
            commits: 0,
            firstCommit: commit.created_at,
            lastCommit: commit.created_at
          };
        }
        stats.projectStats[projectId].commits++;
        
        // Update first/last commit dates
        if (new Date(commit.created_at) < new Date(stats.projectStats[projectId].firstCommit)) {
          stats.projectStats[projectId].firstCommit = commit.created_at;
        }
        if (new Date(commit.created_at) > new Date(stats.projectStats[projectId].lastCommit)) {
          stats.projectStats[projectId].lastCommit = commit.created_at;
        }
      }
    });

    // Calculate streaks
    stats.streak = this._calculateCommitStreaks(stats.byDay);

    // Calculate averages
    const totalDays = Object.keys(stats.byDay).length;
    const totalWeeks = Object.keys(stats.byWeek).length;
    const totalMonths = Object.keys(stats.byMonth).length;

    stats.averages.commitsPerDay = totalDays > 0 ? (stats.total / totalDays).toFixed(2) : 0;
    stats.averages.commitsPerWeek = totalWeeks > 0 ? (stats.total / totalWeeks).toFixed(2) : 0;
    stats.averages.commitsPerMonth = totalMonths > 0 ? (stats.total / totalMonths).toFixed(2) : 0;

    // Find patterns
    stats.patterns = this._findCommitPatterns(stats);

    return stats;
  }

  /**
   * Generate commit heatmap data
   */
  generateCommitHeatmap(commits, days = 90) {
    const heatmap = [];
    const commitsByDay = {};

    // Count commits by day
    commits.forEach(commit => {
      const dayKey = new Date(commit.created_at).toISOString().split('T')[0];
      commitsByDay[dayKey] = (commitsByDay[dayKey] || 0) + 1;
    });

    // Generate heatmap for the specified number of days
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayKey = date.toISOString().split('T')[0];
      const count = commitsByDay[dayKey] || 0;

      heatmap.push({
        date: dayKey,
        count,
        level: this._getHeatmapLevel(count),
        dayOfWeek: date.getDay(),
        weekOfYear: this._getWeekNumber(date),
        month: date.getMonth(),
        day: date.getDate()
      });
    }

    return {
      data: heatmap,
      summary: {
        totalDays: days,
        activeDays: heatmap.filter(d => d.count > 0).length,
        maxCommitsInDay: Math.max(...heatmap.map(d => d.count)),
        averageCommitsPerDay: (heatmap.reduce((sum, d) => sum + d.count, 0) / days).toFixed(2)
      }
    };
  }

  /**
   * Analyze project languages and technologies
   */
  async _analyzeProjectLanguages(projects) {
    const languageStats = {};
    const errors = [];

    for (const project of projects.slice(0, 50)) { // Limit to avoid rate limits
      try {
        const languages = await this.api.getProjectLanguages(project.id);
        
        if (languages && typeof languages === 'object') {
          Object.entries(languages).forEach(([language, percentage]) => {
            if (!languageStats[language]) {
              languageStats[language] = {
                totalPercentage: 0,
                projectCount: 0,
                projects: []
              };
            }
            
            languageStats[language].totalPercentage += percentage;
            languageStats[language].projectCount++;
            languageStats[language].projects.push({
              id: project.id,
              name: project.name,
              percentage
            });
          });
        }
      } catch (error) {
        errors.push({
          projectId: project.id,
          projectName: project.name,
          error: error.message
        });
      }
    }

    // Calculate averages and sort
    const sortedLanguages = Object.entries(languageStats)
      .map(([language, stats]) => ({
        language,
        averagePercentage: (stats.totalPercentage / stats.projectCount).toFixed(2),
        projectCount: stats.projectCount,
        totalPercentage: stats.totalPercentage.toFixed(2),
        projects: stats.projects.sort((a, b) => b.percentage - a.percentage)
      }))
      .sort((a, b) => b.totalPercentage - a.totalPercentage);

    return {
      languages: sortedLanguages,
      summary: {
        totalLanguages: sortedLanguages.length,
        primaryLanguage: sortedLanguages[0]?.language || null,
        diversityScore: this._calculateLanguageDiversity(sortedLanguages)
      },
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Generate project activity insights
   */
  async getProjectInsights(projectId, options = {}) {
    try {
      const {
        days = 30,
        includeCommits = true,
        includeIssues = true,
        includeMergeRequests = true,
        includeContributors = true
      } = options;

      const project = await this.api.getProject(projectId);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const insights = {
        project: {
          id: project.id,
          name: project.name,
          path: project.path_with_namespace,
          description: project.description,
          visibility: project.visibility,
          created_at: project.created_at,
          last_activity_at: project.last_activity_at
        },
        period: {
          since,
          until: new Date().toISOString(),
          days
        }
      };

      // Fetch data in parallel
      const promises = [];

      if (includeCommits) {
        promises.push(
          this.api.getProjectCommits(projectId, { since, per_page: 100 })
            .then(commits => ({ type: 'commits', data: commits }))
            .catch(error => ({ type: 'commits', error: error.message }))
        );
      }

      if (includeIssues) {
        promises.push(
          this.api.getProjectIssues(projectId, { per_page: 100 })
            .then(issues => ({ type: 'issues', data: issues }))
            .catch(error => ({ type: 'issues', error: error.message }))
        );
      }

      if (includeMergeRequests) {
        promises.push(
          this.api.getProjectMergeRequests(projectId, { per_page: 100 })
            .then(mrs => ({ type: 'mergeRequests', data: mrs }))
            .catch(error => ({ type: 'mergeRequests', error: error.message }))
        );
      }

      if (includeContributors) {
        promises.push(
          this.api.getProjectMembers(projectId)
            .then(members => ({ type: 'contributors', data: members }))
            .catch(error => ({ type: 'contributors', error: error.message }))
        );
      }

      const results = await Promise.all(promises);

      // Process results
      results.forEach(result => {
        if (result.error) {
          if (!insights.errors) insights.errors = [];
          insights.errors.push({ type: result.type, error: result.error });
        } else {
          insights[result.type] = result.data;
        }
      });

      // Generate analytics for each data type
      if (insights.commits) {
        insights.commitAnalytics = this._analyzeProjectCommits(insights.commits);
      }

      if (insights.issues) {
        insights.issueAnalytics = this._analyzeProjectIssues(insights.issues);
      }

      if (insights.mergeRequests) {
        insights.mergeRequestAnalytics = this._analyzeProjectMergeRequests(insights.mergeRequests);
      }

      if (insights.contributors) {
        insights.contributorAnalytics = this._analyzeProjectContributors(insights.contributors);
      }

      return insights;
    } catch (error) {
      throw new GitLabError(
        `Failed to generate project insights: ${error.message}`,
        ERROR_CODES.API_ERROR,
        error
      );
    }
  }

  /**
   * Compare multiple projects
   */
  async compareProjects(projectIds, options = {}) {
    try {
      const { days = 30 } = options;
      const comparisons = [];

      for (const projectId of projectIds) {
        try {
          const insights = await this.getProjectInsights(projectId, { days });
          comparisons.push(insights);
        } catch (error) {
          comparisons.push({
            projectId,
            error: error.message
          });
        }
      }

      return {
        projects: comparisons,
        comparison: this._generateProjectComparison(comparisons),
        period: {
          days,
          since: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          until: new Date().toISOString()
        }
      };
    } catch (error) {
      throw new GitLabError(
        `Failed to compare projects: ${error.message}`,
        ERROR_CODES.API_ERROR,
        error
      );
    }
  }

  // Private helper methods

  async _getProjectsByIds(projectIds) {
    const projects = [];
    for (const id of projectIds) {
      try {
        const project = await this.api.getProject(id);
        projects.push(project);
      } catch (error) {
        console.warn(`Failed to fetch project ${id}:`, error.message);
      }
    }
    return projects;
  }

  async _fetchCommitsFromProjects(projects, currentUser, since) {
    const commitActivity = [];
    const errors = [];
    const activeProjectIds = new Set();

    for (const project of projects) {
      try {
        const commits = await this.api.getProjectCommits(project.id, {
          since,
          author: currentUser.email || currentUser.username,
          per_page: 100
        });

        if (commits && commits.length > 0) {
          const projectCommits = commits.map(commit => ({
            ...commit,
            project: {
              id: project.id,
              name: project.name,
              path: project.path_with_namespace,
              url: project.web_url
            }
          }));

          commitActivity.push(...projectCommits);
          activeProjectIds.add(project.id);
        }
      } catch (error) {
        errors.push({
          projectId: project.id,
          projectName: project.name,
          error: error.message
        });
      }
    }

    // Sort by date (newest first)
    commitActivity.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return {
      commits: commitActivity,
      activeProjects: activeProjectIds.size,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  _createEmptyActivity() {
    return {
      user: null,
      projects: [],
      commits: [],
      totalCommits: 0,
      activeProjects: 0,
      statistics: this._createEmptyStats(),
      heatmap: { data: [], summary: {} },
      languages: { languages: [], summary: {} }
    };
  }

  _createEmptyStats() {
    return {
      total: 0,
      byDay: {},
      byWeek: {},
      byMonth: {},
      byHour: {},
      byDayOfWeek: {},
      streak: { current: 0, longest: 0 },
      averages: { commitsPerDay: 0, commitsPerWeek: 0, commitsPerMonth: 0 },
      patterns: { mostActiveDay: null, mostActiveHour: null, mostActiveProject: null },
      recent: [],
      projectStats: {}
    };
  }

  _getWeekKey(date) {
    const year = date.getFullYear();
    const week = this._getWeekNumber(date);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  _getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  _calculateCommitStreaks(commitsByDay) {
    const dates = Object.keys(commitsByDay).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate = null;

    // Calculate longest streak
    dates.forEach(dateStr => {
      const date = new Date(dateStr);
      
      if (lastDate) {
        const dayDiff = (date - lastDate) / (1000 * 60 * 60 * 24);
        if (dayDiff === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      
      lastDate = date;
    });
    longestStreak = Math.max(longestStreak, tempStreak);

    // Calculate current streak (from today backwards)
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayKey = date.toISOString().split('T')[0];
      
      if (commitsByDay[dayKey]) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
    }

    return { current: currentStreak, longest: longestStreak };
  }

  _findCommitPatterns(stats) {
    // Most active day of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const mostActiveDayNum = Object.entries(stats.byDayOfWeek)
      .reduce((max, [day, count]) => count > (stats.byDayOfWeek[max] || 0) ? day : max, 0);
    
    // Most active hour
    const mostActiveHour = Object.entries(stats.byHour)
      .reduce((max, [hour, count]) => count > (stats.byHour[max] || 0) ? hour : max, 0);

    // Most active project
    const mostActiveProject = Object.values(stats.projectStats)
      .reduce((max, project) => project.commits > (max?.commits || 0) ? project : max, null);

    return {
      mostActiveDay: dayNames[mostActiveDayNum],
      mostActiveHour: `${mostActiveHour}:00`,
      mostActiveProject: mostActiveProject?.name || null
    };
  }

  _getHeatmapLevel(count) {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 10) return 3;
    return 4;
  }

  _calculateLanguageDiversity(languages) {
    if (languages.length <= 1) return 0;
    
    const totalPercentage = languages.reduce((sum, lang) => sum + parseFloat(lang.totalPercentage), 0);
    const entropy = languages.reduce((sum, lang) => {
      const p = parseFloat(lang.totalPercentage) / totalPercentage;
      return sum - (p * Math.log2(p));
    }, 0);
    
    return (entropy / Math.log2(languages.length)).toFixed(2);
  }

  _analyzeProjectCommits(commits) {
    return {
      total: commits.length,
      authors: [...new Set(commits.map(c => c.author_name))].length,
      averagePerDay: (commits.length / 30).toFixed(2),
      recentActivity: commits.slice(0, 5)
    };
  }

  _analyzeProjectIssues(issues) {
    const openIssues = issues.filter(i => i.state === 'opened');
    const closedIssues = issues.filter(i => i.state === 'closed');
    
    return {
      total: issues.length,
      open: openIssues.length,
      closed: closedIssues.length,
      openRate: ((openIssues.length / issues.length) * 100).toFixed(1)
    };
  }

  _analyzeProjectMergeRequests(mergeRequests) {
    const openMRs = mergeRequests.filter(mr => mr.state === 'opened');
    const mergedMRs = mergeRequests.filter(mr => mr.state === 'merged');
    
    return {
      total: mergeRequests.length,
      open: openMRs.length,
      merged: mergedMRs.length,
      mergeRate: ((mergedMRs.length / mergeRequests.length) * 100).toFixed(1)
    };
  }

  _analyzeProjectContributors(contributors) {
    return {
      total: contributors.length,
      roles: contributors.reduce((acc, c) => {
        acc[c.access_level] = (acc[c.access_level] || 0) + 1;
        return acc;
      }, {})
    };
  }

  _generateProjectComparison(projects) {
    const validProjects = projects.filter(p => !p.error);
    
    if (validProjects.length === 0) {
      return { error: 'No valid projects to compare' };
    }

    return {
      totalProjects: validProjects.length,
      mostActiveProject: validProjects.reduce((max, p) => 
        (p.commitAnalytics?.total || 0) > (max.commitAnalytics?.total || 0) ? p : max
      ),
      totalCommits: validProjects.reduce((sum, p) => sum + (p.commitAnalytics?.total || 0), 0),
      totalIssues: validProjects.reduce((sum, p) => sum + (p.issueAnalytics?.total || 0), 0),
      totalMergeRequests: validProjects.reduce((sum, p) => sum + (p.mergeRequestAnalytics?.total || 0), 0)
    };
  }
}