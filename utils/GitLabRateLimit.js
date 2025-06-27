/**
 * GitLab Rate Limiting Manager
 * 
 * Handles rate limiting for GitLab API requests
 * Implements token bucket algorithm and request queuing
 */

import { GitLabRateLimitError } from '../errors/GitLabErrors.js';
import { RATE_LIMITS } from '../config/constants.js';

export class GitLabRateLimit {
  constructor(options = {}) {
    this.options = {
      requestsPerMinute: options.requestsPerMinute || RATE_LIMITS.DEFAULT,
      burstLimit: options.burstLimit || RATE_LIMITS.BURST_LIMIT,
      enableQueuing: options.enableQueuing !== false,
      maxQueueSize: options.maxQueueSize || 100,
      retryAfterHeader: options.retryAfterHeader !== false,
      ...options
    };

    // Token bucket implementation
    this.tokens = this.options.burstLimit;
    this.lastRefill = Date.now();
    this.refillRate = this.options.requestsPerMinute / 60; // tokens per second

    // Request queue
    this.requestQueue = [];
    this.processing = false;

    // Statistics
    this.stats = {
      totalRequests: 0,
      rateLimitedRequests: 0,
      queuedRequests: 0,
      averageWaitTime: 0,
      lastRateLimitTime: null
    };

    // Event handlers
    this.eventHandlers = new Map();

    // Start token refill process
    this._startTokenRefill();
  }

  /**
   * Check if request can proceed or needs to wait
   */
  async checkLimit(endpoint = null, priority = 0) {
    this.stats.totalRequests++;

    // Refill tokens
    this._refillTokens();

    // Check if we have tokens available
    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }

    // Rate limit exceeded
    this.stats.rateLimitedRequests++;
    this.stats.lastRateLimitTime = new Date().toISOString();

    this.emit('rateLimitExceeded', {
      endpoint,
      remainingTokens: this.tokens,
      queueSize: this.requestQueue.length,
      timestamp: new Date().toISOString()
    });

