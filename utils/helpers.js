/**
 * GitLab Wrapper Utility Functions
 * 
 * Common utility functions used throughout the GitLab wrapper
 */

import { GITLAB_INSTANCES, DATE_FORMATS, SUPPORTED_LANGUAGES } from '../config/constants.js';

/**
 * Validate GitLab URL format
 */
export function validateGitLabUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
  } catch (error) {
    return false;
  }
}

/**
 * Validate URL format (generic)
 */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Parse GitLab URL to extract components
 */
export function parseGitLabUrl(url) {
  if (!validateGitLabUrl(url)) {
    throw new Error('Invalid GitLab URL format');
  }

  const parsedUrl = new URL(url);
  
  return {
    protocol: parsedUrl.protocol,
    host: parsedUrl.host,
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    pathname: parsedUrl.pathname,
    baseUrl: `${parsedUrl.protocol}//${parsedUrl.host}`,
    apiUrl: `${parsedUrl.protocol}//${parsedUrl.host}/api/v4`
  };
}

/**
 * Build URL with parameters
 */
export function buildUrl(baseUrl, endpoint, params = {}) {
  let url = baseUrl;
  
  if (endpoint) {
    url = endpoint.startsWith('/') ? `${baseUrl}${endpoint}` : `${baseUrl}/${endpoint}`;
  }

  if (params && Object.keys(params).length > 0) {
    const urlObj = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => urlObj.searchParams.append(key, v));
        } else {
          urlObj.searchParams.append(key, value);
        }
      }
    });
    url = urlObj.toString();
  }

  return url;
}

/**
 * Generate random string for state parameters
 */
export function generateRandomString(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Parse GitLab date string
 */
export function parseGitLabDate(dateString) {
  if (!dateString) {
    return null;
  }

  try {
    return new Date(dateString);
  } catch (error) {
    console.warn('Failed to parse GitLab date:', dateString);
    return null;
  }
}

/**
 * Format date for GitLab API
 */
export function formatGitLabDate(date, format = DATE_FORMATS.GITLAB_API) {
  if (!date) {
    return null;
  }

  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return null;
  }

  return dateObj.toISOString();
}

/**
 * Format date for display
 */
export function formatDisplayDate(date, format = DATE_FORMATS.DISPLAY) {
  if (!date) {
    return '';
  }

  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }

  // Simple formatting - in production you might want to use a library like date-fns
  switch (format) {
    case DATE_FORMATS.DATE_ONLY:
      return dateObj.toISOString().split('T')[0];
    case DATE_FORMATS.DISPLAY:
      return dateObj.toLocaleString();
    default:
      return dateObj.toISOString();
  }
}

/**
 * Sanitize GitLab API response data
 */
export function sanitizeGitLabData(data) {
  if (!data) {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeGitLabData(item));
  }

  // Handle objects
  if (typeof data === 'object') {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Convert date strings to Date objects
      if (key.includes('_at') || key.includes('_date') || key === 'created' || key === 'updated') {
        sanitized[key] = parseGitLabDate(value);
      }
      // Recursively sanitize nested objects
      else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeGitLabData(value);
      }
      // Keep other values as-is
      else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  return data;
}

/**
 * Validate configuration object
 */
