# GitLab Wrapper

A comprehensive GitLab integration wrapper that provides OAuth authentication, repository management, commit tracking, analytics, webhooks, and more.

## Features

- 🔐 **OAuth 2.0 Authentication** - Complete OAuth flow with token refresh
- 📊 **Analytics & Insights** - Commit analysis, contribution patterns, language statistics
- 🚀 **Repository Management** - Access repos, files, commits, issues, merge requests
- 🔄 **Webhooks** - Create and manage GitLab webhooks with event handling
- ⚡ **Rate Limiting** - Built-in rate limiting with request queuing
- 💾 **Caching** - Intelligent caching for improved performance
- 🛡️ **Error Handling** - Comprehensive error handling with retry logic
- 📝 **TypeScript Support** - Full type definitions and runtime type checking

## Installation

```bash
npm install @internlink/gitlab-wrapper
```

## Quick Start

### Basic Setup

```javascript
import { GitLabWrapper } from '@internlink/gitlab-wrapper';

// Initialize the wrapper
const gitlab = new GitLabWrapper({
  clientId: 'your-gitlab-client-id',
  clientSecret: 'your-gitlab-client-secret',
  redirectUri: 'http://localhost:3000/auth/callback',
  gitlabUrl: 'https://code.swecha.org', // Optional, defaults to Swecha
  scopes: ['read_api', 'read_user', 'read_repository']
});

// Start OAuth flow
const authUrl = gitlab.startOAuthFlow();
console.log('Visit:', authUrl.url);

// Complete OAuth flow (after user authorization)
const result = await gitlab.completeOAuthFlow(authorizationCode);
console.log('Authenticated user:', result.user);
```

### Using with Existing Token

```javascript
import { GitLabAPI } from '@internlink/gitlab-wrapper';

// Direct API access with existing token
const api = new GitLabAPI('your-access-token', {
  gitlabUrl: 'https://code.swecha.org'
});

// Get user repositories
const repos = await api.getUserProjects();
console.log('Repositories:', repos);
```

## Configuration Options

```javascript
const config = {
  // OAuth Configuration (required for OAuth flow)
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'your-redirect-uri',
  
  // GitLab Instance (optional)
  gitlabUrl: 'https://code.swecha.org', // Default: Swecha instance
  apiVersion: 'v4', // Default: v4
  
  // Request Configuration
  timeout: 30000, // Request timeout in ms
  retries: 3, // Number of retries for failed requests
  retryDelay: 1000, // Base delay between retries
  
  // Feature Toggles
  enableCache: true, // Enable response caching
  enableRateLimit: true, // Enable rate limiting
  enableWebhooks: false, // Enable webhook functionality
  
  // OAuth Scopes
  scopes: ['read_api', 'read_user', 'read_repository'],
  
  // Cache Configuration
  cache: {
    type: 'memory', // 'memory' or 'redis'
    ttl: 300, // Default TTL in seconds
    maxSize: 1000 // Max items for memory cache
  },
  
  // Rate Limit Configuration
  rateLimit: {
    requestsPerMinute: 600,
    burstLimit: 100,
    enableQueuing: true,
    maxQueueSize: 100
  },
  
  // Webhook Configuration
  webhooks: {
    secretToken: 'your-webhook-secret',
    enableSignatureVerification: true,
    maxPayloadSize: 10485760 // 10MB
  }
};
```

## API Reference

### GitLabWrapper

Main wrapper class that orchestrates all GitLab operations.

#### Methods

##### Authentication

```javascript
// Start OAuth flow
const authData = gitlab.startOAuthFlow(state);

// Complete OAuth flow
const result = await gitlab.completeOAuthFlow(code, state);

// Refresh token
const newTokens = await gitlab.refreshToken(refreshToken);

// Initialize with existing token
await gitlab.initialize(accessToken, userId);
```

##### Repository Operations

```javascript
// Get user repositories
const repos = await gitlab.getRepositories({
  perPage: 50,
  orderBy: 'last_activity_at'
});

// Get specific repository
const repo = await gitlab.getRepository(projectId);

// Get repository commits
const commits = await gitlab.getCommits(projectId, {
  since: '2024-01-01',
  author: 'username'
});

// Get file content
const file = await gitlab.getFileContent(projectId, 'README.md', 'main');

// Get repository tree
const tree = await gitlab.getRepositoryTree(projectId, {
  path: 'src',
  recursive: true
});
```

##### Analytics

```javascript
// Get commit activity analysis
const activity = await gitlab.getCommitActivity({
  days: 90,
  includeStats: true,
  includeHeatmap: true
});

// Get comprehensive dashboard data
const dashboard = await gitlab.getDashboardData({
  days: 30
});
```

##### Issues & Merge Requests

```javascript
// Get user issues
const issues = await gitlab.getIssues({
  state: 'opened',
  perPage: 20
});

// Get user merge requests
const mrs = await gitlab.getMergeRequests({
  state: 'opened'
});
```

##### Search

```javascript
// Search repositories
const repos = await gitlab.searchRepositories('react', {
  orderBy: 'stars'
});

// Search code
const code = await gitlab.searchCode('function authenticate');
```

