/**
 * GitLab Wrapper Constants
 * 
 * Centralized configuration and constants for GitLab integration
 */

// Default GitLab instance URLs
export const GITLAB_INSTANCES = {
  SWECHA: 'https://code.swecha.org',
  GITLAB_COM: 'https://gitlab.com',
  SELF_HOSTED: process.env.GITLAB_URL || 'https://code.swecha.org'
};

// API versions and endpoints
export const API_VERSIONS = {
  V4: 'v4',
  V3: 'v3' // Legacy support
};

export const GITLAB_ENDPOINTS = {
  // Authentication
  OAUTH_AUTHORIZE: '/oauth/authorize',
  OAUTH_TOKEN: '/oauth/token',
  OAUTH_REVOKE: '/oauth/revoke',
  
  // User endpoints
  USER: '/user',
  USER_PROJECTS: '/projects',
  USER_ISSUES: '/issues',
  USER_MERGE_REQUESTS: '/merge_requests',
  USER_EVENTS: '/events',
  
  // Project endpoints
  PROJECTS: '/projects',
  PROJECT_COMMITS: '/projects/{id}/repository/commits',
  PROJECT_BRANCHES: '/projects/{id}/repository/branches',
  PROJECT_TAGS: '/projects/{id}/repository/tags',
  PROJECT_ISSUES: '/projects/{id}/issues',
  PROJECT_MERGE_REQUESTS: '/projects/{id}/merge_requests',
  PROJECT_MEMBERS: '/projects/{id}/members',
  PROJECT_HOOKS: '/projects/{id}/hooks',
  PROJECT_STATISTICS: '/projects/{id}/statistics',
  PROJECT_LANGUAGES: '/projects/{id}/languages',
  
  // Repository endpoints
  REPOSITORY_FILES: '/projects/{id}/repository/files',
  REPOSITORY_TREE: '/projects/{id}/repository/tree',
  REPOSITORY_ARCHIVE: '/projects/{id}/repository/archive',
  
  // Groups
  GROUPS: '/groups',
  GROUP_PROJECTS: '/groups/{id}/projects',
  GROUP_MEMBERS: '/groups/{id}/members',
  
  // Admin (if applicable)
  ADMIN_USERS: '/users',
  ADMIN_PROJECTS: '/projects/all',
  
  // System
  VERSION: '/version',
  HEALTH: '/health'
};

// OAuth scopes
export const GITLAB_SCOPES = {
  // Read permissions
  READ_API: 'read_api',
  READ_USER: 'read_user',
  READ_REPOSITORY: 'read_repository',
  READ_REGISTRY: 'read_registry',
  
  // Write permissions
  API: 'api',
  WRITE_REPOSITORY: 'write_repository',
  WRITE_REGISTRY: 'write_registry',
  
  // OpenID Connect
  OPENID: 'openid',
  PROFILE: 'profile',
  EMAIL: 'email',
  
  // Admin (rarely used)
  SUDO: 'sudo'
};

// Recommended scope combinations
export const SCOPE_COMBINATIONS = {
  // Basic read-only access
  READ_ONLY: [
    GITLAB_SCOPES.READ_API,
    GITLAB_SCOPES.READ_USER,
    GITLAB_SCOPES.READ_REPOSITORY
  ],
  
  // Full access for development tools
  FULL_ACCESS: [
    GITLAB_SCOPES.API,
    GITLAB_SCOPES.READ_USER,
    GITLAB_SCOPES.READ_REPOSITORY,
    GITLAB_SCOPES.WRITE_REPOSITORY
  ],
  
  // User profile and basic repo access
  PROFILE_AND_REPOS: [
    GITLAB_SCOPES.READ_API,
    GITLAB_SCOPES.READ_USER,
    GITLAB_SCOPES.READ_REPOSITORY,
    GITLAB_SCOPES.OPENID,
    GITLAB_SCOPES.PROFILE,
    GITLAB_SCOPES.EMAIL
  ],
  
  // Minimal access for commit tracking
  COMMIT_TRACKING: [
    GITLAB_SCOPES.READ_API,
    GITLAB_SCOPES.READ_USER,
    GITLAB_SCOPES.READ_REPOSITORY
  ]
};

