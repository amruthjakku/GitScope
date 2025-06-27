/**
 * GitLab Wrapper - Core Class
 * 
 * Main wrapper class that orchestrates all GitLab operations
 * Provides a unified interface for GitLab integration
 */

import { GitLabOAuth } from '../auth/GitLabOAuth.js';
import { GitLabAPI } from '../api/GitLabAPI.js';
import { GitLabAnalytics } from '../analytics/GitLabAnalytics.js';
import { GitLabWebhooks } from '../webhooks/GitLabWebhooks.js';
import { GitLabCache } from '../cache/GitLabCache.js';
import { GitLabRateLimit } from '../utils/GitLabRateLimit.js';
import { GitLabError } from '../errors/GitLabErrors.js';
import { DEFAULT_CONFIG, ERROR_CODES } from '../config/constants.js';
import { validateConfig, mergeConfig } from '../utils/helpers.js';

export class GitLabWrapper {
  constructor(config = {}) {
    // Validate and merge configuration
    this.config = this._initializeConfig(config);
    
    // Initialize components
    this.oauth = new GitLabOAuth(this.config);
    this.cache = this.config.enableCache ? new GitLabCache(this.config.cache) : null;
    this.rateLimit = this.config.enableRateLimit ? new GitLabRateLimit(this.config.rateLimit) : null;
    this.webhooks = this.config.enableWebhooks ? new GitLabWebhooks(this.config.webhooks) : null;
    
    // API and Analytics will be initialized when tokens are available
    this.api = null;
    this.analytics = null;
    
    // Internal state
    this.isInitialized = false;
    this.currentUser = null;
    this.accessToken = null;
    
    // Event handlers
    this.eventHandlers = new Map();
    
    this._setupEventHandlers();
  }

  /**
   * Initialize configuration with validation
   */
  _initializeConfig(userConfig) {
    try {
      validateConfig(userConfig);
      return mergeConfig(DEFAULT_CONFIG, userConfig);
    } catch (error) {
      throw new GitLabError(
        `Invalid configuration: ${error.message}`,
        ERROR_CODES.INVALID_CONFIG
      );
    }
  }

  /**
   * Setup internal event handlers
   */
  _setupEventHandlers() {
    // Handle token refresh events
    this.oauth.on('tokenRefreshed', (tokenData) => {
      this.accessToken = tokenData.access_token;
      this._reinitializeAPI();
      this.emit('tokenRefreshed', tokenData);
    });

    // Handle authentication errors
    this.oauth.on('authError', (error) => {
      this.emit('authError', error);
    });

    // Handle rate limit events
    if (this.rateLimit) {
      this.rateLimit.on('rateLimitExceeded', (info) => {
        this.emit('rateLimitExceeded', info);
      });
    }
  }

  /**
   * Initialize the wrapper with an access token
   */
  async initialize(accessToken, userId = null) {
    try {
      this.accessToken = accessToken;
      
      // Initialize API client
      this.api = new GitLabAPI(accessToken, {
        gitlabUrl: this.config.gitlabUrl,
        apiVersion: this.config.apiVersion,
        timeout: this.config.timeout,
        cache: this.cache,
        rateLimit: this.rateLimit
      });

      // Initialize analytics
      this.analytics = new GitLabAnalytics(this.api, {
        cache: this.cache
      });

      // Get current user info
      this.currentUser = await this.api.getCurrentUser();
      
      // Store user ID if provided
      if (userId) {
        this.userId = userId;
      }

      this.isInitialized = true;
      this.emit('initialized', { user: this.currentUser });

      return {
        success: true,
        user: this.currentUser
      };
    } catch (error) {
      throw new GitLabError(
        `Failed to initialize GitLab wrapper: ${error.message}`,
        ERROR_CODES.API_ERROR,
        error
      );
    }
  }

