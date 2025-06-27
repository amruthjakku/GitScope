/**
 * GitLab Wrapper Type Definitions
 * 
 * Type definitions and interfaces for TypeScript support
 * Also provides runtime type checking utilities
 */

// Configuration Types
export const ConfigTypes = {
  GitLabWrapperConfig: {
    clientId: 'string',
    clientSecret: 'string',
    redirectUri: 'string',
    gitlabUrl: 'string?',
    apiVersion: 'string?',
    timeout: 'number?',
    retries: 'number?',
    retryDelay: 'number?',
    enableCache: 'boolean?',
    enableRateLimit: 'boolean?',
    enableWebhooks: 'boolean?',
    scopes: 'array?'
  },

  OAuthConfig: {
    clientId: 'string',
    clientSecret: 'string',
    redirectUri: 'string',
    gitlabUrl: 'string?',
    scopes: 'array?',
    responseType: 'string?'
  },

  APIConfig: {
    gitlabUrl: 'string?',
    apiVersion: 'string?',
    timeout: 'number?',
    retries: 'number?',
    retryDelay: 'number?'
  },

  CacheConfig: {
    type: 'string?',
    ttl: 'number?',
    maxSize: 'number?',
    keyPrefix: 'string?',
    enableCompression: 'boolean?'
  },

  RateLimitConfig: {
    requestsPerMinute: 'number?',
    burstLimit: 'number?',
    enableQueuing: 'boolean?',
    maxQueueSize: 'number?'
  },

  WebhookConfig: {
    secretToken: 'string?',
    enableSignatureVerification: 'boolean?',
    enableEventFiltering: 'boolean?',
    maxPayloadSize: 'number?'
  }
};

// API Response Types
export const ResponseTypes = {
  User: {
    id: 'number',
    username: 'string',
    name: 'string',
    email: 'string',
    avatar_url: 'string?',
    web_url: 'string?',
    created_at: 'string',
    bio: 'string?',
    location: 'string?',
    public_email: 'string?',
    skype: 'string?',
    linkedin: 'string?',
    twitter: 'string?',
    website_url: 'string?',
    organization: 'string?'
  },

  Project: {
    id: 'number',
    name: 'string',
    path: 'string',
    path_with_namespace: 'string',
    description: 'string?',
    web_url: 'string',
    avatar_url: 'string?',
    git_ssh_url: 'string',
    git_http_url: 'string',
    namespace: 'object',
    ssh_url_to_repo: 'string',
    http_url_to_repo: 'string',
    visibility: 'string',
    default_branch: 'string?',
    created_at: 'string',
    last_activity_at: 'string',
    creator_id: 'number?',
    archived: 'boolean',
    issues_enabled: 'boolean',
    merge_requests_enabled: 'boolean',
    wiki_enabled: 'boolean',
    jobs_enabled: 'boolean',
    snippets_enabled: 'boolean',
    container_registry_enabled: 'boolean',
    service_desk_enabled: 'boolean',
    can_create_merge_request_in: 'boolean',
    issues_access_level: 'string',
    repository_access_level: 'string',
    merge_requests_access_level: 'string',
    forking_access_level: 'string',
    wiki_access_level: 'string',
    builds_access_level: 'string',
    snippets_access_level: 'string',
    pages_access_level: 'string',
    analytics_access_level: 'string',
    container_registry_access_level: 'string',
    security_and_compliance_access_level: 'string',
    releases_access_level: 'string',
    environments_access_level: 'string',
    feature_flags_access_level: 'string',
    infrastructure_access_level: 'string',
    monitor_access_level: 'string'
  },

  Commit: {
    id: 'string',
    short_id: 'string',
    title: 'string',
    message: 'string',
    author_name: 'string',
    author_email: 'string',
    authored_date: 'string',
    committer_name: 'string',
    committer_email: 'string',
    committed_date: 'string',
    created_at: 'string',
    parent_ids: 'array',
    web_url: 'string',
    stats: 'object?',
    status: 'string?',
    project_id: 'number?'
  },

  Issue: {
    id: 'number',
    iid: 'number',
    project_id: 'number',
    title: 'string',
    description: 'string?',
    state: 'string',
    created_at: 'string',
    updated_at: 'string',
    closed_at: 'string?',
    closed_by: 'object?',
    labels: 'array',
    milestone: 'object?',
    assignees: 'array',
    author: 'object',
    type: 'string',
    assignee: 'object?',
    user_notes_count: 'number',
    merge_requests_count: 'number',
    upvotes: 'number',
    downvotes: 'number',
    due_date: 'string?',
    confidential: 'boolean',
    discussion_locked: 'boolean?',
    issue_type: 'string?',
    web_url: 'string',
    time_stats: 'object',
    task_completion_status: 'object',
    blocking_issues_count: 'number',
    has_tasks: 'boolean',
    task_status: 'string?',
    _links: 'object',
    references: 'object',
    severity: 'string?',
    subscribed: 'boolean',
    moved_to_id: 'number?',
    service_desk_reply_to: 'string?'
  },

  MergeRequest: {
    id: 'number',
    iid: 'number',
    project_id: 'number',
    title: 'string',
    description: 'string?',
    state: 'string',
    created_at: 'string',
    updated_at: 'string',
    merged_by: 'object?',
    merge_user: 'object?',
    merged_at: 'string?',
    closed_by: 'object?',
    closed_at: 'string?',
    target_branch: 'string',
    source_branch: 'string',
    user_notes_count: 'number',
    upvotes: 'number',
    downvotes: 'number',
    author: 'object',
    assignees: 'array',
    assignee: 'object?',
    reviewers: 'array',
    source_project_id: 'number',
    target_project_id: 'number',
    labels: 'array',
    draft: 'boolean',
    work_in_progress: 'boolean',
    milestone: 'object?',
    merge_when_pipeline_succeeds: 'boolean',
    merge_status: 'string',
    detailed_merge_status: 'string?',
    sha: 'string',
    merge_commit_sha: 'string?',
    squash_commit_sha: 'string?',
    discussion_locked: 'boolean?',
    should_remove_source_branch: 'boolean?',
    force_remove_source_branch: 'boolean?',
    reference: 'string',
    references: 'object',
    web_url: 'string',
    time_stats: 'object',
    squash: 'boolean',
    task_completion_status: 'object',
    has_conflicts: 'boolean',
    blocking_discussions_resolved: 'boolean',
    approvals_before_merge: 'number?'
  }
};

