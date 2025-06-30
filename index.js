/**
 * GitLab Wrapper - Main Entry Point
 * 
 * A comprehensive GitLab integration wrapper that provides:
 * - OAuth authentication flow
 * - Repository management
 * - Commit tracking and analytics
 * - Issue and merge request management
 * - User management
 * - Webhook handling
 * - Rate limiting and error handling
 * 
 * @author Jakku Amruth
 * @version 1.0.0
 */

export { GitLabWrapper } from './core/GitLabWrapper.js';
export { GitLabOAuth } from './auth/GitLabOAuth.js';
export { GitLabAPI } from './api/GitLabAPI.js';
export { GitLabAnalytics } from './analytics/GitLabAnalytics.js';
export { GitLabWebhooks } from './webhooks/GitLabWebhooks.js';
export { GitLabCache } from './cache/GitLabCache.js';
export { GitLabRateLimit } from './utils/GitLabRateLimit.js';
export { GitLabError, GitLabAuthError, GitLabPermissionError } from './errors/GitLabErrors.js';

// Configuration and constants
export { GITLAB_SCOPES, GITLAB_ENDPOINTS, GITLAB_EVENTS } from './config/constants.js';

// Types and interfaces (for TypeScript support)
export * from './types/index.js';

// Utility functions
export { 
  validateGitLabUrl, 
  parseGitLabUrl, 
  formatGitLabDate,
  sanitizeGitLabData 
} from './utils/helpers.js';

/**
 * Quick start function for basic GitLab integration
 */
export function createGitLabWrapper(config) {
  return new GitLabWrapper(config);
}

/**
 * Create OAuth authentication handler
 */
export function createGitLabOAuth(config) {
  return new GitLabOAuth(config);
}

/**
 * Create API client with existing token
 */
export function createGitLabAPI(accessToken, options = {}) {
  return new GitLabAPI(accessToken, options);
}

// Default export for convenience
export default {
  GitLabWrapper,
  GitLabOAuth,
  GitLabAPI,
  GitLabAnalytics,
  GitLabWebhooks,
  GitLabCache,
  createGitLabWrapper,
  createGitLabOAuth,
  createGitLabAPI
};