  /**
   * Reinitialize API components after token refresh
   */
  _reinitializeAPI() {
    if (this.accessToken) {
      this.api = new GitLabAPI(this.accessToken, {
        gitlabUrl: this.config.gitlabUrl,
        apiVersion: this.config.apiVersion,
        timeout: this.config.timeout,
        cache: this.cache,
        rateLimit: this.rateLimit
      });

      this.analytics = new GitLabAnalytics(this.api, {
        cache: this.cache
      });
    }
  }

  /**
   * Start OAuth authentication flow
   */
  startOAuthFlow(state = null) {
    return this.oauth.getAuthorizationUrl(state);
  }

  /**
   * Complete OAuth authentication flow
   */
  async completeOAuthFlow(code, state = null) {
    try {
      const tokenData = await this.oauth.exchangeCodeForToken(code, state);
      await this.initialize(tokenData.access_token);
      
      return {
        success: true,
        tokenData,
        user: this.currentUser
      };
    } catch (error) {
      throw new GitLabError(
        `OAuth flow completion failed: ${error.message}`,
        ERROR_CODES.INVALID_TOKEN,
        error
      );
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      const tokenData = await this.oauth.refreshAccessToken(refreshToken);
      await this.initialize(tokenData.access_token);
      
      return {
        success: true,
        tokenData,
        user: this.currentUser
      };
    } catch (error) {
      throw new GitLabError(
        `Token refresh failed: ${error.message}`,
        ERROR_CODES.TOKEN_EXPIRED,
        error
      );
    }
  }

  /**
   * Get user's repositories
   */
  async getRepositories(options = {}) {
    this._ensureInitialized();
    return await this.api.getUserProjects(options);
  }

  /**
   * Get repository details
   */
  async getRepository(projectId) {
    this._ensureInitialized();
    return await this.api.getProject(projectId);
  }

  /**
   * Get commits for a repository
   */
  async getCommits(projectId, options = {}) {
    this._ensureInitialized();
    return await this.api.getProjectCommits(projectId, options);
  }

  /**
   * Get user's commit activity across all repositories
   */
  async getCommitActivity(options = {}) {
    this._ensureInitialized();
    return await this.analytics.getUserCommitActivity(options);
  }

  /**
   * Get commit analytics and insights
   */
  async getCommitAnalytics(options = {}) {
    this._ensureInitialized();
    return await this.analytics.generateCommitAnalytics(options);
  }

  /**
   * Get user's issues
   */
  async getIssues(options = {}) {
    this._ensureInitialized();
    return await this.api.getUserIssues(options);
  }

  /**
   * Get user's merge requests
   */
  async getMergeRequests(options = {}) {
    this._ensureInitialized();
    return await this.api.getUserMergeRequests(options);
  }

  /**
   * Get repository file content
   */
  async getFileContent(projectId, filePath, ref = 'main') {
    this._ensureInitialized();
    return await this.api.getRepositoryFile(projectId, filePath, ref);
  }

  /**
   * Get repository tree
   */
  async getRepositoryTree(projectId, options = {}) {
    this._ensureInitialized();
    return await this.api.getRepositoryTree(projectId, options);
  }

  /**
   * Search repositories
   */
  async searchRepositories(query, options = {}) {
    this._ensureInitialized();
    return await this.api.searchProjects(query, options);
  }

  /**
   * Search code across repositories
   */
  async searchCode(query, options = {}) {
    this._ensureInitialized();
    return await this.api.searchCode(query, options);
  }

  /**
   * Get user's activity events
   */
  async getActivity(options = {}) {
    this._ensureInitialized();
    return await this.api.getUserEvents(options);
  }

