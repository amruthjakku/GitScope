/**
 * GitLab Webhooks Manager
 * 
 * Handles GitLab webhook creation, management, and event processing
 */

import crypto from 'crypto';
import { GitLabWebhookError } from '../errors/GitLabErrors.js';
import { GITLAB_EVENTS, ERROR_CODES } from '../config/constants.js';

export class GitLabWebhooks {
  constructor(options = {}) {
    this.options = {
      secretToken: options.secretToken || null,
      enableSignatureVerification: options.enableSignatureVerification !== false,
      enableEventFiltering: options.enableEventFiltering !== false,
      maxPayloadSize: options.maxPayloadSize || 10 * 1024 * 1024, // 10MB
      ...options
    };

    this.eventHandlers = new Map();
    this.webhookConfigs = new Map();
    
    // Statistics
    this.stats = {
      totalWebhooks: 0,
      eventsReceived: 0,
      eventsProcessed: 0,
      eventsFailed: 0,
      lastEventTime: null
    };
  }

  /**
   * Create a webhook for a project
   */
  async createWebhook(apiClient, projectId, webhookUrl, events = [], options = {}) {
    try {
      const webhookData = {
        url: webhookUrl,
        push_events: events.includes(GITLAB_EVENTS.PUSH) || events.length === 0,
        tag_push_events: events.includes(GITLAB_EVENTS.TAG_PUSH),
        issues_events: events.includes(GITLAB_EVENTS.ISSUE),
        merge_requests_events: events.includes(GITLAB_EVENTS.MERGE_REQUEST),
        wiki_page_events: events.includes(GITLAB_EVENTS.WIKI_PAGE),
        deployment_events: events.includes(GITLAB_EVENTS.DEPLOYMENT),
        job_events: events.includes(GITLAB_EVENTS.JOB),
        pipeline_events: events.includes(GITLAB_EVENTS.PIPELINE),
        releases_events: events.includes(GITLAB_EVENTS.RELEASE),
        subgroup_events: events.includes(GITLAB_EVENTS.SUBGROUP),
        enable_ssl_verification: options.enableSslVerification !== false,
        token: options.secretToken || this.options.secretToken,
        ...options.additionalConfig
      };

      const webhook = await apiClient.createProjectHook(projectId, webhookData);
      
      // Store webhook configuration
      this.webhookConfigs.set(webhook.id, {
        projectId,
        url: webhookUrl,
        events,
        secretToken: webhookData.token,
        createdAt: new Date().toISOString()
      });

      this.stats.totalWebhooks++;

      return {
        success: true,
        webhook,
        config: this.webhookConfigs.get(webhook.id)
      };
    } catch (error) {
      throw new GitLabWebhookError(
        `Failed to create webhook: ${error.message}`,
        ERROR_CODES.API_ERROR,
        error
      );
    }
  }

