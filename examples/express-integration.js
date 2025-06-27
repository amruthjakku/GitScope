/**
 * Express.js Integration Example
 * 
 * This example shows how to integrate the GitLab wrapper with an Express.js application
 * including OAuth flow, session management, and API endpoints
 */

import express from 'express';
import session from 'express-session';
import { GitLabWrapper, GitLabWebhooks } from '../index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize GitLab wrapper
const gitlab = new GitLabWrapper({
  clientId: process.env.GITLAB_CLIENT_ID,
  clientSecret: process.env.GITLAB_CLIENT_SECRET,
  redirectUri: process.env.GITLAB_REDIRECT_URI || `http://localhost:${PORT}/auth/gitlab/callback`,
  gitlabUrl: process.env.GITLAB_URL || 'https://code.swecha.org',
  scopes: ['read_api', 'read_user', 'read_repository'],
  enableCache: true,
  enableRateLimit: true
});

// Initialize webhooks
const webhooks = new GitLabWebhooks({
  secretToken: process.env.GITLAB_WEBHOOK_SECRET,
  enableSignatureVerification: true
});

// Setup webhook event handlers
webhooks.on('push', async (eventInfo, payload) => {
  console.log(`📤 Push event received for ${eventInfo.project.name}`);
  console.log(`  Branch: ${eventInfo.object.ref}`);
  console.log(`  Commits: ${eventInfo.object.commits}`);
  console.log(`  Author: ${eventInfo.user.name}`);
  
  // Process the push event (e.g., trigger CI/CD, send notifications)
  await processPushEvent(eventInfo, payload);
});

webhooks.on('merge_request', async (eventInfo, payload) => {
  console.log(`🔀 Merge request ${eventInfo.object.action} for ${eventInfo.project.name}`);
  console.log(`  Title: ${eventInfo.object.title}`);
  console.log(`  From: ${eventInfo.object.source_branch} to ${eventInfo.object.target_branch}`);
  
  // Process the merge request event
  await processMergeRequestEvent(eventInfo, payload);
});

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (!req.session.user || !req.session.tokens) {
    return res.status(401).json({ 
      error: 'Authentication required',
      loginUrl: '/auth/gitlab'
    });
  }
  next();
}

// Middleware to initialize GitLab API for authenticated requests
async function initializeGitLab(req, res, next) {
  if (req.session.tokens) {
    try {
      await gitlab.initialize(req.session.tokens.access_token);
      req.gitlab = gitlab;
      next();
    } catch (error) {
      if (error.isAuthError() && req.session.tokens.refresh_token) {
        // Try to refresh the token
        try {
          const newTokens = await gitlab.refreshToken(req.session.tokens.refresh_token);
          req.session.tokens = newTokens.tokenData;
          await gitlab.initialize(newTokens.tokenData.access_token);
          req.gitlab = gitlab;
          next();
        } catch (refreshError) {
          // Refresh failed, require re-authentication
          req.session.destroy();
          res.status(401).json({ 
            error: 'Token expired, please re-authenticate',
            loginUrl: '/auth/gitlab'
          });
        }
      } else {
        res.status(401).json({ 
          error: 'Authentication failed',
          loginUrl: '/auth/gitlab'
        });
      }
    }
  } else {
    next();
  }
}

// Routes

// Home page
app.get('/', (req, res) => {
  res.json({
    message: 'GitLab Wrapper Express Integration',
    authenticated: !!req.session.user,
    user: req.session.user || null,
    endpoints: {
      login: '/auth/gitlab',
      logout: '/auth/logout',
      profile: '/api/profile',
      repositories: '/api/repositories',
      commits: '/api/commits',
      dashboard: '/api/dashboard',
      webhooks: '/webhooks/gitlab'
    }
  });
});

// Authentication routes