  /**
   * Test connection to GitLab
   */
  async testConnection() {
    try {
      if (!this.isInitialized) {
        return {
          success: false,
          error: 'Wrapper not initialized'
        };
      }

      const result = await this.api.testConnection();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Get comprehensive user dashboard data
   */
  async getDashboardData(options = {}) {
    this._ensureInitialized();
    
    try {
      const [
        repositories,
        commitActivity,
        issues,
        mergeRequests,
        recentActivity
      ] = await Promise.allSettled([
        this.getRepositories({ per_page: 50 }),
        this.getCommitActivity({ days: options.days || 30 }),
        this.getIssues({ state: 'opened', per_page: 20 }),
        this.getMergeRequests({ state: 'opened', per_page: 20 }),
        this.getActivity({ per_page: 20 })
      ]);

      return {
        user: this.currentUser,
        repositories: repositories.status === 'fulfilled' ? repositories.value : [],
        commitActivity: commitActivity.status === 'fulfilled' ? commitActivity.value : null,
        issues: issues.status === 'fulfilled' ? issues.value : [],
        mergeRequests: mergeRequests.status === 'fulfilled' ? mergeRequests.value : [],
        recentActivity: recentActivity.status === 'fulfilled' ? recentActivity.value : [],
        errors: [
          repositories.status === 'rejected' ? { type: 'repositories', error: repositories.reason.message } : null,
          commitActivity.status === 'rejected' ? { type: 'commitActivity', error: commitActivity.reason.message } : null,
          issues.status === 'rejected' ? { type: 'issues', error: issues.reason.message } : null,
          mergeRequests.status === 'rejected' ? { type: 'mergeRequests', error: mergeRequests.reason.message } : null,
          recentActivity.status === 'rejected' ? { type: 'recentActivity', error: recentActivity.reason.message } : null
        ].filter(Boolean)
      };
    } catch (error) {
      throw new GitLabError(
        `Failed to fetch dashboard data: ${error.message}`,
        ERROR_CODES.API_ERROR,
        error
      );
    }
  }

  /**
   * Setup webhook for a repository
   */
  async setupWebhook(projectId, webhookUrl, events = [], options = {}) {
    this._ensureInitialized();
    
    if (!this.webhooks) {
      throw new GitLabError(
        'Webhooks are not enabled in configuration',
        ERROR_CODES.INVALID_CONFIG
      );
    }

    return await this.webhooks.createWebhook(this.api, projectId, webhookUrl, events, options);
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(payload, headers = {}) {
    if (!this.webhooks) {
      throw new GitLabError(
        'Webhooks are not enabled in configuration',
        ERROR_CODES.INVALID_CONFIG
      );
    }

    return await this.webhooks.handleWebhook(payload, headers);
  }

  /**
   * Clear cache
   */
  clearCache(pattern = null) {
    if (this.cache) {
      return this.cache.clear(pattern);
    }
    return false;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    if (this.cache) {
      return this.cache.getStats();
    }
    return null;
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus() {
    if (this.rateLimit) {
      return this.rateLimit.getStatus();
    }
    return null;
  }

  /**
   * Event emitter functionality
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.eventHandlers.clear();
    
    if (this.cache) {
      this.cache.destroy();
    }
    
    if (this.rateLimit) {
      this.rateLimit.destroy();
    }
    
    if (this.webhooks) {
      this.webhooks.destroy();
    }

    this.isInitialized = false;
    this.currentUser = null;
    this.accessToken = null;
  }

  /**
   * Ensure wrapper is initialized
   */
  _ensureInitialized() {
    if (!this.isInitialized) {
      throw new GitLabError(
        'GitLab wrapper is not initialized. Call initialize() first.',
        ERROR_CODES.INVALID_CONFIG
      );
    }
  }

  /**
   * Get wrapper status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasToken: !!this.accessToken,
      currentUser: this.currentUser,
      config: {
        gitlabUrl: this.config.gitlabUrl,
        apiVersion: this.config.apiVersion,
        enableCache: this.config.enableCache,
        enableRateLimit: this.config.enableRateLimit,
        enableWebhooks: this.config.enableWebhooks
      },
      cache: this.getCacheStats(),
      rateLimit: this.getRateLimitStatus()
    };
  }
}