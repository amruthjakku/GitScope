/**
 * Basic GitLab Wrapper Usage Examples
 * 
 * This file demonstrates basic usage patterns for the GitLab wrapper
 */

import { GitLabWrapper, GitLabAPI, GitLabAnalytics } from '../index.js';

// Example 1: Basic OAuth Flow
async function basicOAuthExample() {
  console.log('🔐 Basic OAuth Example');
  console.log('=====================');

  const gitlab = new GitLabWrapper({
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    redirectUri: 'http://localhost:3000/auth/callback',
    gitlabUrl: 'https://code.swecha.org'
  });

  // Start OAuth flow
  const authData = gitlab.startOAuthFlow();
  console.log('Visit this URL to authorize:', authData.url);
  console.log('State parameter:', authData.state);

  // After user authorization, you'll receive a code
  // const result = await gitlab.completeOAuthFlow(authorizationCode, authData.state);
  // console.log('Authenticated user:', result.user);
  // console.log('Access token:', result.tokenData.access_token);
}

// Example 2: Direct API Usage with Token
async function directApiExample() {
  console.log('\n🚀 Direct API Example');
  console.log('=====================');

  // If you already have an access token
  const api = new GitLabAPI('your-access-token', {
    gitlabUrl: 'https://code.swecha.org'
  });

  try {
    // Get current user
    const user = await api.getCurrentUser();
    console.log('Current user:', user.username);

    // Get user projects
    const projects = await api.getUserProjects({ perPage: 5 });
    console.log(`Found ${projects.length} projects:`);
    projects.forEach(project => {
      console.log(`  - ${project.name} (${project.visibility})`);
    });

    // Test connection
    const connectionTest = await api.testConnection();
    console.log('Connection test:', connectionTest.success ? '✅ Success' : '❌ Failed');

  } catch (error) {
    console.error('API Error:', error.message);
  }
}

// Example 3: Repository Operations
async function repositoryExample() {
  console.log('\n📁 Repository Operations Example');
  console.log('================================');

  const gitlab = new GitLabWrapper({
    // ... your config
  });

  // Assume we're already authenticated
  // await gitlab.initialize('your-access-token');

  try {
    // Get repositories
    const repos = await gitlab.getRepositories({
      orderBy: 'last_activity_at',
      perPage: 10
    });

    console.log(`Found ${repos.length} repositories`);

    if (repos.length > 0) {
      const firstRepo = repos[0];
      console.log(`\nAnalyzing repository: ${firstRepo.name}`);

      // Get repository details
      const repoDetails = await gitlab.getRepository(firstRepo.id);
      console.log(`Description: ${repoDetails.description || 'No description'}`);
      console.log(`Default branch: ${repoDetails.default_branch}`);
      console.log(`Last activity: ${repoDetails.last_activity_at}`);

      // Get recent commits
      const commits = await gitlab.getCommits(firstRepo.id, {
        perPage: 5
      });

      console.log(`\nRecent commits (${commits.length}):`);
      commits.forEach(commit => {
        console.log(`  ${commit.short_id}: ${commit.title}`);
        console.log(`    Author: ${commit.author_name}`);
        console.log(`    Date: ${commit.created_at}`);
      });

      // Get repository tree
      const tree = await gitlab.getRepositoryTree(firstRepo.id, {
        path: '',
        recursive: false
      });

      console.log(`\nRepository structure (${tree.length} items):`);
      tree.slice(0, 10).forEach(item => {
        const icon = item.type === 'tree' ? '📁' : '📄';
        console.log(`  ${icon} ${item.name}`);
      });
    }

  } catch (error) {
    console.error('Repository Error:', error.message);
  }
}

