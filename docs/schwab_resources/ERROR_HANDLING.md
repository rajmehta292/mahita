# Error Handling and Token Refresh

## Overview

This document provides comprehensive information on how to handle errors in the Schwab API integration and implement token refresh mechanisms.

## Error Types

### OAuth Errors

These errors occur during the OAuth authentication flow:

| Error Code | Description | Cause | Solution |
|------------|-------------|-------|----------|
| `invalid_request` | Invalid request format | Missing parameters, malformed request | Check request parameters |
| `unauthorized_client` | Client not authorized | Invalid client credentials | Verify Client ID/Secret |
| `access_denied` | User denied access | User clicked "Deny" | User must authorize app |
| `unsupported_grant_type` | Invalid grant type | Wrong grant_type value | Use correct grant type |
| `invalid_grant` | Invalid authorization code | Code expired or already used | Re-initiate OAuth flow |
| `invalid_scope` | Invalid scope requested | Requested scope not allowed | Use valid scopes |

### API Errors

These errors occur when making API requests:

| HTTP Status | Description | Cause | Solution |
|-------------|-------------|-------|----------|
| 400 | Bad Request | Invalid parameters | Check request body |
| 401 | Unauthorized | Invalid/expired token | Refresh token |
| 403 | Forbidden | Insufficient permissions | Check account permissions |
| 404 | Not Found | Resource doesn't exist | Verify resource ID |
| 429 | Too Many Requests | Rate limit exceeded | Wait and retry |
| 500 | Server Error | Schwab server issue | Retry later |

### Token Errors

| Error | Description | Solution |
|-------|-------------|----------|
| `token_expired` | Access token expired | Use refresh token |
| `refresh_token_expired` | Refresh token expired | Re-authenticate |
| `invalid_token` | Token is malformed | Re-authenticate |

## Error Handling Implementation

### Basic Error Handler

```typescript
// lib/schwab-errors.ts

export class SchwabError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'SchwabError'
  }
}

export function handleSchwabError(error: any): SchwabError {
  // Handle network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new SchwabError(
      'Unable to connect to Schwab API',
      'NETWORK_ERROR',
      503,
      true
    )
  }

  // Handle timeout errors
  if (error.code === 'ETIMEDOUT') {
    return new SchwabError(
      'Request timed out',
      'TIMEOUT',
      504,
      true
    )
  }

  // Handle Schwab API errors
  if (error.response?.data) {
    const { error: errorCode, error_description: description } = error.response.data
    
    switch (error.response.status) {
      case 401:
        return new SchwabError(
          description || 'Authentication failed',
          errorCode || 'UNAUTHORIZED',
          401,
          true
        )
        
      case 403:
        return new SchwabError(
          description || 'Access forbidden',
          errorCode || 'FORBIDDEN',
          403,
          false
        )
        
      case 429:
        return new SchwabError(
          description || 'Rate limit exceeded',
          errorCode || 'RATE_LIMITED',
          429,
          true
        )
        
      case 500:
      case 502:
      case 503:
        return new SchwabError(
          description || 'Schwab server error',
          errorCode || 'SERVER_ERROR',
          error.response.status,
          true
        )
    }
  }

  // Default error
  return new SchwabError(
    error.message || 'Unknown error',
    'UNKNOWN_ERROR',
    500,
    false
  )
}
```

### API Route Error Handling