##### Webhooks

```javascript
// Setup webhook
const webhook = await gitlab.setupWebhook(
  projectId,
  'https://your-app.com/webhooks/gitlab',
  ['push', 'merge_request'],
  { secretToken: 'your-secret' }
);

// Handle incoming webhook
const result = await gitlab.handleWebhook(payload, headers);
```

### GitLabAnalytics

Provides comprehensive analytics and insights.

```javascript
import { GitLabAnalytics } from '@internlink/gitlab-wrapper';

const analytics = new GitLabAnalytics(apiClient);

// Get user commit activity
const activity = await analytics.getUserCommitActivity({
  days: 90,
  includeStats: true,
  includeHeatmap: true,
  includeLanguages: true
});

// Generate commit statistics
const stats = analytics.generateCommitStatistics(commits);

// Get project insights
const insights = await analytics.getProjectInsights(projectId, {
  days: 30,
  includeCommits: true,
  includeIssues: true,
  includeMergeRequests: true
});

// Compare multiple projects
const comparison = await analytics.compareProjects([projectId1, projectId2]);
```

### GitLabWebhooks

Manages GitLab webhooks and event processing.

```javascript
import { GitLabWebhooks } from '@internlink/gitlab-wrapper';

const webhooks = new GitLabWebhooks({
  secretToken: 'your-secret',
  enableSignatureVerification: true
});

// Register event handlers
webhooks.on('push', async (eventInfo, payload) => {
  console.log('Push event:', eventInfo);
  // Process push event
});

webhooks.on('merge_request', async (eventInfo, payload) => {
  console.log('Merge request event:', eventInfo);
  // Process merge request event
});

// Handle webhook payload
const result = await webhooks.handleWebhook(payload, headers);
```

### GitLabCache

Provides caching functionality for API responses.

```javascript
import { GitLabCache } from '@internlink/gitlab-wrapper';

const cache = new GitLabCache({
  type: 'memory',
  ttl: 300,
  maxSize: 1000
});

// Cache user data
await cache.cacheUserData(userId, userData);

// Get cached user data
const userData = await cache.getCachedUserData(userId);

// Cache projects
await cache.cacheProjects(userId, projects);

// Get cache statistics
const stats = cache.getStats();
```

## Examples

### Complete OAuth Flow

```javascript
import express from 'express';
import { GitLabWrapper } from '@internlink/gitlab-wrapper';

const app = express();
const gitlab = new GitLabWrapper({
  clientId: process.env.GITLAB_CLIENT_ID,
  clientSecret: process.env.GITLAB_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/auth/callback'
});

// Start OAuth flow
app.get('/auth/gitlab', (req, res) => {
  const authData = gitlab.startOAuthFlow();
  res.redirect(authData.url);
});

// Handle OAuth callback
app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const result = await gitlab.completeOAuthFlow(code, state);
    
    // Store tokens securely
    req.session.tokens = result.tokenData;
    req.session.user = result.user;
    
    res.redirect('/dashboard');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Protected route
app.get('/dashboard', async (req, res) => {
  try {
    if (!req.session.tokens) {
      return res.redirect('/auth/gitlab');
    }
    
    await gitlab.initialize(req.session.tokens.access_token);
    const dashboard = await gitlab.getDashboardData();
    
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Commit Analytics Dashboard

```javascript
import { GitLabWrapper } from '@internlink/gitlab-wrapper';

async function createCommitDashboard(accessToken) {
  const gitlab = new GitLabWrapper({
    // ... config
  });
  
  await gitlab.initialize(accessToken);
  
  // Get comprehensive commit activity
  const activity = await gitlab.getCommitActivity({
    days: 90,
    includeStats: true,
    includeHeatmap: true,
    includeLanguages: true
  });
  
  console.log('📊 Commit Analytics Dashboard');
  console.log('================================');
  console.log(`Total Commits: ${activity.totalCommits}`);
  console.log(`Active Projects: ${activity.activeProjects}`);
  console.log(`Current Streak: ${activity.statistics.streak.current} days`);
  console.log(`Longest Streak: ${activity.statistics.streak.longest} days`);
  console.log(`Most Active Day: ${activity.statistics.patterns.mostActiveDay}`);
  console.log(`Most Active Hour: ${activity.statistics.patterns.mostActiveHour}`);
  
  // Language breakdown
  console.log('\n🔤 Language Breakdown:');
  activity.languages.languages.slice(0, 5).forEach(lang => {
    console.log(`  ${lang.language}: ${lang.averagePercentage}% (${lang.projectCount} projects)`);
  });
  
  // Recent commits
  console.log('\n📝 Recent Commits:');
  activity.commits.slice(0, 5).forEach(commit => {
    console.log(`  ${commit.short_id}: ${commit.title} (${commit.project.name})`);
  });
  
  return activity;
}
```

### Webhook Event Processing

```javascript
import express from 'express';
import { GitLabWebhooks } from '@internlink/gitlab-wrapper';