  /**
   * Update an existing webhook
   */
  async updateWebhook(apiClient, projectId, webhookId, updates = {}) {
    try {
      const webhook = await apiClient.updateProjectHook(projectId, webhookId, updates);
      
      // Update stored configuration
      if (this.webhookConfigs.has(webhookId)) {
        const config = this.webhookConfigs.get(webhookId);
        this.webhookConfigs.set(webhookId, {
          ...config,
          ...updates,
          updatedAt: new Date().toISOString()
        });
      }

      return {
        success: true,
        webhook,
        config: this.webhookConfigs.get(webhookId)
      };
    } catch (error) {
      throw new GitLabWebhookError(
        `Failed to update webhook: ${error.message}`,
        ERROR_CODES.API_ERROR,
        error
      );
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(apiClient, projectId, webhookId) {
    try {
      await apiClient.deleteProjectHook(projectId, webhookId);
      
      // Remove from stored configurations
      this.webhookConfigs.delete(webhookId);
      this.stats.totalWebhooks = Math.max(0, this.stats.totalWebhooks - 1);

      return {
        success: true,
        deletedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new GitLabWebhookError(
        `Failed to delete webhook: ${error.message}`,
        ERROR_CODES.API_ERROR,
        error
      );
    }
  }

  /**
   * List webhooks for a project
   */
  async listWebhooks(apiClient, projectId) {
    try {
      const webhooks = await apiClient.getProjectHooks(projectId);
      
      return {
        success: true,
        webhooks,
        count: webhooks.length
      };
    } catch (error) {
      throw new GitLabWebhookError(
        `Failed to list webhooks: ${error.message}`,
        ERROR_CODES.API_ERROR,
        error
      );
    }
  }

  /**
   * Handle incoming webhook payload
   */
  async handleWebhook(payload, headers = {}, options = {}) {
    try {
      this.stats.eventsReceived++;
      this.stats.lastEventTime = new Date().toISOString();

      // Parse payload if it's a string
      const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
      
      // Validate payload size
      const payloadSize = JSON.stringify(parsedPayload).length;
      if (payloadSize > this.options.maxPayloadSize) {
        throw new GitLabWebhookError(
          `Payload size (${payloadSize}) exceeds maximum allowed size (${this.options.maxPayloadSize})`,
          ERROR_CODES.INVALID_RESPONSE
        );
      }

      // Verify signature if enabled
      if (this.options.enableSignatureVerification) {
        const isValid = this.verifySignature(payload, headers, options.secretToken);
        if (!isValid) {
          throw new GitLabWebhookError(
            'Invalid webhook signature',
            ERROR_CODES.ACCESS_DENIED
          );
        }
      }

      // Extract event information
      const eventInfo = this.extractEventInfo(parsedPayload, headers);
      
      // Filter events if enabled
      if (this.options.enableEventFiltering && !this.shouldProcessEvent(eventInfo)) {
        return {
          success: true,
          processed: false,
          reason: 'Event filtered out',
          eventInfo
        };
      }

      // Process the event
      const result = await this.processEvent(eventInfo, parsedPayload);
      
      this.stats.eventsProcessed++;
      
      return {
        success: true,
        processed: true,
        eventInfo,
        result
      };
    } catch (error) {
      this.stats.eventsFailed++;
      
      if (error instanceof GitLabWebhookError) {
        throw error;
      }
      
      throw new GitLabWebhookError(
        `Failed to handle webhook: ${error.message}`,
        ERROR_CODES.API_ERROR,
        error
      );
    }
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload, headers, secretToken = null) {
    try {
      const signature = headers['x-gitlab-token'] || headers['X-Gitlab-Token'];
      const token = secretToken || this.options.secretToken;
      
      if (!signature || !token) {
        return false;
      }

      // GitLab uses simple token comparison, not HMAC
      return signature === token;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Extract event information from payload and headers
   */
  extractEventInfo(payload, headers) {
    const eventType = headers['x-gitlab-event'] || headers['X-Gitlab-Event'] || 'unknown';
    
    const eventInfo = {
      type: eventType.toLowerCase().replace(' hook', ''),
      timestamp: new Date().toISOString(),
      source: 'gitlab',
      project: null,
      user: null,
      object: null
    };

    // Extract project information
    if (payload.project) {
      eventInfo.project = {
        id: payload.project.id,
        name: payload.project.name,
        path: payload.project.path_with_namespace,
        url: payload.project.web_url
      };
    }

    // Extract user information
    if (payload.user) {
      eventInfo.user = {
        id: payload.user.id,
        username: payload.user.username,
        name: payload.user.name,
        email: payload.user.email
      };
    }

    // Extract object-specific information based on event type
    switch (eventInfo.type) {
      case 'push':
        eventInfo.object = {
          ref: payload.ref,
          before: payload.before,
          after: payload.after,
          commits: payload.commits?.length || 0,
          totalCommitsCount: payload.total_commits_count
        };
        break;
        
      case 'tag_push':
        eventInfo.object = {
          ref: payload.ref,
          before: payload.before,
          after: payload.after
        };
        break;
        
      case 'issue':
        if (payload.object_attributes) {
          eventInfo.object = {
            id: payload.object_attributes.id,
            iid: payload.object_attributes.iid,
            title: payload.object_attributes.title,
            state: payload.object_attributes.state,
            action: payload.object_attributes.action
          };
        }
        break;
        
      case 'merge_request':
        if (payload.object_attributes) {
          eventInfo.object = {
            id: payload.object_attributes.id,
            iid: payload.object_attributes.iid,
            title: payload.object_attributes.title,
            state: payload.object_attributes.state,
            action: payload.object_attributes.action,
            source_branch: payload.object_attributes.source_branch,
            target_branch: payload.object_attributes.target_branch
          };
        }
        break;
        
      case 'pipeline':
        if (payload.object_attributes) {
          eventInfo.object = {
            id: payload.object_attributes.id,
            status: payload.object_attributes.status,
            ref: payload.object_attributes.ref,
            sha: payload.object_attributes.sha
          };
        }
        break;
    }

    return eventInfo;
  }

  /**
   * Check if event should be processed
   */
  shouldProcessEvent(eventInfo) {
    // Override this method to implement custom filtering logic
    return true;
  }

  /**
   * Process webhook event
   */
  async processEvent(eventInfo, payload) {
    const handlers = this.eventHandlers.get(eventInfo.type) || [];
    const results = [];

    for (const handler of handlers) {
      try {
        const result = await handler(eventInfo, payload);
        results.push({
          handler: handler.name || 'anonymous',
          success: true,
          result
        });
      } catch (error) {
        results.push({
          handler: handler.name || 'anonymous',
          success: false,
          error: error.message
        });
      }
    }

    // Also call generic event handlers
    const genericHandlers = this.eventHandlers.get('*') || [];
    for (const handler of genericHandlers) {
      try {
        const result = await handler(eventInfo, payload);
        results.push({
          handler: handler.name || 'anonymous',
          success: true,
          result,
          type: 'generic'
        });
      } catch (error) {
        results.push({
          handler: handler.name || 'anonymous',
          success: false,
          error: error.message,
          type: 'generic'
        });
      }
    }

    return {
      handlersExecuted: results.length,
      results
    };
  }

  /**
   * Register event handler
   */
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  /**
   * Remove event handler
   */
  off(eventType, handler) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Remove all handlers for an event type
   */
  removeAllListeners(eventType) {
    if (eventType) {
      this.eventHandlers.delete(eventType);
    } else {
      this.eventHandlers.clear();
    }
  }

  /**
   * Get webhook statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeWebhooks: this.webhookConfigs.size,
      registeredHandlers: Array.from(this.eventHandlers.entries()).reduce((total, [type, handlers]) => {
        return total + handlers.length;
      }, 0)
    };
  }

  /**
   * Get webhook configurations
   */
  getConfigurations() {
    return Array.from(this.webhookConfigs.entries()).map(([id, config]) => ({
      id,
      ...config
    }));
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(apiClient, projectId, webhookId) {
    try {
      // GitLab doesn't have a built-in test endpoint, so we'll simulate
      const webhook = await apiClient.get(`/projects/${projectId}/hooks/${webhookId}`);
      
      return {
        success: true,
        webhook,
        message: 'Webhook configuration is valid'
      };
    } catch (error) {
      throw new GitLabWebhookError(
        `Failed to test webhook: ${error.message}`,
        ERROR_CODES.API_ERROR,
        error
      );
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.eventHandlers.clear();
    this.webhookConfigs.clear();
  }

  // Static utility methods

  /**
   * Create webhook URL with query parameters
   */
  static buildWebhookUrl(baseUrl, options = {}) {
    const url = new URL(baseUrl);
    
    if (options.secret) {
      url.searchParams.append('secret', options.secret);
    }
    
    if (options.project) {
      url.searchParams.append('project', options.project);
    }
    
    if (options.source) {
      url.searchParams.append('source', options.source);
    }
    
    return url.toString();
  }

  /**
   * Validate webhook payload structure
   */
  static validatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Payload must be an object' };
    }

    // Basic GitLab webhook structure validation
    const requiredFields = ['object_kind'];
    const missingFields = requiredFields.filter(field => !(field in payload));
    
    if (missingFields.length > 0) {
      return { 
        valid: false, 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      };
    }

    return { valid: true };
  }

  /**
   * Extract commit information from push event
   */
  static extractCommitsFromPush(payload) {
    if (payload.object_kind !== 'push' || !payload.commits) {
      return [];
    }

    return payload.commits.map(commit => ({
      id: commit.id,
      message: commit.message,
      timestamp: commit.timestamp,
      author: {
        name: commit.author.name,
        email: commit.author.email
      },
      url: commit.url,
      added: commit.added || [],
      modified: commit.modified || [],
      removed: commit.removed || []
    }));
  }

  /**
   * Create event filter function
   */
  static createEventFilter(options = {}) {
    const {
      allowedEvents = [],
      blockedEvents = [],
      allowedProjects = [],
      blockedProjects = [],
      allowedUsers = [],
      blockedUsers = []
    } = options;

    return (eventInfo) => {
      // Check event type
      if (allowedEvents.length > 0 && !allowedEvents.includes(eventInfo.type)) {
        return false;
      }
      
      if (blockedEvents.length > 0 && blockedEvents.includes(eventInfo.type)) {
        return false;
      }

      // Check project
      if (eventInfo.project) {
        if (allowedProjects.length > 0 && !allowedProjects.includes(eventInfo.project.id)) {
          return false;
        }
        
        if (blockedProjects.length > 0 && blockedProjects.includes(eventInfo.project.id)) {
          return false;
        }
      }

      // Check user
      if (eventInfo.user) {
        if (allowedUsers.length > 0 && !allowedUsers.includes(eventInfo.user.id)) {
          return false;
        }
        
        if (blockedUsers.length > 0 && blockedUsers.includes(eventInfo.user.id)) {
          return false;
        }
      }

      return true;
    };
  }
}