// Example 4: Commit Analytics
async function analyticsExample() {
  console.log('\n📊 Analytics Example');
  console.log('====================');

  const gitlab = new GitLabWrapper({
    // ... your config
  });

  // Assume we're already authenticated
  // await gitlab.initialize('your-access-token');

  try {
    // Get commit activity for the last 30 days
    const activity = await gitlab.getCommitActivity({
      days: 30,
      includeStats: true,
      includeHeatmap: true,
      includeLanguages: true
    });

    console.log('📈 Commit Activity Summary:');
    console.log(`Total commits: ${activity.totalCommits}`);
    console.log(`Active projects: ${activity.activeProjects}`);

    if (activity.statistics) {
      console.log(`Current streak: ${activity.statistics.streak.current} days`);
      console.log(`Longest streak: ${activity.statistics.streak.longest} days`);
      console.log(`Average commits per day: ${activity.statistics.averages.commitsPerDay}`);
      console.log(`Most active day: ${activity.statistics.patterns.mostActiveDay}`);
      console.log(`Most active hour: ${activity.statistics.patterns.mostActiveHour}`);
    }

    // Language breakdown
    if (activity.languages && activity.languages.languages.length > 0) {
      console.log('\n🔤 Language Breakdown:');
      activity.languages.languages.slice(0, 5).forEach(lang => {
        console.log(`  ${lang.language}: ${lang.averagePercentage}% (${lang.projectCount} projects)`);
      });
    }

    // Recent commits
    if (activity.commits.length > 0) {
      console.log('\n📝 Recent Commits:');
      activity.commits.slice(0, 5).forEach(commit => {
        console.log(`  ${commit.short_id}: ${commit.title}`);
        console.log(`    Project: ${commit.project.name}`);
        console.log(`    Date: ${commit.created_at}`);
      });
    }

  } catch (error) {
    console.error('Analytics Error:', error.message);
  }
}

// Example 5: Search Operations
async function searchExample() {
  console.log('\n🔍 Search Example');
  console.log('=================');

  const gitlab = new GitLabWrapper({
    // ... your config
  });

  // Assume we're already authenticated
  // await gitlab.initialize('your-access-token');

  try {
    // Search repositories
    const repos = await gitlab.searchRepositories('react', {
      perPage: 5
    });

    console.log(`Found ${repos.length} repositories matching "react":`);
    repos.forEach(repo => {
      console.log(`  - ${repo.name} (${repo.path_with_namespace})`);
      console.log(`    Description: ${repo.description || 'No description'}`);
      console.log(`    Stars: ${repo.star_count || 0}`);
    });

    // Search code
    const codeResults = await gitlab.searchCode('function', {
      perPage: 3
    });

    console.log(`\nFound ${codeResults.length} code matches for "function":`);
    codeResults.forEach(result => {
      console.log(`  - ${result.filename} in ${result.project_id}`);
      console.log(`    ${result.data.substring(0, 100)}...`);
    });

  } catch (error) {
    console.error('Search Error:', error.message);
  }
}

// Example 6: Issues and Merge Requests
async function issuesAndMRsExample() {
  console.log('\n📋 Issues and Merge Requests Example');
  console.log('====================================');

  const gitlab = new GitLabWrapper({
    // ... your config
  });

  // Assume we're already authenticated
  // await gitlab.initialize('your-access-token');

  try {
    // Get user's issues
    const issues = await gitlab.getIssues({
      state: 'opened',
      perPage: 5
    });

    console.log(`Open issues assigned to you: ${issues.length}`);
    issues.forEach(issue => {
      console.log(`  #${issue.iid}: ${issue.title}`);
      console.log(`    Project: ${issue.project_id}`);
      console.log(`    Created: ${issue.created_at}`);
      console.log(`    Labels: ${issue.labels.join(', ') || 'None'}`);
    });

    // Get user's merge requests
    const mergeRequests = await gitlab.getMergeRequests({
      state: 'opened',
      perPage: 5
    });

    console.log(`\nOpen merge requests: ${mergeRequests.length}`);
    mergeRequests.forEach(mr => {
      console.log(`  !${mr.iid}: ${mr.title}`);
      console.log(`    ${mr.source_branch} → ${mr.target_branch}`);
      console.log(`    Status: ${mr.merge_status}`);
      console.log(`    Created: ${mr.created_at}`);
    });

  } catch (error) {
    console.error('Issues/MRs Error:', error.message);
  }
}

