/**
 * GitLab Cache Manager
 * 
 * Provides caching functionality for GitLab API responses
 * Supports in-memory and Redis-based caching
 */

import { GitLabError, ERROR_CODES } from '../errors/GitLabErrors.js';
import { CACHE_CONFIG } from '../config/constants.js';

export class GitLabCache {
  constructor(options = {}) {
    this.options = {
      type: options.type || 'memory', // 'memory' or 'redis'
      ttl: options.ttl || 300, // Default TTL in seconds
      maxSize: options.maxSize || 1000, // Max items for memory cache
      keyPrefix: options.keyPrefix || 'gitlab:',
      enableCompression: options.enableCompression || false,
      ...options
    };

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };

    // Initialize cache based on type
    if (this.options.type === 'memory') {
      this._initMemoryCache();
    } else if (this.options.type === 'redis') {
      this._initRedisCache();
    } else {
      throw new GitLabError(
        `Unsupported cache type: ${this.options.type}`,
        ERROR_CODES.INVALID_CONFIG
      );
    }
  }

  /**
   * Initialize in-memory cache
   */
  _initMemoryCache() {
    this.cache = new Map();
    this.timers = new Map();
    
    // Cleanup expired entries periodically
    this.cleanupInterval = setInterval(() => {
      this._cleanupExpired();
    }, 60000); // Every minute
  }

  /**
   * Initialize Redis cache (placeholder for Redis integration)
   */
  _initRedisCache() {
    // In a real implementation, you would initialize Redis client here
    // For now, we'll fall back to memory cache
    console.warn('Redis cache not implemented, falling back to memory cache');
    this._initMemoryCache();
  }

  /**
   * Get value from cache
   */
  async get(key) {
    try {
      const fullKey = this._buildKey(key);
      
      if (this.options.type === 'memory') {
        return await this._getFromMemory(fullKey);
      } else if (this.options.type === 'redis') {
        return await this._getFromRedis(fullKey);
      }
      
      return null;
    } catch (error) {
      this.stats.errors++;
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttl = null) {
    try {
      const fullKey = this._buildKey(key);
      const cacheTTL = ttl || this.options.ttl;
      
      if (this.options.type === 'memory') {
        await this._setInMemory(fullKey, value, cacheTTL);
      } else if (this.options.type === 'redis') {
        await this._setInRedis(fullKey, value, cacheTTL);
      }
      
      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key) {
    try {
      const fullKey = this._buildKey(key);
      
      if (this.options.type === 'memory') {
        return await this._deleteFromMemory(fullKey);
      } else if (this.options.type === 'redis') {
        return await this._deleteFromRedis(fullKey);
      }
      
      return false;
    } catch (error) {
      this.stats.errors++;
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key) {
    try {
      const fullKey = this._buildKey(key);
      
      if (this.options.type === 'memory') {
        return this.cache.has(fullKey) && !this._isExpired(fullKey);
      } else if (this.options.type === 'redis') {
        // Redis implementation would go here
        return false;
      }
      
      return false;
    } catch (error) {
      this.stats.errors++;
      console.error('Cache has error:', error);
      return false;
    }
  }

  /**
   * Clear cache (all or by pattern)
   */
  async clear(pattern = null) {
    try {
      if (this.options.type === 'memory') {
        if (pattern) {
          return await this._clearMemoryByPattern(pattern);
        } else {
          return await this._clearAllMemory();
        }
      } else if (this.options.type === 'redis') {
        // Redis implementation would go here
        return false;
      }
      
      return false;
    } catch (error) {
      this.stats.errors++;
      console.error('Cache clear error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100).toFixed(2) : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      totalRequests,
      cacheSize: this.options.type === 'memory' ? this.cache.size : 'unknown',
      type: this.options.type
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Get cache size
   */
  getSize() {
    if (this.options.type === 'memory') {
      return this.cache.size;
    }
    return 0;
  }

  /**
   * Get all cache keys
   */
  getKeys(pattern = null) {
    if (this.options.type === 'memory') {
      const keys = Array.from(this.cache.keys());
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return keys.filter(key => regex.test(key));
      }
      return keys;
    }
    return [];
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.options.type === 'memory') {
      this.cache.clear();
      this.timers.clear();
    }
  }

  // Memory cache implementation methods

  async _getFromMemory(key) {
    if (this.cache.has(key)) {
      if (this._isExpired(key)) {
        this._deleteFromMemory(key);
        this.stats.misses++;
        return null;
      }
      
      const item = this.cache.get(key);
      this.stats.hits++;
      return this._deserializeValue(item.value);
    }
    
    this.stats.misses++;
    return null;
  }

  async _setInMemory(key, value, ttl) {
    // Check cache size limit
    if (this.cache.size >= this.options.maxSize) {
      this._evictOldest();
    }

    const serializedValue = this._serializeValue(value);
    const expiresAt = Date.now() + (ttl * 1000);
    
    this.cache.set(key, {
      value: serializedValue,
      expiresAt,
      createdAt: Date.now()
    });

    // Set expiration timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    
    const timer = setTimeout(() => {
      this._deleteFromMemory(key);
    }, ttl * 1000);
    
    this.timers.set(key, timer);
  }

  async _deleteFromMemory(key) {
    const deleted = this.cache.delete(key);
    
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    
    if (deleted) {
      this.stats.deletes++;
    }
    
    return deleted;
  }

  async _clearMemoryByPattern(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      await this._deleteFromMemory(key);
    }
    
    return keysToDelete.length;
  }

  async _clearAllMemory() {
    const size = this.cache.size;
    
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.cache.clear();
    this.timers.clear();
    
    return size;
  }

  // Redis cache implementation methods (placeholders)

  async _getFromRedis(key) {
    // Redis implementation would go here
    // For now, fall back to memory
    return await this._getFromMemory(key);
  }

  async _setInRedis(key, value, ttl) {
    // Redis implementation would go here
    // For now, fall back to memory
    return await this._setInMemory(key, value, ttl);
  }

  async _deleteFromRedis(key) {
    // Redis implementation would go here
    // For now, fall back to memory
    return await this._deleteFromMemory(key);
  }

  // Utility methods

  _buildKey(key) {
    return `${this.options.keyPrefix}${key}`;
  }

  _isExpired(key) {
    if (!this.cache.has(key)) {
      return true;
    }
    
    const item = this.cache.get(key);
    return Date.now() > item.expiresAt;
  }

  _serializeValue(value) {
    if (this.options.enableCompression) {
      // In a real implementation, you might use compression here
      return JSON.stringify(value);
    }
    return JSON.stringify(value);
  }

  _deserializeValue(serializedValue) {
    try {
      return JSON.parse(serializedValue);
    } catch (error) {
      console.error('Failed to deserialize cached value:', error);
      return null;
    }
  }

  _evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (item.createdAt < oldestTime) {
        oldestTime = item.createdAt;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this._deleteFromMemory(oldestKey);
    }
  }

  _cleanupExpired() {
    const expiredKeys = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (Date.now() > item.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this._deleteFromMemory(key);
    }
  }

  // Cache key builders for common GitLab data types

  static buildUserKey(userId) {
    return CACHE_CONFIG.KEYS.USER.replace('{userId}', userId);
  }

  static buildProjectsKey(userId) {
    return CACHE_CONFIG.KEYS.PROJECTS.replace('{userId}', userId);
  }

  static buildCommitsKey(projectId, since) {
    return CACHE_CONFIG.KEYS.COMMITS
      .replace('{projectId}', projectId)
      .replace('{since}', since);
  }

  static buildIssuesKey(projectId, state) {
    return CACHE_CONFIG.KEYS.ISSUES
      .replace('{projectId}', projectId)
      .replace('{state}', state);
  }

  static buildMergeRequestsKey(projectId, state) {
    return CACHE_CONFIG.KEYS.MERGE_REQUESTS
      .replace('{projectId}', projectId)
      .replace('{state}', state);
  }

  static buildRepositoryKey(projectId, path, ref) {
    return CACHE_CONFIG.KEYS.REPOSITORY
      .replace('{projectId}', projectId)
      .replace('{path}', path)
      .replace('{ref}', ref);
  }

  // Convenience methods for common caching patterns

  async cacheUserData(userId, userData, ttl = CACHE_CONFIG.USER_INFO) {
    const key = GitLabCache.buildUserKey(userId);
    return await this.set(key, userData, ttl);
  }

  async getCachedUserData(userId) {
    const key = GitLabCache.buildUserKey(userId);
    return await this.get(key);
  }

  async cacheProjects(userId, projects, ttl = CACHE_CONFIG.PROJECTS) {
    const key = GitLabCache.buildProjectsKey(userId);
    return await this.set(key, projects, ttl);
  }

  async getCachedProjects(userId) {
    const key = GitLabCache.buildProjectsKey(userId);
    return await this.get(key);
  }

  async cacheCommits(projectId, since, commits, ttl = CACHE_CONFIG.COMMITS) {
    const key = GitLabCache.buildCommitsKey(projectId, since);
    return await this.set(key, commits, ttl);
  }

  async getCachedCommits(projectId, since) {
    const key = GitLabCache.buildCommitsKey(projectId, since);
    return await this.get(key);
  }

  async cacheIssues(projectId, state, issues, ttl = CACHE_CONFIG.ISSUES) {
    const key = GitLabCache.buildIssuesKey(projectId, state);
    return await this.set(key, issues, ttl);
  }

  async getCachedIssues(projectId, state) {
    const key = GitLabCache.buildIssuesKey(projectId, state);
    return await this.get(key);
  }

  async cacheMergeRequests(projectId, state, mergeRequests, ttl = CACHE_CONFIG.MERGE_REQUESTS) {
    const key = GitLabCache.buildMergeRequestsKey(projectId, state);
    return await this.set(key, mergeRequests, ttl);
  }

  async getCachedMergeRequests(projectId, state) {
    const key = GitLabCache.buildMergeRequestsKey(projectId, state);
    return await this.get(key);
  }

  async cacheRepositoryFile(projectId, path, ref, fileData, ttl = CACHE_CONFIG.REPOSITORY_FILES) {
    const key = GitLabCache.buildRepositoryKey(projectId, path, ref);
    return await this.set(key, fileData, ttl);
  }

  async getCachedRepositoryFile(projectId, path, ref) {
    const key = GitLabCache.buildRepositoryKey(projectId, path, ref);
    return await this.get(key);
  }
}