// Analytics Types
export const AnalyticsTypes = {
  CommitActivity: {
    user: 'object',
    projects: 'array',
    commits: 'array',
    totalCommits: 'number',
    activeProjects: 'number',
    dateRange: 'object',
    statistics: 'object?',
    heatmap: 'object?',
    languages: 'object?',
    errors: 'array?'
  },

  CommitStatistics: {
    total: 'number',
    byDay: 'object',
    byWeek: 'object',
    byMonth: 'object',
    byHour: 'object',
    byDayOfWeek: 'object',
    streak: 'object',
    averages: 'object',
    patterns: 'object',
    recent: 'array',
    projectStats: 'object'
  },

  CommitHeatmap: {
    data: 'array',
    summary: 'object'
  },

  LanguageAnalysis: {
    languages: 'array',
    summary: 'object',
    errors: 'array?'
  }
};

// Event Types
export const EventTypes = {
  WebhookEvent: {
    type: 'string',
    timestamp: 'string',
    source: 'string',
    project: 'object?',
    user: 'object?',
    object: 'object?'
  },

  PushEvent: {
    ref: 'string',
    before: 'string',
    after: 'string',
    commits: 'number',
    totalCommitsCount: 'number'
  },

  IssueEvent: {
    id: 'number',
    iid: 'number',
    title: 'string',
    state: 'string',
    action: 'string'
  },

  MergeRequestEvent: {
    id: 'number',
    iid: 'number',
    title: 'string',
    state: 'string',
    action: 'string',
    source_branch: 'string',
    target_branch: 'string'
  }
};

// Error Types
export const ErrorTypes = {
  GitLabError: {
    name: 'string',
    message: 'string',
    code: 'string',
    details: 'object?',
    timestamp: 'string'
  },

  GitLabAuthError: {
    name: 'string',
    message: 'string',
    code: 'string',
    details: 'object?',
    timestamp: 'string'
  },

  GitLabPermissionError: {
    name: 'string',
    message: 'string',
    code: 'string',
    details: 'object?',
    timestamp: 'string'
  }
};

// Runtime type checking utilities
export class TypeChecker {
  /**
   * Check if value matches type definition
   */
  static check(value, typeDefinition) {
    if (typeof typeDefinition === 'string') {
      return this._checkPrimitiveType(value, typeDefinition);
    }

    if (typeof typeDefinition === 'object') {
      return this._checkObjectType(value, typeDefinition);
    }

    return false;
  }