```typescript
// app/api/schwab/accounts/route.ts
import { handleSchwabError, SchwabError } from '@/lib/schwab-errors'

export async function GET(request: NextRequest) {
  try {
    // ... main logic
    
    const response = await client.getAccounts()
    return NextResponse.json({ success: true, accounts: response.data })
    
  } catch (error: any) {
    const schwabError = handleSchwabError(error)
    
    console.error('Schwab API Error:', {
      message: schwabError.message,
      code: schwabError.code,
      statusCode: schwabError.statusCode,
      retryable: schwabError.retryable
    })
    
    // Handle specific error types
    if (schwabError.statusCode === 401) {
      return NextResponse.json(
        { 
          error: 'Authentication failed. Please reconnect your Schwab account.',
          code: 'AUTH_FAILED',
          requiresReconnect: true
        },
        { status: 401 }
      )
    }
    
    if (schwabError.statusCode === 429) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please wait and try again.',
          code: 'RATE_LIMITED',
          retryAfter: 60 // seconds
        },
        { status: 429 }
      )
    }
    
    if (schwabError.retryable) {
      return NextResponse.json(
        { 
          error: 'Temporary error. Please try again.',
          code: schwabError.code
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { 
        error: schwabError.message,
        code: schwabError.code
      },
      { status: schwabError.statusCode }
    )
  }
}
```

### Frontend Error Handling

```typescript
// Using the accounts API
async function fetchAccounts() {
  try {
    const response = await fetch('/api/schwab/accounts')
    const data = await response.json()
    
    if (!response.ok) {
      // Handle specific error codes
      if (data.requiresReconnect) {
        // Show reconnection prompt
        showReconnectPrompt()
        return
      }
      
      if (data.code === 'RATE_LIMITED') {
        // Show rate limit message
        showRateLimitMessage(data.retryAfter)
        return
      }
      
      throw new Error(data.error)
    }
    
    // Success - update UI
    updateAccountsUI(data.accounts)
    
  } catch (error: any) {
    console.error('Failed to fetch accounts:', error)
    showErrorMessage(error.message)
  }
}

function showReconnectPrompt() {
  alert('Your Schwab session has expired. Please reconnect your account.')
  // Trigger OAuth flow
  handleConnect()
}

function showRateLimitMessage(retryAfter: number) {
  alert(`Too many requests. Please wait ${retryAfter} seconds.`)
}
```

## Token Refresh Mechanism

### When to Refresh Tokens

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TOKEN REFRESH DECISION TREE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BEFORE MAKING API REQUEST                                                  │
│         │                                                                    │
│         ▼                                                                    │
│  Is access token present?                                                    │
│    │                                                                       │
│    ├── NO ──────────────────► Show "Connect Schwab" prompt                │
│    │                                                                       │
│    ▼                                                                       │
│  Is access token expired?                                                   │
│    │                                                                       │
│    ├── YES ─────────────────► Use refresh token to get new access token    │
│    │                              │                                         │
│    │                              ▼                                         │
│    │                         Refresh successful?                            │
│    │                              │                                         │
│    │                    ┌───────┴───────┐                                  │
│    │                    │               │                                  │
│    │                   YES             NO                                   │
│    │                    │               │                                  │
│    │                    ▼               ▼                                  │
│    │              Proceed with    Show "Reconnect"                         │
│    │              new token        prompt                                  │
│    │                                                                       │
│    ▼                                                                       │
│  Make API request with token                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Token Refresh Implementation