export function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object');
  }

  // Validate required OAuth fields if present
  if (config.clientId || config.clientSecret || config.redirectUri) {
    const required = ['clientId', 'clientSecret', 'redirectUri'];
    const missing = required.filter(key => !config[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required OAuth configuration: ${missing.join(', ')}`);
    }

    if (!validateUrl(config.redirectUri)) {
      throw new Error('Invalid redirect URI format');
    }
  }

  // Validate GitLab URL if present
  if (config.gitlabUrl && !validateGitLabUrl(config.gitlabUrl)) {
    throw new Error('Invalid GitLab URL format');
  }

  // Validate numeric values
  if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
    throw new Error('Timeout must be a positive number');
  }

  if (config.retries && (typeof config.retries !== 'number' || config.retries < 0)) {
    throw new Error('Retries must be a non-negative number');
  }

  if (config.retryDelay && (typeof config.retryDelay !== 'number' || config.retryDelay <= 0)) {
    throw new Error('Retry delay must be a positive number');
  }

  return true;
}

/**
 * Merge configuration objects
 */
export function mergeConfig(defaultConfig, userConfig) {
  const merged = { ...defaultConfig };

  for (const [key, value] of Object.entries(userConfig)) {
    if (value !== undefined && value !== null) {
      // Deep merge for nested objects
      if (typeof value === 'object' && !Array.isArray(value) && 
          typeof defaultConfig[key] === 'object' && !Array.isArray(defaultConfig[key])) {
        merged[key] = { ...defaultConfig[key], ...value };
      } else {
        merged[key] = value;
      }
    }
  }

  return merged;
}

/**
 * Extract project ID from various formats
 */
export function extractProjectId(projectIdentifier) {
  if (typeof projectIdentifier === 'number') {
    return projectIdentifier;
  }

  if (typeof projectIdentifier === 'string') {
    // If it's a numeric string
    if (/^\d+$/.test(projectIdentifier)) {
      return parseInt(projectIdentifier, 10);
    }

    // If it's a URL-encoded project path
    if (projectIdentifier.includes('%2F')) {
      return projectIdentifier;
    }

    // If it's a project path (group/project)
    if (projectIdentifier.includes('/')) {
      return encodeURIComponent(projectIdentifier);
    }
  }

  throw new Error('Invalid project identifier format');
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : '';
}

/**
 * Get programming language from file extension
 */
export function getLanguageFromExtension(extension) {
  const languageMap = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'swift': 'swift',
    'kt': 'kotlin',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'xml': 'xml',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'dockerfile': 'dockerfile',
    'makefile': 'makefile',
    'sh': 'shell',
    'bash': 'bash',
    'zsh': 'zsh',
    'fish': 'fish',
    'ps1': 'powershell',
    'sql': 'sql',
    'md': 'markdown',
    'tex': 'tex',
    'r': 'r',
    'm': 'matlab',
    'scala': 'scala',
    'clj': 'clojure',
    'hs': 'haskell',
    'erl': 'erlang',
    'ex': 'elixir',
    'dart': 'dart',
    'vue': 'vue',
    'svelte': 'svelte'
  };

  const normalizedExt = extension.toLowerCase().replace(/^\./, '');
  return languageMap[normalizedExt] || 'text';
}

/**
 * Check if language is supported for syntax highlighting
 */
export function isLanguageSupported(language) {
  return SUPPORTED_LANGUAGES.includes(language.toLowerCase());
}

/**
 * Truncate text to specified length
 */
export function truncateText(text, maxLength = 100, suffix = '...') {
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Calculate time ago from date
 */
export function timeAgo(date) {
  if (!date) {
    return '';
  }

  const dateObj = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
  } else if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
  } else {
    return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Debounce function calls
 */
export function debounce(func, wait, immediate = false) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(this, args);
  };
}

/**
 * Throttle function calls
 */
export function throttle(func, limit) {
  let inThrottle;
  
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }

  const cloned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
}

/**
 * Check if object is empty
 */
export function isEmpty(obj) {
  if (obj == null) return true;
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
}

/**
 * Sleep utility
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry(fn, options = {}) {
  const {
    retries = 3,
    delay = 1000,
    backoff = 2,
    maxDelay = 30000
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        break;
      }

      const currentDelay = Math.min(delay * Math.pow(backoff, attempt), maxDelay);
      await sleep(currentDelay);
    }
  }

  throw lastError;
}

export default {
  validateGitLabUrl,
  validateUrl,
  parseGitLabUrl,
  buildUrl,
  generateRandomString,
  parseGitLabDate,
  formatGitLabDate,
  formatDisplayDate,
  sanitizeGitLabData,
  validateConfig,
  mergeConfig,
  extractProjectId,
  getFileExtension,
  getLanguageFromExtension,
  isLanguageSupported,
  truncateText,
  formatFileSize,
  timeAgo,
  debounce,
  throttle,
  deepClone,
  isEmpty,
  sleep,
  retry
};