    if (this.options.enableQueuing) {
      return await this._queueRequest(endpoint, priority);
    } else {
      const waitTime = this._calculateWaitTime();
      throw new GitLabRateLimitError(
        `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`,
        {
          retryAfter: Math.ceil(waitTime / 1000),
          remainingTokens: this.tokens,
          requestsPerMinute: this.options.requestsPerMinute
        }
      );
    }
  }

  /**
   * Update rate limits based on response headers
   */
  updateFromHeaders(headers) {
    try {
      const remaining = headers['x-ratelimit-remaining'];
      const limit = headers['x-ratelimit-limit'];
      const reset = headers['x-ratelimit-reset'];
      const retryAfter = headers['retry-after'];

      if (remaining !== undefined) {
        this.tokens = Math.min(this.tokens, parseInt(remaining, 10));
      }

      if (limit !== undefined) {
        const newLimit = parseInt(limit, 10);
        if (newLimit !== this.options.requestsPerMinute) {
          this.options.requestsPerMinute = newLimit;
          this.refillRate = newLimit / 60;
          
          this.emit('rateLimitUpdated', {
            newLimit,
            previousLimit: this.options.requestsPerMinute,
            timestamp: new Date().toISOString()
          });
        }
      }

      if (reset !== undefined) {
        const resetTime = parseInt(reset, 10) * 1000; // Convert to milliseconds
        const now = Date.now();
        
        if (resetTime > now) {
          // Schedule token reset
          setTimeout(() => {
            this.tokens = this.options.burstLimit;
            this._processQueue();
          }, resetTime - now);
        }
      }

      if (retryAfter !== undefined) {
        const retryAfterMs = parseInt(retryAfter, 10) * 1000;
        
        // Pause all requests for the retry-after period
        setTimeout(() => {
          this.tokens = Math.max(this.tokens, 1);
          this._processQueue();
        }, retryAfterMs);
      }
    } catch (error) {
      console.warn('Failed to parse rate limit headers:', error);
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus() {
    this._refillTokens();
    
    return {
      remainingTokens: Math.floor(this.tokens),
      requestsPerMinute: this.options.requestsPerMinute,
      burstLimit: this.options.burstLimit,
      queueSize: this.requestQueue.length,
      isRateLimited: this.tokens < 1,
      nextTokenIn: this._timeUntilNextToken(),
      stats: { ...this.stats }
    };
  }

  /**
   * Reset rate limiter
   */
  reset() {
    this.tokens = this.options.burstLimit;
    this.lastRefill = Date.now();
    this.requestQueue = [];
    this.processing = false;
    
    this.emit('rateLimitReset', {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Destroy rate limiter and cleanup resources
   */
  destroy() {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
    }
    
    // Reject all queued requests
    this.requestQueue.forEach(request => {
      request.reject(new GitLabRateLimitError('Rate limiter destroyed'));
    });
    
    this.requestQueue = [];
    this.eventHandlers.clear();
  }

  // Private methods

  /**
   * Start token refill process
   */
  _startTokenRefill() {
    this.refillInterval = setInterval(() => {
      this._refillTokens();
      if (this.requestQueue.length > 0 && this.tokens >= 1) {
        this._processQueue();
      }
    }, 1000); // Check every second
  }

  /**
   * Refill tokens based on time elapsed
   */
  _refillTokens() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.options.burstLimit, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Queue a request when rate limited
   */
  async _queueRequest(endpoint, priority) {
    if (this.requestQueue.length >= this.options.maxQueueSize) {
      throw new GitLabRateLimitError(
        'Request queue is full. Too many concurrent requests.',
        {
          queueSize: this.requestQueue.length,
          maxQueueSize: this.options.maxQueueSize
        }
      );
    }

    return new Promise((resolve, reject) => {
      const request = {
        endpoint,
        priority,
        timestamp: Date.now(),
        resolve,
        reject
      };

      // Insert request based on priority (higher priority first)
      let inserted = false;
      for (let i = 0; i < this.requestQueue.length; i++) {
        if (this.requestQueue[i].priority < priority) {
          this.requestQueue.splice(i, 0, request);
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        this.requestQueue.push(request);
      }

      this.stats.queuedRequests++;

      this.emit('requestQueued', {
        endpoint,
        priority,
        queueSize: this.requestQueue.length,
        timestamp: new Date().toISOString()
      });

      // Start processing queue if not already processing
      if (!this.processing) {
        this._processQueue();
      }
    });
  }

  /**
   * Process queued requests
   */
  async _processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0 && this.tokens >= 1) {
      const request = this.requestQueue.shift();
      this.tokens--;

      // Calculate wait time for statistics
      const waitTime = Date.now() - request.timestamp;
      this._updateAverageWaitTime(waitTime);

      this.emit('requestProcessed', {
        endpoint: request.endpoint,
        waitTime,
        queueSize: this.requestQueue.length,
        timestamp: new Date().toISOString()
      });

      request.resolve(true);
    }

    this.processing = false;

    // If there are still queued requests, schedule next processing
    if (this.requestQueue.length > 0) {
      const nextTokenTime = this._timeUntilNextToken();
      setTimeout(() => {
        this._processQueue();
      }, nextTokenTime);
    }
  }

  /**
   * Calculate time until next token is available
   */
  _timeUntilNextToken() {
    if (this.tokens >= 1) {
      return 0;
    }

    const tokensNeeded = 1 - this.tokens;
    return Math.ceil((tokensNeeded / this.refillRate) * 1000); // milliseconds
  }

  /**
   * Calculate wait time for immediate requests
   */
  _calculateWaitTime() {
    return this._timeUntilNextToken();
  }

  /**
   * Update average wait time statistics
   */
  _updateAverageWaitTime(waitTime) {
    const totalWaitTime = this.stats.averageWaitTime * (this.stats.queuedRequests - 1);
    this.stats.averageWaitTime = (totalWaitTime + waitTime) / this.stats.queuedRequests;
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
          console.error(`Error in rate limit event handler for ${event}:`, error);
        }
      });
    }
  }

  // Static utility methods

  /**
   * Create rate limiter with preset configurations
   */
  static createForEndpoint(endpoint, options = {}) {
    const endpointLimits = {
      '/search/': { requestsPerMinute: RATE_LIMITS.SEARCH },
      '/projects': { requestsPerMinute: RATE_LIMITS.DEFAULT },
      '/user': { requestsPerMinute: RATE_LIMITS.DEFAULT }
    };

    const matchedEndpoint = Object.keys(endpointLimits).find(pattern => 
      endpoint.includes(pattern)
    );

    const endpointConfig = matchedEndpoint ? endpointLimits[matchedEndpoint] : {};
    
    return new GitLabRateLimit({
      ...endpointConfig,
      ...options
    });
  }

  /**
   * Create rate limiter for authenticated requests
   */
  static createAuthenticated(options = {}) {
    return new GitLabRateLimit({
      requestsPerMinute: RATE_LIMITS.AUTHENTICATED,
      burstLimit: RATE_LIMITS.BURST_LIMIT,
      ...options
    });
  }

  /**
   * Create rate limiter for unauthenticated requests
   */
  static createUnauthenticated(options = {}) {
    return new GitLabRateLimit({
      requestsPerMinute: RATE_LIMITS.UNAUTHENTICATED,
      burstLimit: Math.min(RATE_LIMITS.BURST_LIMIT, 10),
      ...options
    });
  }

  /**
   * Parse rate limit from error response
   */
  static parseRateLimitError(error) {
    if (error.status === 429) {
      const retryAfter = error.details?.headers?.['retry-after'];
      const remaining = error.details?.headers?.['x-ratelimit-remaining'];
      const limit = error.details?.headers?.['x-ratelimit-limit'];
      const reset = error.details?.headers?.['x-ratelimit-reset'];

      return {
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : null,
        remaining: remaining ? parseInt(remaining, 10) : null,
        limit: limit ? parseInt(limit, 10) : null,
        reset: reset ? parseInt(reset, 10) : null,
        isRateLimited: true
      };
    }

    return {
      isRateLimited: false
    };
  }
}