```typescript
// lib/token-manager.ts

interface TokenInfo {
  accessToken: string
  refreshToken: string
  accessTokenExpiry: Date | null
  refreshTokenExpiry: Date | null
}

export class TokenManager {
  private userId: string
  private clientId: string
  private clientSecret: string
  
  constructor(userId: string, clientId: string, clientSecret: string) {
    this.userId = userId
    this.clientId = clientId
    this.clientSecret = clientSecret
  }
  
  /**
   * Check if access token needs refresh
   * Returns true if token is expired or will expire within 5 minutes
   */
  needsRefresh(tokenInfo: TokenInfo): boolean {
    if (!tokenInfo.accessTokenExpiry) {
      return true // No expiry info, assume needs refresh
    }
    
    const now = new Date()
    const buffer = 5 * 60 * 1000 // 5 minutes buffer
    
    return tokenInfo.accessTokenExpiry.getTime() - buffer < now.getTime()
  }
  
  /**
   * Refresh the access token using the refresh token
   */
  async refreshAccessToken(currentRefreshToken: string): Promise<TokenInfo> {
    console.log(`Refreshing access token for user: ${this.userId}`)
    
    const response = await fetch('https://api.schwabapi.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: currentRefreshToken,
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error('Token refresh failed:', error)
      throw new Error('TOKEN_REFRESH_FAILED')
    }
    
    const tokens = await response.json()
    
    // Calculate new expiry times
    const now = new Date()
    const accessTokenExpiry = new Date(now.getTime() + tokens.expires_in * 1000)
    const refreshTokenExpiry = new Date(now.getTime() + tokens.refresh_token_expires_in * 1000)
    
    // Update database with new tokens
    await prisma.schwabConfig.update({
      where: { userId: this.userId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiry,
        refreshTokenExpiry,
        updatedAt: new Date(),
      }
    })
    
    console.log(`Token refresh successful for user: ${this.userId}`)
    
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiry,
      refreshTokenExpiry,
    }
  }
  
  /**
   * Check if refresh token itself is expired
   */
  isRefreshTokenExpired(tokenInfo: TokenInfo): boolean {
    if (!tokenInfo.refreshTokenExpiry) {
      return true
    }
    return tokenInfo.refreshTokenExpiry <= new Date()
  }
  
  /**
   * Get valid token, refreshing if necessary
   */
  async getValidToken(): Promise<TokenInfo> {
    // Get current tokens from database
    const config = await prisma.schwabConfig.findUnique({
      where: { userId: this.userId }
    })
    
    if (!config) {
      throw new Error('NO_CONFIG')
    }
    
    const tokenInfo: TokenInfo = {
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
      accessTokenExpiry: config.accessTokenExpiry,
      refreshTokenExpiry: config.refreshTokenExpiry,
    }
    
    // Check if refresh token is expired
    if (this.isRefreshTokenExpired(tokenInfo)) {
      throw new Error('REFRESH_TOKEN_EXPIRED')
    }
    
    // Check if access token needs refresh
    if (this.needsRefresh(tokenInfo)) {
      try {
        return await this.refreshAccessToken(tokenInfo.refreshToken)
      } catch (error) {
        throw new Error('TOKEN_REFRESH_FAILED')
      }
    }
    
    return tokenInfo
  }
}
```

### Using Token Manager in API Routes

```typescript
// app/api/schwab/accounts/route.ts
export async function GET(request: NextRequest) {
  try {
    // Validate session
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { schwabConfig: true }
    })
    
    if (!user?.schwabConfig) {
      return NextResponse.json(
        { error: 'Schwab not configured' },
        { status: 400 }
      )
    }
    
    const config = user.schwabConfig
    
    // Initialize token manager
    const tokenManager = new TokenManager(
      user.id,
      config.clientId,
      config.clientSecret
    )
    
    // Get valid token (auto-refresh if needed)
    let tokenInfo
    try {
      tokenInfo = await tokenManager.getValidToken()
    } catch (error: any) {
      if (error.message === 'REFRESH_TOKEN_EXPIRED') {
        return NextResponse.json(
          { 
            error: 'Session expired. Please reconnect your Schwab account.',
            requiresReconnect: true 
          },
          { status: 401 }
        )
      }
      throw error
    }
    
    // Create client and make request
    const client = getSchwabClient({
      clientId: config.clientId,
      callbackUrl: callbackUrl
    })
    
    client.setAccessToken(
      tokenInfo.accessToken,
      tokenInfo.refreshToken,
      tokenInfo.accessTokenExpiry 
        ? Math.floor((tokenInfo.accessTokenExpiry.getTime() - Date.now()) / 1000)
        : undefined,
      tokenInfo.refreshTokenExpiry
        ? Math.floor((tokenInfo.refreshTokenExpiry.getTime() - Date.now()) / 1000)
        : undefined
    )
    
    const response = await client.getAccounts()
    
    return NextResponse.json({
      success: true,
      accounts: response.data,
    })
    
  } catch (error: any) {
    console.error('Accounts API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}
```