const app = express();
const webhooks = new GitLabWebhooks({
  secretToken: process.env.GITLAB_WEBHOOK_SECRET
});

// Register event handlers
webhooks.on('push', async (eventInfo, payload) => {
  console.log(`📤 Push to ${eventInfo.project.name}:`);
  console.log(`  Branch: ${eventInfo.object.ref}`);
  console.log(`  Commits: ${eventInfo.object.commits}`);
  console.log(`  Author: ${eventInfo.user.name}`);
  
  // Process commits
  const commits = GitLabWebhooks.extractCommitsFromPush(payload);
  for (const commit of commits) {
    await processCommit(commit);
  }
});

webhooks.on('merge_request', async (eventInfo, payload) => {
  console.log(`🔀 Merge Request ${eventInfo.object.action}:`);
  console.log(`  Title: ${eventInfo.object.title}`);
  console.log(`  From: ${eventInfo.object.source_branch}`);
  console.log(`  To: ${eventInfo.object.target_branch}`);
  
  if (eventInfo.object.action === 'opened') {
    await notifyReviewers(payload);
  }
});

// Webhook endpoint
app.post('/webhooks/gitlab', express.json(), async (req, res) => {
  try {
    const result = await webhooks.handleWebhook(req.body, req.headers);
    res.json({ success: true, processed: result.processed });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

async function processCommit(commit) {
  // Your commit processing logic
  console.log(`Processing commit: ${commit.id}`);
}

async function notifyReviewers(payload) {
  // Your reviewer notification logic
  console.log('Notifying reviewers...');
}
```

### Repository Analysis

```javascript
import { GitLabWrapper } from '@internlink/gitlab-wrapper';

async function analyzeRepository(accessToken, projectId) {
  const gitlab = new GitLabWrapper({
    // ... config
  });
  
  await gitlab.initialize(accessToken);
  
  // Get repository details
  const repo = await gitlab.getRepository(projectId);
  console.log(`📁 Analyzing: ${repo.name}`);
  
  // Get recent commits
  const commits = await gitlab.getCommits(projectId, {
    since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    perPage: 100
  });
  
  // Analyze commit patterns
  const commitsByDay = {};
  const commitsByAuthor = {};
  
  commits.forEach(commit => {
    const day = commit.created_at.split('T')[0];
    commitsByDay[day] = (commitsByDay[day] || 0) + 1;
    commitsByAuthor[commit.author_name] = (commitsByAuthor[commit.author_name] || 0) + 1;
  });
  
  console.log('\n📈 Commit Analysis (Last 30 days):');
  console.log(`Total Commits: ${commits.length}`);
  console.log(`Active Days: ${Object.keys(commitsByDay).length}`);
  console.log(`Contributors: ${Object.keys(commitsByAuthor).length}`);
  
  // Top contributors
  const topContributors = Object.entries(commitsByAuthor)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  console.log('\n👥 Top Contributors:');
  topContributors.forEach(([author, count]) => {
    console.log(`  ${author}: ${count} commits`);
  });
  
  // Get issues and merge requests
  const [issues, mergeRequests] = await Promise.all([
    gitlab.api.getProjectIssues(projectId, { state: 'opened' }),
    gitlab.api.getProjectMergeRequests(projectId, { state: 'opened' })
  ]);
  
  console.log(`\n📋 Open Issues: ${issues.length}`);
  console.log(`🔀 Open Merge Requests: ${mergeRequests.length}`);
  
  return {
    repository: repo,
    commits,
    commitsByDay,
    commitsByAuthor,
    issues,
    mergeRequests
  };
}
```

## Error Handling

The wrapper provides comprehensive error handling with specific error types:

```javascript
import { 
  GitLabError, 
  GitLabAuthError, 
  GitLabPermissionError,
  GitLabRateLimitError 
} from '@internlink/gitlab-wrapper';

try {
  const repos = await gitlab.getRepositories();
} catch (error) {
  if (error instanceof GitLabAuthError) {
    console.log('Authentication error:', error.message);
    // Redirect to login
  } else if (error instanceof GitLabPermissionError) {
    console.log('Permission error:', error.message);
    // Show permission denied message
  } else if (error instanceof GitLabRateLimitError) {
    console.log('Rate limited:', error.message);
    const retryAfter = error.getRetryAfter();
    console.log(`Retry after ${retryAfter} seconds`);
  } else {
    console.log('General error:', error.message);
  }
}
```

## Environment Variables

```bash
# GitLab OAuth Configuration
GITLAB_CLIENT_ID=your_client_id
GITLAB_CLIENT_SECRET=your_client_secret
GITLAB_REDIRECT_URI=http://localhost:3000/auth/callback

# GitLab Instance (optional)
GITLAB_URL=https://code.swecha.org

# Webhook Configuration (optional)
GITLAB_WEBHOOK_SECRET=your_webhook_secret
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Contact the InternLink team
- Check the documentation and examples

## Changelog

### v1.0.0
- Initial release
- OAuth 2.0 authentication
- Repository management
- Commit analytics
- Webhook support
- Rate limiting and caching
- Comprehensive error handling