// Example 7: Dashboard Data
async function dashboardExample() {
  console.log('\n📊 Dashboard Data Example');
  console.log('=========================');

  const gitlab = new GitLabWrapper({
    // ... your config
  });

  // Assume we're already authenticated
  // await gitlab.initialize('your-access-token');

  try {
    // Get comprehensive dashboard data
    const dashboard = await gitlab.getDashboardData({
      days: 30
    });

    console.log('👤 User Information:');
    console.log(`Name: ${dashboard.user.name}`);
    console.log(`Username: ${dashboard.user.username}`);
    console.log(`Email: ${dashboard.user.email}`);

    console.log(`\n📁 Repositories: ${dashboard.repositories.length}`);
    console.log(`📋 Open Issues: ${dashboard.issues.length}`);
    console.log(`🔀 Open Merge Requests: ${dashboard.mergeRequests.length}`);

    if (dashboard.commitActivity) {
      console.log(`📈 Commits (last 30 days): ${dashboard.commitActivity.totalCommits}`);
      console.log(`🏗️ Active Projects: ${dashboard.commitActivity.activeProjects}`);
    }

    console.log(`\n🎯 Recent Activity: ${dashboard.recentActivity.length} events`);
    dashboard.recentActivity.slice(0, 3).forEach(event => {
      console.log(`  - ${event.action_name} on ${event.target_type}`);
      console.log(`    ${event.created_at}`);
    });

    // Check for any errors
    if (dashboard.errors && dashboard.errors.length > 0) {
      console.log('\n⚠️ Some data could not be fetched:');
      dashboard.errors.forEach(error => {
        console.log(`  - ${error.type}: ${error.error}`);
      });
    }

  } catch (error) {
    console.error('Dashboard Error:', error.message);
  }
}

// Example 8: Error Handling
async function errorHandlingExample() {
  console.log('\n🚨 Error Handling Example');
  console.log('=========================');

  const gitlab = new GitLabWrapper({
    // ... your config
  });

  try {
    // This will fail if not authenticated
    await gitlab.getRepositories();
  } catch (error) {
    console.log('Caught error:', error.name);
    console.log('Error message:', error.message);
    console.log('Error code:', error.code);

    // Handle different error types
    if (error.isAuthError()) {
      console.log('🔐 This is an authentication error - user needs to log in');
    } else if (error.isPermissionError()) {
      console.log('🚫 This is a permission error - user lacks required permissions');
    } else if (error.isRetryable()) {
      console.log('🔄 This error is retryable - could try again later');
    } else {
      console.log('❌ This is a non-retryable error');
    }
  }
}

// Example 9: Cache and Rate Limiting
async function cacheAndRateLimitExample() {
  console.log('\n⚡ Cache and Rate Limiting Example');
  console.log('==================================');

  const gitlab = new GitLabWrapper({
    // ... your config
    enableCache: true,
    enableRateLimit: true,
    cache: {
      ttl: 300, // 5 minutes
      maxSize: 1000
    },
    rateLimit: {
      requestsPerMinute: 600,
      enableQueuing: true
    }
  });

  // Assume we're already authenticated
  // await gitlab.initialize('your-access-token');

  // Get cache statistics
  const cacheStats = gitlab.getCacheStats();
  if (cacheStats) {
    console.log('📦 Cache Statistics:');
    console.log(`Hit rate: ${cacheStats.hitRate}`);
    console.log(`Total requests: ${cacheStats.totalRequests}`);
    console.log(`Cache size: ${cacheStats.cacheSize}`);
  }

  // Get rate limit status
  const rateLimitStatus = gitlab.getRateLimitStatus();
  if (rateLimitStatus) {
    console.log('\n🚦 Rate Limit Status:');
    console.log(`Remaining tokens: ${rateLimitStatus.remainingTokens}`);
    console.log(`Requests per minute: ${rateLimitStatus.requestsPerMinute}`);
    console.log(`Queue size: ${rateLimitStatus.queueSize}`);
    console.log(`Is rate limited: ${rateLimitStatus.isRateLimited}`);
  }

  // Clear cache if needed
  // gitlab.clearCache();
  // console.log('Cache cleared');
}

// Run examples
async function runExamples() {
  console.log('🚀 GitLab Wrapper Examples');
  console.log('===========================\n');

  // Note: These examples assume you have proper credentials
  // Uncomment and modify as needed for your use case

  await basicOAuthExample();
  await directApiExample();
  // await repositoryExample();
  // await analyticsExample();
  // await searchExample();
  // await issuesAndMRsExample();
  // await dashboardExample();
  await errorHandlingExample();
  await cacheAndRateLimitExample();

  console.log('\n✅ Examples completed!');
}

// Export for use in other files
export {
  basicOAuthExample,
  directApiExample,
  repositoryExample,
  analyticsExample,
  searchExample,
  issuesAndMRsExample,
  dashboardExample,
  errorHandlingExample,
  cacheAndRateLimitExample,
  runExamples
};

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(console.error);
}