  /**
   * Validate object against type definition
   */
  static validate(obj, typeName) {
    const typeDefinition = this._getTypeDefinition(typeName);
    if (!typeDefinition) {
      throw new Error(`Unknown type: ${typeName}`);
    }

    const result = this.check(obj, typeDefinition);
    if (!result.valid) {
      throw new Error(`Type validation failed: ${result.errors.join(', ')}`);
    }

    return true;
  }

  /**
   * Get type definition by name
   */
  static _getTypeDefinition(typeName) {
    // Look in all type categories
    const allTypes = {
      ...ConfigTypes,
      ...ResponseTypes,
      ...AnalyticsTypes,
      ...EventTypes,
      ...ErrorTypes
    };

    return allTypes[typeName];
  }

  /**
   * Check primitive type
   */
  static _checkPrimitiveType(value, typeString) {
    const isOptional = typeString.endsWith('?');
    const baseType = isOptional ? typeString.slice(0, -1) : typeString;

    if (isOptional && (value === undefined || value === null)) {
      return { valid: true, errors: [] };
    }

    switch (baseType) {
      case 'string':
        return {
          valid: typeof value === 'string',
          errors: typeof value === 'string' ? [] : [`Expected string, got ${typeof value}`]
        };
      
      case 'number':
        return {
          valid: typeof value === 'number' && !isNaN(value),
          errors: typeof value === 'number' && !isNaN(value) ? [] : [`Expected number, got ${typeof value}`]
        };
      
      case 'boolean':
        return {
          valid: typeof value === 'boolean',
          errors: typeof value === 'boolean' ? [] : [`Expected boolean, got ${typeof value}`]
        };
      
      case 'array':
        return {
          valid: Array.isArray(value),
          errors: Array.isArray(value) ? [] : [`Expected array, got ${typeof value}`]
        };
      
      case 'object':
        return {
          valid: typeof value === 'object' && value !== null && !Array.isArray(value),
          errors: typeof value === 'object' && value !== null && !Array.isArray(value) 
            ? [] 
            : [`Expected object, got ${typeof value}`]
        };
      
      default:
        return {
          valid: false,
          errors: [`Unknown type: ${baseType}`]
        };
    }
  }

  /**
   * Check object type
   */
  static _checkObjectType(value, typeDefinition) {
    if (typeof value !== 'object' || value === null) {
      return {
        valid: false,
        errors: [`Expected object, got ${typeof value}`]
      };
    }

    const errors = [];

    for (const [key, expectedType] of Object.entries(typeDefinition)) {
      const fieldValue = value[key];
      const fieldResult = this._checkPrimitiveType(fieldValue, expectedType);
      
      if (!fieldResult.valid) {
        errors.push(`Field '${key}': ${fieldResult.errors.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create type-safe wrapper for API responses
   */
  static createTypeSafeWrapper(typeName) {
    return (data) => {
      try {
        this.validate(data, typeName);
        return data;
      } catch (error) {
        console.warn(`Type validation warning for ${typeName}:`, error.message);
        return data; // Return data anyway, but log warning
      }
    };
  }
}

// Type guards for common types
export const TypeGuards = {
  isUser: (obj) => TypeChecker.check(obj, ResponseTypes.User).valid,
  isProject: (obj) => TypeChecker.check(obj, ResponseTypes.Project).valid,
  isCommit: (obj) => TypeChecker.check(obj, ResponseTypes.Commit).valid,
  isIssue: (obj) => TypeChecker.check(obj, ResponseTypes.Issue).valid,
  isMergeRequest: (obj) => TypeChecker.check(obj, ResponseTypes.MergeRequest).valid,
  isWebhookEvent: (obj) => TypeChecker.check(obj, EventTypes.WebhookEvent).valid
};

// Type-safe wrappers
export const TypeSafeWrappers = {
  User: TypeChecker.createTypeSafeWrapper('User'),
  Project: TypeChecker.createTypeSafeWrapper('Project'),
  Commit: TypeChecker.createTypeSafeWrapper('Commit'),
  Issue: TypeChecker.createTypeSafeWrapper('Issue'),
  MergeRequest: TypeChecker.createTypeSafeWrapper('MergeRequest'),
  CommitActivity: TypeChecker.createTypeSafeWrapper('CommitActivity')
};

export default {
  ConfigTypes,
  ResponseTypes,
  AnalyticsTypes,
  EventTypes,
  ErrorTypes,
  TypeChecker,
  TypeGuards,
  TypeSafeWrappers
};