// Start OAuth flow
app.get('/auth/gitlab', (req, res) => {
  try {
    const state = req.query.state || null;
    const authData = gitlab.startOAuthFlow(state);
    
    // Store state in session for verification
    req.session.oauthState = authData.state;
    
    res.redirect(authData.url);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OAuth callback
app.get('/auth/gitlab/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      return res.status(400).json({ 
        error: 'OAuth authorization failed',
        details: error
      });
    }
    
    if (!code) {
      return res.status(400).json({ 
        error: 'Authorization code not provided'
      });
    }
    
    // Verify state parameter
    if (state !== req.session.oauthState) {
      return res.status(400).json({ 
        error: 'Invalid state parameter'
      });
    }
    
    // Exchange code for tokens
    const result = await gitlab.completeOAuthFlow(code, state);
    
    // Store user and tokens in session
    req.session.user = result.user;
    req.session.tokens = result.tokenData;
    req.session.oauthState = null; // Clear state
    
    // Redirect to dashboard or return JSON
    if (req.query.format === 'json') {
      res.json({
        success: true,
        user: result.user,
        message: 'Authentication successful'
      });
    } else {
      res.redirect('/api/dashboard');
    }
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(400).json({ 
      error: 'Authentication failed',
      details: error.message
    });
  }
});

// Logout
app.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// API routes

