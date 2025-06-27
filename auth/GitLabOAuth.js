/**
 * GitLab OAuth Authentication Handler
 * 
 * Handles OAuth 2.0 authentication flow with GitLab
 * Supports authorization code flow and token refresh
 */

import { GitLabAuthError } from '../errors/GitLabErrors.js';
import { GITLAB_ENDPOINTS, GITLAB_SCOPES, ERROR_CODES } from '../config/constants.js';
import { generateRandomString, validateUrl } from '../utils/helpers.js';

export class GitLabOAuth {
  constructor(config) {
    this.config = this._validateConfig(config);
    this.eventHandlers = new Map();
  }

  /**
   * Validate OAuth configuration
   */
  _validateConfig(config) {
    const required = ['clientId', 'clientSecret', 'redirectUri'];
    const missing = required.filter(key => !config[key]);
    
    if (missing.length > 0) {
      throw new GitLabAuthError(
        `Missing required OAuth configuration: ${missing.join(', ')}`,
        ERROR_CODES.MISSING_CREDENTIALS
      );
    }

    if (!validateUrl(config.redirectUri)) {
      throw new GitLabAuthError(
        'Invalid redirect URI format',
        ERROR_CODES.INVALID_CONFIG
      );
    }

    return {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      gitlabUrl: config.gitlabUrl || 'https://code.swecha.org',
      scopes: config.scopes || [GITLAB_SCOPES.READ_API, GITLAB_SCOPES.READ_USER, GITLAB_SCOPES.READ_REPOSITORY],
      responseType: config.responseType || 'code',
      ...config
    };
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  getAuthorizationUrl(state = null, additionalParams = {}) {
    try {
      const authState = state || generateRandomString(32);
      const scopes = Array.isArray(this.config.scopes) 
        ? this.config.scopes.join(' ') 
        : this.config.scopes;

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        redirect_uri: this.config.redirectUri,
        response_type: this.config.responseType,
        scope: scopes,
        state: authState,
        ...additionalParams
      });

      const authUrl = `${this.config.gitlabUrl}${GITLAB_ENDPOINTS.OAUTH_AUTHORIZE}?${params.toString()}`;
      
      return {
        url: authUrl,
        state: authState,
        scopes: this.config.scopes
      };
    } catch (error) {
      throw new GitLabAuthError(
        `Failed to generate authorization URL: ${error.message}`,
        ERROR_CODES.INVALID_CONFIG,
        error
      );
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, state = null) {
    try {
      const tokenUrl = `${this.config.gitlabUrl}${GITLAB_ENDPOINTS.OAUTH_TOKEN}`;
      
      const requestBody = {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri
      };

      if (state) {
        requestBody.state = state;
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await this._parseErrorResponse(response);
        throw new GitLabAuthError(
          `Token exchange failed: ${errorData.error_description || errorData.error || 'Unknown error'}`,
          ERROR_CODES.INVALID_TOKEN,
          errorData
        );
      }

      const tokenData = await response.json();
      
      if (!tokenData.access_token) {
        throw new GitLabAuthError(
          'No access token received from GitLab',
          ERROR_CODES.INVALID_TOKEN,
          tokenData
        );
      }

      // Enhance token data with metadata
      const enhancedTokenData = {
        ...tokenData,
        obtained_at: new Date().toISOString(),
        expires_at: tokenData.expires_in 
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        scopes: tokenData.scope ? tokenData.scope.split(' ') : this.config.scopes
      };

      this.emit('tokenObtained', enhancedTokenData);
      
      return enhancedTokenData;
    } catch (error) {
      this.emit('authError', error);
      
      if (error instanceof GitLabAuthError) {
        throw error;
      }
      
      throw new GitLabAuthError(
        `Failed to exchange code for token: ${error.message}`,
        ERROR_CODES.NETWORK_ERROR,
        error
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const tokenUrl = `${this.config.gitlabUrl}${GITLAB_ENDPOINTS.OAUTH_TOKEN}`;
      
      const requestBody = {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      };

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await this._parseErrorResponse(response);
        throw new GitLabAuthError(
          `Token refresh failed: ${errorData.error_description || errorData.error || 'Unknown error'}`,
          ERROR_CODES.TOKEN_EXPIRED,
          errorData
        );
      }

      const tokenData = await response.json();
      
      if (!tokenData.access_token) {
        throw new GitLabAuthError(
          'No access token received during refresh',
          ERROR_CODES.TOKEN_EXPIRED,
          tokenData
        );
      }

      // Enhance token data with metadata
      const enhancedTokenData = {
        ...tokenData,
        refreshed_at: new Date().toISOString(),
        expires_at: tokenData.expires_in 
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        scopes: tokenData.scope ? tokenData.scope.split(' ') : this.config.scopes
      };

      this.emit('tokenRefreshed', enhancedTokenData);
      
      return enhancedTokenData;
    } catch (error) {
      this.emit('authError', error);
      
      if (error instanceof GitLabAuthError) {
        throw error;
      }
      
      throw new GitLabAuthError(
        `Failed to refresh token: ${error.message}`,
        ERROR_CODES.NETWORK_ERROR,
        error
      );
    }
  }

  /**
   * Validate access token by making a test API call
   */
  async validateToken(accessToken) {
    try {
      const userUrl = `${this.config.gitlabUrl}/api/v4/user`;
      
      const response = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await this._parseErrorResponse(response);
        return {
          valid: false,
          error: errorData.message || 'Token validation failed',
          status: response.status
        };
      }

      const userData = await response.json();
      
      return {
        valid: true,
        user: {
          id: userData.id,
          username: userData.username,
          name: userData.name,
          email: userData.email
        },
        validated_at: new Date().toISOString()
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        validated_at: new Date().toISOString()
      };
    }
  }

  /**
   * Parse error response from GitLab
   */
  async _parseErrorResponse(response) {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        const text = await response.text();
        return { error: 'unknown_error', error_description: text };
      }
    } catch (parseError) {
      return { 
        error: 'parse_error', 
        error_description: `Failed to parse error response: ${parseError.message}` 
      };
    }
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
          console.error(`Error in OAuth event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get OAuth configuration (without sensitive data)
   */
  getConfig() {
    return {
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
      gitlabUrl: this.config.gitlabUrl,
      scopes: this.config.scopes,
      responseType: this.config.responseType
    };
  }
}