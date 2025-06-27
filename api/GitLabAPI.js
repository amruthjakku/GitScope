/**
 * GitLab API Client
 * 
 * Comprehensive API client for GitLab REST API
 * Handles authentication, rate limiting, caching, and error handling
 */

import { GitLabError, GitLabAuthError, GitLabPermissionError } from '../errors/GitLabErrors.js';
import { GITLAB_ENDPOINTS, ERROR_CODES, HTTP_STATUS, PAGINATION } from '../config/constants.js';
import { buildUrl, parseGitLabDate, sanitizeGitLabData } from '../utils/helpers.js';

export class GitLabAPI {
  constructor(accessToken, options = {}) {
    this.accessToken = accessToken;
    this.config = {
      gitlabUrl: options.gitlabUrl || 'https://code.swecha.org',
      apiVersion: options.apiVersion || 'v4',
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      retryDelay: options.retryDelay || 1000,
      ...options
    };
    
    this.baseUrl = `${this.config.gitlabUrl}/api/${this.config.apiVersion}`;
    this.cache = options.cache || null;
    this.rateLimit = options.rateLimit || null;
    
    // Request interceptors
    this.requestInterceptors = [];
    this.responseInterceptors = [];
  }

  /**
   * Make authenticated request to GitLab API
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    
    // Apply rate limiting
    if (this.rateLimit) {
      await this.rateLimit.checkLimit();
    }

    // Check cache first
    const cacheKey = this._getCacheKey(endpoint, options);
    if (this.cache && options.method !== 'POST' && options.method !== 'PUT' && options.method !== 'DELETE') {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const config = {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Add request body for POST/PUT requests
    if (options.body && (config.method === 'POST' || config.method === 'PUT' || config.method === 'PATCH')) {
      config.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      await interceptor(config);
    }

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    config.signal = controller.signal;

    let lastError;
    
    // Retry logic
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const response = await fetch(url, config);
        clearTimeout(timeoutId);
        
        // Apply response interceptors
        for (const interceptor of this.responseInterceptors) {
          await interceptor(response);
        }

        if (!response.ok) {
          const error = await this._handleErrorResponse(response, url);
          
          // Don't retry on certain errors
          if (error.status === HTTP_STATUS.UNAUTHORIZED || 
              error.status === HTTP_STATUS.FORBIDDEN ||
              error.status === HTTP_STATUS.NOT_FOUND) {
            throw error;
          }
          
          lastError = error;
          
          // Retry on server errors and rate limits
          if (attempt < this.config.retries && 
              (error.status >= 500 || error.status === HTTP_STATUS.TOO_MANY_REQUESTS)) {
            const delay = this.config.retryDelay * Math.pow(2, attempt);
            await this._sleep(delay);
            continue;
          }
          
          throw error;
        }

        const data = await this._parseResponse(response);
        
        // Cache successful responses
        if (this.cache && config.method === 'GET') {
          await this.cache.set(cacheKey, data, options.cacheTTL);
        }

        return data;
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw new GitLabError(
            'Request timeout',
            ERROR_CODES.TIMEOUT
          );
        }
        
        if (error instanceof GitLabError) {
          lastError = error;
          
          // Don't retry on auth/permission errors
          if (error.code === ERROR_CODES.INVALID_TOKEN || 
              error.code === ERROR_CODES.ACCESS_DENIED) {
            throw error;
          }
        } else {
          lastError = new GitLabError(
            `Network error: ${error.message}`,
            ERROR_CODES.NETWORK_ERROR,
            error
          );
        }
        
        if (attempt < this.config.retries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await this._sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * GET request
   */
  async get(endpoint, params = {}, options = {}) {
    const url = this._buildUrlWithParams(endpoint, params);
    return await this.request(url, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post(endpoint, body = {}, options = {}) {
    return await this.request(endpoint, { 
      ...options, 
      method: 'POST', 
      body 
    });
  }

  /**
   * PUT request
   */
  async put(endpoint, body = {}, options = {}) {
    return await this.request(endpoint, { 
      ...options, 
      method: 'PUT', 
      body 
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return await this.request(endpoint, { ...options, method: 'DELETE' });
  }

  // User API methods
  async getCurrentUser() {
    return await this.get(GITLAB_ENDPOINTS.USER);
  }

  async getUserProjects(options = {}) {
    const params = {
      membership: 'true',
      per_page: options.perPage || PAGINATION.DEFAULT_PER_PAGE,
      page: options.page || PAGINATION.DEFAULT_PAGE,
      order_by: options.orderBy || 'last_activity_at',
      sort: options.sort || 'desc',
      ...options.params
    };
    
    return await this.get(GITLAB_ENDPOINTS.USER_PROJECTS, params);
  }

  async getUserIssues(options = {}) {
    const params = {
      scope: options.scope || 'assigned_to_me',
      state: options.state || 'opened',
      per_page: options.perPage || PAGINATION.DEFAULT_PER_PAGE,
      page: options.page || PAGINATION.DEFAULT_PAGE,
      ...options.params
    };
    
    return await this.get(GITLAB_ENDPOINTS.USER_ISSUES, params);
  }

  async getUserMergeRequests(options = {}) {
    const params = {
      scope: options.scope || 'assigned_to_me',
      state: options.state || 'opened',
      per_page: options.perPage || PAGINATION.DEFAULT_PER_PAGE,
      page: options.page || PAGINATION.DEFAULT_PAGE,
      ...options.params
    };
    
    return await this.get(GITLAB_ENDPOINTS.USER_MERGE_REQUESTS, params);
  }

  async getUserEvents(options = {}) {
    const params = {
      per_page: options.perPage || PAGINATION.DEFAULT_PER_PAGE,
      page: options.page || PAGINATION.DEFAULT_PAGE,
      after: options.after,
      before: options.before,
      ...options.params
    };
    
    return await this.get(GITLAB_ENDPOINTS.USER_EVENTS, params);
  }

  // Project API methods
  async getProject(projectId) {
    return await this.get(`${GITLAB_ENDPOINTS.PROJECTS}/${projectId}`);
  }

  async getProjectCommits(projectId, options = {}) {
    const endpoint = GITLAB_ENDPOINTS.PROJECT_COMMITS.replace('{id}', projectId);
    const params = {
      per_page: options.perPage || PAGINATION.DEFAULT_PER_PAGE,
      page: options.page || PAGINATION.DEFAULT_PAGE,
      ref_name: options.ref || options.branch,
      since: options.since,
      until: options.until,
      author: options.author,
      ...options.params
    };
    
    return await this.get(endpoint, params);
  }

  async getProjectLanguages(projectId) {
    const endpoint = GITLAB_ENDPOINTS.PROJECT_LANGUAGES.replace('{id}', projectId);
    return await this.get(endpoint);
  }

  async getRepositoryFile(projectId, filePath, ref = 'main') {
    const endpoint = GITLAB_ENDPOINTS.REPOSITORY_FILES.replace('{id}', projectId);
    const encodedPath = encodeURIComponent(filePath);
    const params = { ref };
    
    return await this.get(`${endpoint}/${encodedPath}`, params);
  }

  async getRepositoryTree(projectId, options = {}) {
    const endpoint = GITLAB_ENDPOINTS.REPOSITORY_TREE.replace('{id}', projectId);
    const params = {
      ref: options.ref || 'main',
      path: options.path || '',
      recursive: options.recursive || false,
      per_page: options.perPage || PAGINATION.DEFAULT_PER_PAGE,
      page: options.page || PAGINATION.DEFAULT_PAGE,
      ...options.params
    };
    
    return await this.get(endpoint, params);
  }

  // Search API methods
  async searchProjects(query, options = {}) {
    const params = {
      search: query,
      per_page: options.perPage || PAGINATION.DEFAULT_PER_PAGE,
      page: options.page || PAGINATION.DEFAULT_PAGE,
      order_by: options.orderBy || 'last_activity_at',
      sort: options.sort || 'desc',
      membership: options.membership,
      owned: options.owned,
      starred: options.starred,
      ...options.params
    };
    
    return await this.get('/projects', params);
  }

  async searchCode(query, options = {}) {
    const params = {
      search: query,
      per_page: options.perPage || PAGINATION.DEFAULT_PER_PAGE,
      page: options.page || PAGINATION.DEFAULT_PAGE,
      ...options.params
    };
    
    return await this.get('/search/blobs', params);
  }

  // Webhook API methods
  async getProjectHooks(projectId) {
    const endpoint = GITLAB_ENDPOINTS.PROJECT_HOOKS.replace('{id}', projectId);
    return await this.get(endpoint);
  }

  async createProjectHook(projectId, hookData) {
    const endpoint = GITLAB_ENDPOINTS.PROJECT_HOOKS.replace('{id}', projectId);
    return await this.post(endpoint, hookData);
  }

  async updateProjectHook(projectId, hookId, hookData) {
    const endpoint = GITLAB_ENDPOINTS.PROJECT_HOOKS.replace('{id}', projectId);
    return await this.put(`${endpoint}/${hookId}`, hookData);
  }

  async deleteProjectHook(projectId, hookId) {
    const endpoint = GITLAB_ENDPOINTS.PROJECT_HOOKS.replace('{id}', projectId);
    return await this.delete(`${endpoint}/${hookId}`);
  }

  // Utility methods
  async testConnection() {
    try {
      const user = await this.getCurrentUser();
      
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email
        },
        gitlab: {
          url: this.config.gitlabUrl,
          api_version: this.config.apiVersion
        },
        connection: {
          tested_at: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code,
        gitlab: {
          url: this.config.gitlabUrl,
          api_version: this.config.apiVersion
        },
        connection: {
          tested_at: new Date().toISOString()
        }
      };
    }
  }

  // Private helper methods
  _buildUrlWithParams(endpoint, params) {
    if (!params || Object.keys(params).length === 0) {
      return endpoint;
    }
    
    const url = new URL(endpoint, this.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v));
        } else {
          url.searchParams.append(key, value);
        }
      }
    });
    
    return url.pathname + url.search;
  }

  _getCacheKey(endpoint, options) {
    const method = options.method || 'GET';
    const params = JSON.stringify(options.params || {});
    return `gitlab:api:${method}:${endpoint}:${params}`;
  }

  async _handleErrorResponse(response, url) {
    let errorData;
    
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        errorData = { message: await response.text() };
      }
    } catch (parseError) {
      errorData = { message: `HTTP ${response.status}` };
    }

    const message = errorData.message || errorData.error || response.statusText || 'Unknown error';
    
    switch (response.status) {
      case HTTP_STATUS.UNAUTHORIZED:
        return new GitLabAuthError(
          `Authentication failed: ${message}`,
          ERROR_CODES.INVALID_TOKEN,
          { status: response.status, url, response: errorData }
        );
      
      case HTTP_STATUS.FORBIDDEN:
        return new GitLabPermissionError(
          `Access denied: ${message}`,
          ERROR_CODES.ACCESS_DENIED,
          { status: response.status, url, response: errorData }
        );
      
      case HTTP_STATUS.NOT_FOUND:
        return new GitLabError(
          `Resource not found: ${message}`,
          ERROR_CODES.PROJECT_NOT_FOUND,
          { status: response.status, url, response: errorData }
        );
      
      case HTTP_STATUS.TOO_MANY_REQUESTS:
        return new GitLabError(
          `Rate limit exceeded: ${message}`,
          ERROR_CODES.RATE_LIMIT_EXCEEDED,
          { status: response.status, url, response: errorData }
        );
      
      default:
        return new GitLabError(
          `API error (${response.status}): ${message}`,
          ERROR_CODES.API_ERROR,
          { status: response.status, url, response: errorData }
        );
    }
  }

  async _parseResponse(response) {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return sanitizeGitLabData(data);
    } else {
      return await response.text();
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}