// User profile
app.get('/api/profile', requireAuth, initializeGitLab, async (req, res) => {
  try {
    const user = await req.gitlab.api.getCurrentUser();
    res.json({
      user,
      session: req.session.user,
      tokenInfo: {
        hasToken: !!req.session.tokens,
        expiresAt: req.session.tokens?.expires_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User repositories
app.get('/api/repositories', requireAuth, initializeGitLab, async (req, res) => {
  try {
    const { page = 1, per_page = 20, search, visibility } = req.query;
    
    const options = {
      page: parseInt(page),
      perPage: parseInt(per_page)
    };
    
    if (search) options.search = search;
    if (visibility) options.visibility = visibility;
    
    const repositories = await req.gitlab.getRepositories(options);
    
    res.json({
      repositories,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(per_page),
        total: repositories.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Repository details
app.get('/api/repositories/:id', requireAuth, initializeGitLab, async (req, res) => {
  try {
    const { id } = req.params;
    const repository = await req.gitlab.getRepository(id);
    
    res.json({ repository });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Repository commits
app.get('/api/repositories/:id/commits', requireAuth, initializeGitLab, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, per_page = 20, since, until, author, ref } = req.query;
    
    const options = {
      page: parseInt(page),
      perPage: parseInt(per_page)
    };
    
    if (since) options.since = since;
    if (until) options.until = until;
    if (author) options.author = author;
    if (ref) options.ref = ref;
    
    const commits = await req.gitlab.getCommits(id, options);
    
    res.json({
      commits,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(per_page),
        total: commits.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Commit analytics
app.get('/api/analytics/commits', requireAuth, initializeGitLab, async (req, res) => {
  try {
    const { days = 30, include_stats = true, include_heatmap = true } = req.query;
    
    const activity = await req.gitlab.getCommitActivity({
      days: parseInt(days),
      includeStats: include_stats === 'true',
      includeHeatmap: include_heatmap === 'true',
      includeLanguages: true
    });
    
    res.json({ activity });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard data
app.get('/api/dashboard', requireAuth, initializeGitLab, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const dashboard = await req.gitlab.getDashboardData({
      days: parseInt(days)
    });
    
    res.json({ dashboard });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search repositories
app.get('/api/search/repositories', requireAuth, initializeGitLab, async (req, res) => {
  try {
    const { q, page = 1, per_page = 20, order_by = 'last_activity_at' } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }
    
    const repositories = await req.gitlab.searchRepositories(q, {
      page: parseInt(page),
      perPage: parseInt(per_page),
      orderBy: order_by
    });
    
    res.json({
      query: q,
      repositories,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(per_page),
        total: repositories.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search code
app.get('/api/search/code', requireAuth, initializeGitLab, async (req, res) => {
  try {
    const { q, page = 1, per_page = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }
    
    const results = await req.gitlab.searchCode(q, {
      page: parseInt(page),
      perPage: parseInt(per_page)
    });
    
    res.json({
      query: q,
      results,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(per_page),
        total: results.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Issues
app.get('/api/issues', requireAuth, initializeGitLab, async (req, res) => {
  try {
    const { state = 'opened', page = 1, per_page = 20 } = req.query;
    
    const issues = await req.gitlab.getIssues({
      state,
      page: parseInt(page),
      perPage: parseInt(per_page)
    });
    
    res.json({
      issues,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(per_page),
        total: issues.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Merge requests
app.get('/api/merge-requests', requireAuth, initializeGitLab, async (req, res) => {
  try {
    const { state = 'opened', page = 1, per_page = 20 } = req.query;
    
    const mergeRequests = await req.gitlab.getMergeRequests({
      state,
      page: parseInt(page),
      perPage: parseInt(per_page)
    });
    
    res.json({
      mergeRequests,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(per_page),
        total: mergeRequests.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// System status
app.get('/api/status', (req, res) => {
  const status = gitlab.getStatus();
  const cacheStats = gitlab.getCacheStats();
  const rateLimitStatus = gitlab.getRateLimitStatus();
  
  res.json({
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    },
    gitlab: status,
    cache: cacheStats,
    rateLimit: rateLimitStatus
  });
});

// Webhook endpoint
app.post('/webhooks/gitlab', async (req, res) => {
  try {
    const result = await webhooks.handleWebhook(req.body, req.headers);
    
    res.json({
      success: true,
      processed: result.processed,
      eventType: result.eventInfo?.type,
      project: result.eventInfo?.project?.name
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(400).json({ 
      error: 'Webhook processing failed',
      details: error.message
    });
  }
});

// Webhook management routes
app.get('/api/webhooks/:projectId', requireAuth, initializeGitLab, async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await webhooks.listWebhooks(req.gitlab.api, projectId);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhooks/:projectId', requireAuth, initializeGitLab, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { url, events = ['push'], secretToken } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }
    
    const result = await webhooks.createWebhook(
      req.gitlab.api,
      projectId,
      url,
      events,
      { secretToken }
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Express error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// Event handlers for webhook processing
async function processPushEvent(eventInfo, payload) {
  console.log('Processing push event...');
  
  // Example: Extract and process commits
  const commits = GitLabWebhooks.extractCommitsFromPush(payload);
  
  for (const commit of commits) {
    console.log(`Processing commit: ${commit.id}`);
    // Add your commit processing logic here
    // e.g., trigger builds, send notifications, update databases
  }
}

async function processMergeRequestEvent(eventInfo, payload) {
  console.log('Processing merge request event...');
  
  if (eventInfo.object.action === 'opened') {
    console.log('New merge request opened - notifying reviewers');
    // Add your notification logic here
  } else if (eventInfo.object.action === 'merged') {
    console.log('Merge request merged - triggering deployment');
    // Add your deployment logic here
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('  GET  /                     - API information');
  console.log('  GET  /auth/gitlab          - Start OAuth flow');
  console.log('  GET  /auth/gitlab/callback - OAuth callback');
  console.log('  POST /auth/logout          - Logout');
  console.log('  GET  /api/profile          - User profile');
  console.log('  GET  /api/repositories     - User repositories');
  console.log('  GET  /api/dashboard        - Dashboard data');
  console.log('  GET  /api/status           - System status');
  console.log('  POST /webhooks/gitlab      - GitLab webhook endpoint');
  console.log('\n🔐 Make sure to set these environment variables:');
  console.log('  GITLAB_CLIENT_ID');
  console.log('  GITLAB_CLIENT_SECRET');
  console.log('  GITLAB_REDIRECT_URI (optional)');
  console.log('  GITLAB_URL (optional)');
  console.log('  GITLAB_WEBHOOK_SECRET (optional)');
  console.log('  SESSION_SECRET');
});

export default app;