// GitLab webhook events
export const GITLAB_EVENTS = {
  PUSH: 'push',
  TAG_PUSH: 'tag_push',
  ISSUE: 'issue',
  MERGE_REQUEST: 'merge_request',
  WIKI_PAGE: 'wiki_page',
  DEPLOYMENT: 'deployment',
  JOB: 'job',
  PIPELINE: 'pipeline',
  RELEASE: 'release',
  SUBGROUP: 'subgroup'
};

// Rate limiting
export const RATE_LIMITS = {
  // Requests per minute for different endpoints
  DEFAULT: 600,
  SEARCH: 60,
  AUTHENTICATED: 2000,
  UNAUTHENTICATED: 10,
  
  // Burst limits
  BURST_LIMIT: 100,
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // milliseconds
  BACKOFF_MULTIPLIER: 2
};

// Cache configuration
export const CACHE_CONFIG = {
  // TTL in seconds
  USER_INFO: 300, // 5 minutes
  PROJECTS: 600, // 10 minutes
  COMMITS: 180, // 3 minutes
  ISSUES: 120, // 2 minutes
  MERGE_REQUESTS: 120, // 2 minutes
  REPOSITORY_FILES: 900, // 15 minutes
  
  // Cache keys
  KEYS: {
    USER: 'gitlab:user:{userId}',
    PROJECTS: 'gitlab:projects:{userId}',
    COMMITS: 'gitlab:commits:{projectId}:{since}',
    ISSUES: 'gitlab:issues:{projectId}:{state}',
    MERGE_REQUESTS: 'gitlab:mrs:{projectId}:{state}',
    REPOSITORY: 'gitlab:repo:{projectId}:{path}:{ref}'
  }
};

// Error codes and messages
export const ERROR_CODES = {
  // Authentication errors
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_SCOPE: 'INSUFFICIENT_SCOPE',
  
  // Permission errors
  ACCESS_DENIED: 'ACCESS_DENIED',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  REPOSITORY_ACCESS_DENIED: 'REPOSITORY_ACCESS_DENIED',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  
  // API errors
  API_ERROR: 'API_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  
  // Configuration errors
  INVALID_CONFIG: 'INVALID_CONFIG',
  MISSING_CREDENTIALS: 'MISSING_CREDENTIALS'
};

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

// Default configuration
export const DEFAULT_CONFIG = {
  gitlabUrl: GITLAB_INSTANCES.SWECHA,
  apiVersion: API_VERSIONS.V4,
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000,
  enableCache: true,
  enableRateLimit: true,
  enableWebhooks: false,
  scopes: SCOPE_COMBINATIONS.COMMIT_TRACKING
};

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 100,
  DEFAULT_PAGE: 1
};

// Date formats
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  GITLAB_API: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  DISPLAY: 'YYYY-MM-DD HH:mm:ss',
  DATE_ONLY: 'YYYY-MM-DD'
};

// File size limits
export const FILE_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_DIFF_SIZE: 10 * 1024 * 1024,  // 10MB
  MAX_COMMIT_MESSAGE_LENGTH: 65536   // 64KB
};

// Supported file types for syntax highlighting
export const SUPPORTED_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c',
  'csharp', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin',
  'html', 'css', 'scss', 'sass', 'less', 'xml', 'json',
  'yaml', 'yml', 'toml', 'ini', 'dockerfile', 'makefile',
  'shell', 'bash', 'zsh', 'fish', 'powershell', 'sql',
  'markdown', 'tex', 'r', 'matlab', 'scala', 'clojure',
  'haskell', 'erlang', 'elixir', 'dart', 'vue', 'svelte'
];

export default {
  GITLAB_INSTANCES,
  API_VERSIONS,
  GITLAB_ENDPOINTS,
  GITLAB_SCOPES,
  SCOPE_COMBINATIONS,
  GITLAB_EVENTS,
  RATE_LIMITS,
  CACHE_CONFIG,
  ERROR_CODES,
  HTTP_STATUS,
  DEFAULT_CONFIG,
  PAGINATION,
  DATE_FORMATS,
  FILE_LIMITS,
  SUPPORTED_LANGUAGES
};