## Automatic Retry Logic

### Retry with Exponential Backoff

```typescript
// lib/retry.ts

interface RetryOptions {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
}

const defaultOptions: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options }
  let lastError: Error
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      // Don't retry on non-retryable errors
      if (!isRetryableError(error)) {
        throw error
      }
      
      // Don't wait after last attempt
      if (attempt === opts.maxRetries) {
        break
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      )
      
      console.log(`Retry attempt ${attempt + 1} after ${delay}ms`)
      await sleep(delay)
    }
  }
  
  throw lastError!
}

function isRetryableError(error: any): boolean {
  // Network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return true
  }
  
  // HTTP errors with retryable status codes
  if (error.response?.status) {
    const retryableStatuses = [408, 429, 500, 502, 503, 504]
    return retryableStatuses.includes(error.response.status)
  }
  
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### Using Retry in API Routes

```typescript
// Example: Using retry logic
async function fetchWithRetry(accountId: string, client: SchwabClient) {
  return withRetry(
    async () => {
      const response = await client.getAccount(accountId)
      if (!response.data) {
        throw new Error('Empty response')
      }
      return response.data
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
    }
  )
}
```

## Error Recovery Strategies

### Strategy 1: Token Refresh on 401

```typescript
// Wrapper to auto-refresh on 401
async function withAutoRefresh(
  userId: string,
  operation: (client: SchwabClient) => Promise<any>
) {
  const config = await getUserConfig(userId)
  const client = createClient(config)
  
  try {
    return await operation(client)
  } catch (error: any) {
    // Check if it's a 401 error
    if (error.response?.status === 401) {
      console.log('Token expired, refreshing...')
      
      // Try to refresh token
      const newConfig = await refreshToken(userId, config.refreshToken)
      
      // Retry with new token
      const newClient = createClient(newConfig)
      return await operation(newClient)
    }
    
    throw error
  }
}
```

### Strategy 2: Circuit Breaker

```typescript
// lib/circuit-breaker.ts

class CircuitBreaker {
  private failures = 0
  private lastFailureTime: Date | null = null
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if circuit should be half-open
      if (this.lastFailureTime && 
          Date.now() - this.lastFailureTime.getTime() > this.timeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }
    
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess() {
    this.failures = 0
    this.state = 'closed'
  }
  
  private onFailure() {
    this.failures++
    this.lastFailureTime = new Date()
    
    if (this.failures >= this.threshold) {
      this.state = 'open'
    }
  }
}

// Usage
const breaker = new CircuitBreaker()

async function getAccounts() {
  return breaker.execute(async () => {
    const client = getSchwabClient(...)
    return await client.getAccounts()
  })
}
```

## User-Facing Error Messages

### Error Message Mapping

| Error Code | User Message | Action |
|------------|--------------|--------|
| `NOT_CONNECTED` | "Please connect your Schwab account first" | Show connect button |
| `AUTH_FAILED` | "Authentication failed. Please reconnect." | Trigger OAuth flow |
| `REFRESH_TOKEN_EXPIRED` | "Your session has expired. Please reconnect." | Trigger OAuth flow |
| `RATE_LIMITED` | "Too many requests. Please wait a moment." | Show retry button |
| `NETWORK_ERROR` | "Unable to connect. Please check your internet." | Show retry button |
| `ACCOUNT_NOT_FOUND` | "Account not found" | Refresh account list |
| `INSUFFICIENT_PERMISSIONS` | "You don't have permission for this action" | Show help message |

---

## Related Documentation

- [OAUTH_IMPLEMENTATION.md](./OAUTH_IMPLEMENTATION.md) - OAuth flow details
- [MULTI_USER_SESSIONS.md](./MULTI_USER_SESSIONS.md) - Session management
- [TOKEN_SECURITY.md](./TOKEN_SECURITY.md) - Token storage security

---

**Last Updated**: 2026-03-07
**Version**: 1.0.0
