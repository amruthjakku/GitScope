/**
 * GitLab Wrapper Error Classes
 * 
 * Custom error classes for different types of GitLab-related errors
 */

import { ERROR_CODES } from '../config/constants.js';

/**
 * Base GitLab error class
 */
export class GitLabError extends Error {
  constructor(message, code = ERROR_CODES.API_ERROR, details = null) {
    super(message);
    this.name = 'GitLabError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GitLabError);
    }
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Check if error is retryable
   */
  isRetryable() {
    const retryableCodes = [
      ERROR_CODES.NETWORK_ERROR,
      ERROR_CODES.TIMEOUT,
      ERROR_CODES.RATE_LIMIT_EXCEEDED
    ];
    
    return retryableCodes.includes(this.code) || 
           (this.details?.status >= 500 && this.details?.status < 600);
  }

  /**
   * Check if error is related to authentication
   */
  isAuthError() {
    const authCodes = [
      ERROR_CODES.INVALID_TOKEN,
      ERROR_CODES.TOKEN_EXPIRED,
      ERROR_CODES.INSUFFICIENT_SCOPE
    ];
    
    return authCodes.includes(this.code) || this.details?.status === 401;
  }

  /**
   * Check if error is related to permissions
   */
  isPermissionError() {
    const permissionCodes = [
      ERROR_CODES.ACCESS_DENIED,
      ERROR_CODES.REPOSITORY_ACCESS_DENIED,
      ERROR_CODES.INSUFFICIENT_SCOPE
    ];
    
    return permissionCodes.includes(this.code) || this.details?.status === 403;
  }
}

/**
 * Authentication-specific error
 */
export class GitLabAuthError extends GitLabError {
  constructor(message, code = ERROR_CODES.INVALID_TOKEN, details = null) {
    super(message, code, details);
    this.name = 'GitLabAuthError';
  }

  /**
   * Check if token needs to be refreshed
   */
  needsTokenRefresh() {
    return this.code === ERROR_CODES.TOKEN_EXPIRED || 
           (this.details?.status === 401 && this.message.includes('expired'));
  }

  /**
   * Check if re-authentication is needed
   */
  needsReauth() {
    return this.code === ERROR_CODES.INVALID_TOKEN ||
           this.code === ERROR_CODES.INSUFFICIENT_SCOPE ||
           (this.details?.status === 401 && !this.needsTokenRefresh());
  }
}

/**
 * Permission-specific error
 */
export class GitLabPermissionError extends GitLabError {
  constructor(message, code = ERROR_CODES.ACCESS_DENIED, details = null) {
    super(message, code, details);
    this.name = 'GitLabPermissionError';
  }

  /**
   * Get required permissions if available
   */
  getRequiredPermissions() {
    if (this.details?.response?.required_permissions) {
      return this.details.response.required_permissions;
    }
    
    // Try to extract from message
    const scopeMatch = this.message.match(/Required scopes?: ([^.]+)/i);
    if (scopeMatch) {
      return scopeMatch[1].split(',').map(s => s.trim());
    }
    
    return null;
  }

  /**
   * Check if error is due to insufficient OAuth scopes
   */
  isInsufficientScope() {
    return this.code === ERROR_CODES.INSUFFICIENT_SCOPE ||
           this.message.toLowerCase().includes('insufficient_scope') ||
           this.message.toLowerCase().includes('required scopes');
  }
}

/**
 * Rate limiting error
 */
export class GitLabRateLimitError extends GitLabError {
  constructor(message, details = null) {
    super(message, ERROR_CODES.RATE_LIMIT_EXCEEDED, details);
    this.name = 'GitLabRateLimitError';
  }

  /**
   * Get retry after time in seconds
   */
  getRetryAfter() {
    if (this.details?.headers?.['retry-after']) {
      return parseInt(this.details.headers['retry-after'], 10);
    }
    
    if (this.details?.headers?.['x-ratelimit-reset']) {
      const resetTime = parseInt(this.details.headers['x-ratelimit-reset'], 10);
      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, resetTime - now);
    }
    
    return 60; // Default to 1 minute
  }

  /**
   * Get remaining rate limit if available
   */
  getRemainingLimit() {
    if (this.details?.headers?.['x-ratelimit-remaining']) {
      return parseInt(this.details.headers['x-ratelimit-remaining'], 10);
    }
    
    return 0;
  }

  /**
   * Get rate limit window if available
   */
  getRateLimitWindow() {
    if (this.details?.headers?.['x-ratelimit-limit']) {
      const limit = parseInt(this.details.headers['x-ratelimit-limit'], 10);
      const reset = this.details?.headers?.['x-ratelimit-reset'];
      
      if (reset) {
        const resetTime = parseInt(reset, 10);
        const now = Math.floor(Date.now() / 1000);
        const windowStart = resetTime - 3600; // Assuming 1-hour window
        
        return {
          limit,
          remaining: this.getRemainingLimit(),
          reset: resetTime,
          windowStart
        };
      }
    }
    
    return null;
  }
}

/**
 * Network-related error
 */
export class GitLabNetworkError extends GitLabError {
  constructor(message, details = null) {
    super(message, ERROR_CODES.NETWORK_ERROR, details);
    this.name = 'GitLabNetworkError';
  }

  /**
   * Check if error is due to timeout
   */
  isTimeout() {
    return this.code === ERROR_CODES.TIMEOUT ||
           this.message.toLowerCase().includes('timeout') ||
           this.details?.name === 'AbortError';
  }

  /**
   * Check if error is due to connection issues
   */
  isConnectionError() {
    const connectionErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ECONNRESET',
      'ETIMEDOUT',
      'EHOSTUNREACH'
    ];
    
    return connectionErrors.some(error => 
      this.message.includes(error) || 
      this.details?.code === error
    );
  }
}

/**
 * Configuration error
 */
export class GitLabConfigError extends GitLabError {
  constructor(message, details = null) {
    super(message, ERROR_CODES.INVALID_CONFIG, details);
    this.name = 'GitLabConfigError';
  }

  /**
   * Get missing configuration fields
   */
  getMissingFields() {
    if (this.details?.missingFields) {
      return this.details.missingFields;
    }
    
    // Try to extract from message
    const match = this.message.match(/Missing required.*?: (.+)/i);
    if (match) {
      return match[1].split(',').map(s => s.trim());
    }
    
    return [];
  }
}

/**
 * Webhook-related error
 */
export class GitLabWebhookError extends GitLabError {
  constructor(message, code = ERROR_CODES.API_ERROR, details = null) {
    super(message, code, details);
    this.name = 'GitLabWebhookError';
  }

  /**
   * Check if webhook signature is invalid
   */
  isInvalidSignature() {
    return this.message.toLowerCase().includes('signature') ||
           this.message.toLowerCase().includes('verification');
  }

  /**
   * Check if webhook payload is invalid
   */
  isInvalidPayload() {
    return this.message.toLowerCase().includes('payload') ||
           this.message.toLowerCase().includes('malformed');
  }
}

/**
 * Error factory function
 */
export function createGitLabError(error, context = {}) {
  // If it's already a GitLab error, return as-is
  if (error instanceof GitLabError) {
    return error;
  }

  // Handle different types of errors
  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    return new GitLabNetworkError(
      `Request timeout: ${error.message}`,
      { ...context, originalError: error }
    );
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new GitLabNetworkError(
      `Connection error: ${error.message}`,
      { ...context, originalError: error, code: error.code }
    );
  }

  // Handle HTTP errors
  if (context.status) {
    switch (context.status) {
      case 401:
        return new GitLabAuthError(
          error.message || 'Authentication failed',
          ERROR_CODES.INVALID_TOKEN,
          context
        );
      
      case 403:
        return new GitLabPermissionError(
          error.message || 'Access denied',
          ERROR_CODES.ACCESS_DENIED,
          context
        );
      
      case 429:
        return new GitLabRateLimitError(
          error.message || 'Rate limit exceeded',
          context
        );
      
      default:
        return new GitLabError(
          error.message || 'API error',
          ERROR_CODES.API_ERROR,
          { ...context, originalError: error }
        );
    }
  }

  // Default to generic GitLab error
  return new GitLabError(
    error.message || 'Unknown GitLab error',
    ERROR_CODES.API_ERROR,
    { ...context, originalError: error }
  );
}

/**
 * Error handler utility
 */
export class GitLabErrorHandler {
  constructor(options = {}) {
    this.options = {
      logErrors: options.logErrors !== false,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      ...options
    };
    
    this.errorCounts = new Map();
    this.lastErrors = new Map();
  }

  /**
   * Handle an error with optional retry logic
   */
  async handleError(error, context = {}, retryFn = null) {
    const gitlabError = createGitLabError(error, context);
    
    // Log error if enabled
    if (this.options.logErrors) {
      console.error('GitLab Error:', gitlabError.toJSON());
    }
    
    // Track error statistics
    this._trackError(gitlabError);
    
    // Handle retryable errors
    if (retryFn && gitlabError.isRetryable() && context.attempt < this.options.retryAttempts) {
      const delay = this._calculateRetryDelay(context.attempt, gitlabError);
      
      if (this.options.logErrors) {
        console.log(`Retrying in ${delay}ms (attempt ${context.attempt + 1}/${this.options.retryAttempts})`);
      }
      
      await this._sleep(delay);
      return await retryFn();
    }
    
    throw gitlabError;
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      errorsByType: Object.fromEntries(this.errorCounts),
      lastErrors: Object.fromEntries(this.lastErrors)
    };
  }

  /**
   * Clear error statistics
   */
  clearStats() {
    this.errorCounts.clear();
    this.lastErrors.clear();
  }

  /**
   * Track error for statistics
   */
  _trackError(error) {
    const errorType = error.name;
    this.errorCounts.set(errorType, (this.errorCounts.get(errorType) || 0) + 1);
    this.lastErrors.set(errorType, {
      message: error.message,
      code: error.code,
      timestamp: error.timestamp
    });
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  _calculateRetryDelay(attempt, error) {
    let delay = this.options.retryDelay * Math.pow(2, attempt);
    
    // For rate limit errors, use the retry-after header if available
    if (error instanceof GitLabRateLimitError) {
      const retryAfter = error.getRetryAfter();
      if (retryAfter > 0) {
        delay = Math.max(delay, retryAfter * 1000);
      }
    }
    
    // Add some jitter to prevent thundering herd
    delay += Math.random() * 1000;
    
    return Math.min(delay, 60000); // Cap at 1 minute
  }

  /**
   * Sleep utility
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export error handler instance
export const defaultErrorHandler = new GitLabErrorHandler();