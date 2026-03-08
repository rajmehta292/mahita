# Schwab OAuth Implementation Guide

## Table of Contents
1. [OAuth 2.0 Overview](#oauth-20-overview)
2. [The OAuth Flow](#the-oauth-flow)
3. [Multi-User Session Management](#multi-user-session-management)
4. [Token Storage and Security](#token-storage-and-security)
5. [Making API Requests](#making-api-requests)
6. [Error Handling](#error-handling)
7. [Token Refresh Mechanism](#token-refresh-mechanism)
8. [Implementation Reference](#implementation-reference)

---

## OAuth 2.0 Overview

OAuth 2.0 is the authorization framework used by Schwab's API. It enables applications to obtain limited access to user accounts without exposing credentials. The flow involves several key components:

### Key OAuth Terms

| Term | Description |
|------|-------------|
| **Client ID** | Unique identifier for your application (App Key) |
| **Client Secret** | Secret key for your application |
| **Authorization Code** | Temporary code exchanged for tokens |
| **Access Token** | Short-lived token for API access (30 minutes) |
| **Refresh Token** | Long-lived token to obtain new access tokens (7 days) |
| **Redirect URI** | Callback URL after authorization |

### Token Lifetimes

| Token Type | Lifetime | Purpose |
|------------|----------|---------|
| Access Token | 30 minutes (1800 seconds) | API requests |
| Refresh Token | 7 days (604800 seconds) | Get new access tokens |

---

## The OAuth Flow

The OAuth flow for Schwab involves these steps:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SCHWAB OAUTH FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. USER CLICKS "CONNECT"                                                    │
│         │                                                                     │
│         ▼                                                                     │
│  2. FRONTEND CALLS /api/schwab/auth?action=authorize                       │
│         │                                                                     │
│         ▼                                                                     │
│  3. BACKEND GENERATES AUTH URL                                              │
│     https://api.schwabapi.com/v1/oauth/authorize?                           │
│       client_id=XXX&redirect_uri=XXX                                         │
│         │                                                                     │
│         ▼                                                                     │
│  4. USER REDIRECTED TO SCHWAB LOGIN                                         │
│     - User enters Schwab credentials                                         │
│     - User authorizes the application                                        │
│         │                                                                     │
│         ▼                                                                     │
│  5. SCHWAB REDIRECTS TO CALLBACK WITH CODE                                 │
│     /schwab/callback?code=AUTHORIZATION_CODE                                │
│         │                                                                     │
│         ▼                                                                     │
│  6. BACKEND EXCHANGES CODE FOR TOKENS                                       │
│     POST to Schwab token endpoint                                            │
│     - access_token                                                           │
│     - refresh_token                                                          │
│     - expires_in                                                             │
│     - refresh_token_expires_in                                               │
│         │                                                                     │
│         ▼                                                                     │
│  7. TOKENS STORED IN DATABASE                                               │
│     Associated with user ID                                                 │
│         │                                                                     │
│         ▼                                                                     │
│  8. USER CAN NOW MAKE API REQUESTS                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Implementation

#### Step 1: Generate Authorization URL

The first step is to generate the authorization URL that redirects users to Schwab's login page.

**API Endpoint:** `GET /api/schwab/auth?action=authorize`

```typescript
// app/api/schwab/auth/route.ts (GET handler)
export async function GET(request: NextRequest) {
  // Get user's credentials from database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { schwabConfig: true }
  })

  const { clientId, clientSecret } = user.schwabConfig
  const callbackUrl = `${process.env.NEXTAUTH_URL}/schwab/callback`

  const client = initializeSchwabClient({
    clientId,
    callbackUrl,
  })

  // Return authorization URL
  const authUrl = client.getAuthorizationUrl()
  // https://api.schwabapi.com/v1/oauth/authorize?client_id=XXX&redirect_uri=XXX
  
  return NextResponse.json({ authUrl })
}
```

**Frontend Implementation:**

```typescript
// Connect button click handler
const handleConnect = async () => {
  const response = await fetch('/api/schwab/auth?action=authorize')
  const { authUrl } = await response.json()
  
  // Open in popup window
  const width = 600, height = 700
  const left = (screen.width - width) / 2
  const top = (screen.height - height) / 2
  
  window.open(
    authUrl,
    'Schwab Authorization',
    `width=${width},height=${height},left=${left},top=${top}`
  )
}
```

#### Step 2: Handle OAuth Callback

After user authorization, Schwab redirects to your callback URL with an authorization code.

**Callback URL:** `/schwab/callback?code=AUTHORIZATION_CODE`

```typescript
// app/schwab/callback/page.tsx
export default function SchwabCallbackPage() {
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const code = searchParams.get('code')
    
    if (code && window.opener) {
      // Send code back to parent window
      window.opener.postMessage({
        type: 'schwab-callback',
        code: code
      }, window.location.origin)
      
      // Close popup
      setTimeout(() => window.close(), 1000)
    }
  }, [searchParams])
  
  // Show loading spinner while processing
  return <div>Completing authorization...</div>
}
```

#### Step 3: Exchange Authorization Code for Tokens

The authorization code must be exchanged for access and refresh tokens immediately (it expires quickly).

**API Endpoint:** `POST /api/schwab/auth`

```typescript
// app/api/schwab/auth/route.ts (POST handler)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { code } = body
  
  // Get user's credentials
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { schwabConfig: true }
  })
  
  const { clientId, clientSecret } = user.schwabConfig
  const callbackUrl = `${process.env.NEXTAUTH_URL}/schwab/callback`
  
  // Create client and authenticate
  const client = getSchwabClient({ clientId, callbackUrl })
  const authResponse = await client.authenticate(code)
  
  // Calculate token expiry times
  const now = new Date()
  const accessTokenExpiry = new Date(
    now.getTime() + (authResponse.expires_in || 1800) * 1000
  )
  const refreshTokenExpiry = new Date(
    now.getTime() + (authResponse.refresh_token_expires_in || 604800) * 1000
  )
  
  // Store tokens in database
  await prisma.schwabConfig.update({
    where: { userId: user.id },
    data: {
      accessToken: authResponse.access_token,
      refreshToken: authResponse.refresh_token,
      accessTokenExpiry,
      refreshTokenExpiry,
      updatedAt: new Date(),
    }
  })
  
  return NextResponse.json({ success: true })
}
```

**Schwab Token Response:**

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...",
  "expires_in": 1800,
  "refresh_token_expires_in": 604800,
  "token_type": "Bearer"
}
```

---

## Multi-User Session Management

The system supports multiple users, each with their own Schwab credentials and OAuth tokens. Here's how it works:

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MULTI-USER SESSION ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                    │
│  │   USER A    │     │   USER B    │     │   USER C    │                    │
│  │  (raj...)   │     │  (dh...)    │     │  (other)    │                    │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                    │
│         │                    │                    │                          │
│         ▼                    ▼                    ▼                          │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                      DATABASE                                    │       │
│  │  ┌─────────────────────────────────────────────────────────┐   │       │
│  │  │ SchwabConfig Table                                       │   │       │
│  │  │ ┌──────────┬───────────┬────────────┬────────────────┐  │   │       │
│  │  │ │ userId   │ clientId  │ accessToken│ refreshToken   │  │   │       │
│  │  │ ├──────────┼───────────┼────────────┼────────────────┤  │   │       │
│  │  │ │ user_a_1 │ clt_xxx_1 │ token_aaa  │ refresh_aaa    │  │   │       │
│  │  │ │ user_b_1 │ clt_xxx_2 │ token_bbb  │ refresh_bbb    │  │   │       │
│  │  │ │ user_c_1 │ clt_xxx_3 │ token_ccc  │ refresh_ccc    │  │   │       │
│  │  │ └──────────┴───────────┴────────────┴────────────────┘  │   │       │
│  │  └─────────────────────────────────────────────────────────┘   │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  Each user's tokens are isolated and associated with their userId          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Session Isolation

Each user's session is completely isolated:

1. **NextAuth Session**: Users authenticate via Google OAuth or credentials
2. **User Context**: Each request is tied to the authenticated user's email
3. **Token Isolation**: Database queries filter by `userId` to ensure users only access their own tokens

### Implementation

```typescript
// Every API request validates the user's session
export async function GET(request: NextRequest) {
  // 1. Get the authenticated session
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // 2. Fetch user-specific data using their email
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { schwabConfig: true }
  })
  
  // 3. Only this user's tokens are accessible
  const tokens = user.schwabConfig
  // ✓ Access user's own tokens
  // ✗ Cannot access other users' tokens
}
```

### Token Refresh Per User

When a user's access token expires, only that specific user's tokens are refreshed:

```typescript
// Per-user token refresh
async function refreshUserToken(userId: string, refreshToken: string) {
  // Only refresh THIS user's tokens
  const response = await fetch('https://api.schwabapi.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
  })
  
  const newTokens = await response.json()
  
  // Update only this user's tokens
  await prisma.schwabConfig.update({
    where: { userId },
    data: {
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token,
      accessTokenExpiry: new Date(Date.now() + newTokens.expires_in * 1000),
      refreshTokenExpiry: new Date(Date.now() + newTokens.refresh_token_expires_in * 1000),
    }
  })
}
```

---

## Token Storage and Security

### Database Schema

Tokens are stored securely in the SQLite database using Prisma:

```prisma
// prisma/schema.prisma
model SchwabConfig {
  id                   String    @id @default(cuid())
  userId               String    @unique
  clientId             String
  clientSecret         String
  accessToken          String?
  refreshToken         String?
  accessTokenExpiry    DateTime?
  refreshTokenExpiry   DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  
  user                 User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Security Measures

| Security Feature | Implementation |
|-----------------|----------------|
| **Per-User Isolation** | Each user's tokens stored with their unique `userId` |
| **Session Validation** | Every API request validates NextAuth session |
| **No Client-Side Storage** | Tokens never exposed to browser JavaScript |
| **Token Expiry Tracking** | `accessTokenExpiry` and `refreshTokenExpiry` fields |
| **Cascade Deletion** | Removing user removes all associated tokens |
| **Credential Encryption** | Client secrets stored in database (not env vars for users) |

### Token Retrieval Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SECURE TOKEN RETRIEVAL                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. BROWSER REQUEST                                                         │
│     GET /api/schwab/accounts                                                │
│     Cookie: next-auth.session-token=XXX                                     │
│                                                                              │
│  2. SERVER VALIDATES SESSION                                                │
│     - Verify JWT token                                                      │
│     - Extract user email                                                    │
│     - Check authorization                                                   │
│                                                                              │
│  3. DATABASE QUERY (User-Specific)                                          │
│     prisma.user.findUnique({                                                │
│       where: { email: session.user.email },                                 │
│       include: { schwabConfig: true }                                       │
│     })                                                                      │
│                                                                              │
│  4. TOKEN RETRIEVAL                                                         │
│     - Only returns tokens for authenticated user                           │
│     - Other users' tokens are NEVER accessible                             │
│                                                                              │
│  5. API REQUEST TO SCHWAB                                                   │
│     Authorization: Bearer <access_token>                                    │
│                                                                              │
│  6. RESPONSE TO CLIENT                                                     │
│     - Only account data returned                                            │
│     - Tokens NEVER sent to client                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Environment Security

For production, consider these additional security measures:

```typescript
// Recommended: Encrypt tokens at rest
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY // 32 bytes
const IV_LENGTH = 16

function encryptToken(token: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decryptToken(encryptedToken: string): string {
  const [ivHex, encrypted] = encryptedToken.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
```

---

## Making API Requests

### Token-Based Authentication

All Schwab API requests require a valid access token in the Authorization header:

```typescript
// Making authenticated requests
const client = getSchwabClient({
  clientId: config.clientId,
  callbackUrl: callbackUrl
})

// Set the user's tokens
client.setAccessToken(
  config.accessToken,
  config.refreshToken,
  // Calculate remaining time until expiry
  config.accessTokenExpiry 
    ? Math.floor((config.accessTokenExpiry.getTime() - Date.now()) / 1000)
    : undefined,
  config.refreshTokenExpiry
    ? Math.floor((config.refreshTokenExpiry.getTime() - Date.now()) / 1000)
    : undefined
)

// Make API calls
const accounts = await client.getAccounts()
const positions = await client.getPositions(accountId)
const quote = await client.getQuote('AAPL')
```

### Complete API Request Flow

```typescript
// app/api/schwab/accounts/route.ts
export async function GET(request: NextRequest) {
  // 1. Validate session
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // 2. Get user's tokens from database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { schwabConfig: true }
  })
  
  const config = user.schwabConfig
  
  // 3. Check if tokens exist
  if (!config.accessToken || !config.refreshToken) {
    return NextResponse.json(
      { error: 'Please connect your Schwab account first' },
      { status: 400 }
    )
  }
  
  // 4. Create client and set tokens
  const client = getSchwabClient({
    clientId: config.clientId,
    callbackUrl: callbackUrl
  })
  
  client.setAccessToken(
    config.accessToken,
    config.refreshToken,
    // Remaining seconds until expiry
    config.accessTokenExpiry 
      ? Math.floor((config.accessTokenExpiry.getTime() - Date.now()) / 1000)
      : undefined,
    config.refreshTokenExpiry
      ? Math.floor((config.refreshTokenExpiry.getTime() - Date.now()) / 1000)
      : undefined
  )
  
  // 5. Make API request to Schwab
  const response = await client.getAccounts()
  
  // 6. Return data to client (NOT tokens)
  return NextResponse.json({
    success: true,
    accounts: response.data,
  })
}
```

### Available API Methods

The Schwab client provides these methods:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `getAccounts()` | `/accounts` | Get all accounts |
| `getAccount(id)` | `/accounts/{id}` | Get specific account |
| `getPositions(id)` | `/accounts/{id}` | Get positions |
| `getBalance(id)` | `/accounts/{id}` | Get balance |
| `getQuote(symbol)` | `/quotes/{symbol}` | Get quote |
| `getQuotes(symbols)` | `/quotes` | Get multiple quotes |
| `placeOrder(id, order)` | `/orders` | Place order |
| `cancelOrder(id, orderId)` | `/orders/{id}` | Cancel order |
| `getOrders(id, params)` | `/accounts/{id}/orders` | Get orders |
| `getPriceHistory(symbol, params)` | `/history` | Get price history |
| `getOptionChain(symbol)` | `/options/chains` | Get option chain |

---

## Error Handling

### Common OAuth Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `invalid_request` | Missing or invalid parameters | Check request parameters |
| `unauthorized_client` | Client not authorized | Verify client credentials |
| `access_denied` | User denied access | User must authorize app |
| `unsupported_grant_type` | Invalid grant type | Use correct grant type |
| `invalid_grant` | Invalid/expired authorization code | Re-initiate OAuth flow |
| `invalid_token` | Invalid or expired access token | Refresh or re-authenticate |
| `token_expired` | Access token expired | Use refresh token |

### Error Handling Implementation

```typescript
// Comprehensive error handling
export async function handleSchwabRequest(
  userEmail: string,
  requestFn: (client: SchwabClient) => Promise<any>
) {
  try {
    // Get user configuration
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { schwabConfig: true }
    })
    
    if (!user?.schwabConfig) {
      return { error: 'Schwab credentials not configured', status: 400 }
    }
    
    const config = user.schwabConfig
    
    // Check if tokens exist
    if (!config.accessToken || !config.refreshToken) {
      return { error: 'Please connect your Schwab account', status: 400 }
    }
    
    // Check if access token is expired
    const now = new Date()
    const isAccessTokenExpired = !config.accessTokenExpiry || 
                                  config.accessTokenExpiry <= now
    
    // If access token expired, try to refresh
    if (isAccessTokenExpired) {
      const refreshResult = await refreshToken(user.id, config.refreshToken, config)
      if (!refreshResult.success) {
        return { error: 'Token refresh failed. Please reconnect.', status: 401 }
      }
      
      // Get updated config
      const updatedConfig = await prisma.schwabConfig.findUnique({
        where: { userId: user.id }
      })
      
      config.accessToken = updatedConfig.accessToken
      config.refreshToken = updatedConfig.refreshToken
      config.accessTokenExpiry = updatedConfig.accessTokenExpiry
    }
    
    // Create client with tokens
    const client = getSchwabClient({
      clientId: config.clientId,
      callbackUrl: callbackUrl
    })
    
    client.setAccessToken(
      config.accessToken,
      config.refreshToken,
      config.accessTokenExpiry 
        ? Math.floor((config.accessTokenExpiry.getTime() - Date.now()) / 1000)
        : undefined,
      config.refreshTokenExpiry 
        ? Math.floor((config.refreshTokenExpiry.getTime() - Date.now()) / 1000)
        : undefined
    )
    
    // Execute the request
    const result = await requestFn(client)
    return { success: true, data: result.data }
    
  } catch (error: any) {
    console.error('Schwab API error:', error)
    
    // Handle specific error types
    if (error.response?.status === 401) {
      return { 
        error: 'Authentication failed. Please reconnect your account.', 
        status: 401 
      }
    }
    
    if (error.response?.status === 403) {
      return { 
        error: 'Access denied. Check your trading permissions.', 
        status: 403 
      }
    }
    
    if (error.response?.status === 429) {
      return { 
        error: 'Rate limit exceeded. Please wait and try again.', 
        status: 429 
      }
    }
    
    return { 
      error: error.message || 'Failed to process request', 
      status: 500 
    }
  }
}
```

### Token Expiry Detection

```typescript
// Check if token needs refresh before making request
function isTokenExpired(expiryDate: Date | null): boolean {
  if (!expiryDate) return true
  // Refresh 5 minutes before actual expiry
  const buffer = 5 * 60 * 1000 // 5 minutes
  return new Date(expiryDate.getTime() - buffer) <= new Date()
}

// Usage
const needsRefresh = isTokenExpired(config.accessTokenExpiry)
if (needsRefresh) {
  // Refresh token before making API call
  await refreshToken(userId, config.refreshToken, config)
}
```

---

## Token Refresh Mechanism

### When to Refresh Tokens

Tokens should be refreshed in these scenarios:

1. **Before API Request**: Check if access token is expired
2. **On 401 Response**: Automatic refresh on authentication failure
3. **Scheduled Refresh**: Background job to proactively refresh
4. **User Login**: Verify tokens are valid on session start

### Refresh Token Implementation

```typescript
// Token refresh function
async function refreshToken(
  userId: string,
  currentRefreshToken: string,
  config: SchwabConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Refreshing token for user: ${userId}`)
    
    // Make request to Schwab token endpoint
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
      return { success: false, error: 'Token refresh failed' }
    }
    
    const tokens = await response.json()
    
    // Calculate new expiry times
    const now = new Date()
    const newAccessTokenExpiry = new Date(
      now.getTime() + (tokens.expires_in || 1800) * 1000
    )
    const newRefreshTokenExpiry = new Date(
      now.getTime() + (tokens.refresh_token_expires_in || 604800) * 1000
    )
    
    // Update tokens in database
    await prisma.schwabConfig.update({
      where: { userId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiry: newAccessTokenExpiry,
        refreshTokenExpiry: newRefreshTokenExpiry,
        updatedAt: new Date(),
      }
    })
    
    console.log(`Token refreshed successfully for user: ${userId}`)
    return { success: true }
    
  } catch (error: any) {
    console.error('Token refresh error:', error)
    return { success: false, error: error.message }
  }
}
```

### Automatic Token Refresh Middleware

```typescript
// Middleware to automatically refresh tokens
export async function withTokenRefresh(
  userId: string,
  config: SchwabConfig,
  requestFn: () => Promise<any>
) {
  const now = new Date()
  
  // Check if access token is expired or about to expire
  const accessTokenExpiry = config.accessTokenExpiry?.getTime() || 0
  const shouldRefresh = accessTokenExpiry - now.getTime() < 5 * 60 * 1000 // 5 min buffer
  
  if (shouldRefresh) {
    console.log('Access token expiring soon, refreshing...')
    
    const refreshResult = await refreshToken(
      userId,
      config.refreshToken!,
      config
    )
    
    if (!refreshResult.success) {
      throw new Error('TOKEN_REFRESH_FAILED')
    }
    
    // Get updated config after refresh
    config = await prisma.schwabConfig.findUnique({
      where: { userId }
    })!
  }
  
  // Execute the actual request
  return await requestFn()
}
```

### Token Refresh Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TOKEN REFRESH FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  API REQUEST                                                                │
│         │                                                                    │
│         ▼                                                                    │
│  CHECK: Is access token expired?                                            │
│         │                                                                    │
│    ┌────┴────┐                                                              │
│    │         │                                                              │
│   YES       NO                                                              │
│    │         │                                                              │
│    ▼         ▼                                                              │
│  REFRESH    MAKE                                                           │
│  TOKEN      API                                                             │
│    │        REQUEST                                                         │
│    ▼                                                                        │
│  POST /oauth/token                                                         │
│  grant_type=refresh_token                                                  │
│  refresh_token=XXX                                                         │
│         │                                                                    │
│         ▼                                                                    │
│  SCHWAB RESPONDS                                                           │
│  {                                                                          │
│    "access_token": "new_access_token",                                     │
│    "refresh_token": "new_refresh_token",                                   │
│    "expires_in": 1800,                                                     │
│    "refresh_token_expires_in": 604800                                      │
│  }                                                                          │
│         │                                                                    │
│         ▼                                                                    │
│  UPDATE DATABASE                                                            │
│  - accessToken = new_access_token                                          │
│  - refreshToken = new_refresh_token                                        │
│  - accessTokenExpiry = now + 30min                                         │
│  - refreshTokenExpiry = now + 7days                                        │
│         │                                                                    │
│         ▼                                                                    │
│  RETRY API REQUEST                                                          │
│  (with new access token)                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Handling Refresh Token Expiry

If the refresh token itself expires (after 7 days), the user must re-authenticate:

```typescript
async function handleExpiredRefreshToken(userId: string) {
  // Clear old tokens
  await prisma.schwabConfig.update({
    where: { userId },
    data: {
      accessToken: null,
      refreshToken: null,
      accessTokenExpiry: null,
      refreshTokenExpiry: null,
    }
  })
  
  // Return error indicating user needs to reconnect
  return {
    error: 'Session expired. Please reconnect your Schwab account.',
    code: 'REAUTHENTICATION_REQUIRED',
    requiresReauth: true
  }
}
```

---

## Implementation Reference

### File Structure

```
app/
├── api/
│   ├── schwab/
│   │   ├── auth/route.ts          # OAuth authorization & token exchange
│   │   ├── accounts/route.ts      # Get accounts
│   │   ├── positions/route.ts     # Get positions
│   │   ├── orders/route.ts        # Trading operations
│   │   └── ...
│   └── user/
│       ├── schwab-config/route.ts  # Store credentials
│       └── schwab-tokens/route.ts  # Store/retrieve tokens
├── schwab/
│   └── callback/
│       └── page.tsx               # OAuth callback handler
└── services/
    └── schwab/
        ├── client.ts              # Schwab API client
        └── types.ts               # TypeScript types
```

### API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/schwab/auth?action=authorize` | GET | Get OAuth URL |
| `/api/schwab/auth` | POST | Exchange code for tokens |
| `/api/schwab/accounts` | GET | Get accounts |
| `/api/schwab/positions` | GET | Get positions |
| `/api/schwab/orders` | GET/POST | Manage orders |
| `/api/user/schwab-config` | GET/POST/DELETE | Manage credentials |
| `/api/user/schwab-tokens` | GET/POST | Manage tokens |

### Environment Variables

```env
# NextAuth Configuration
NEXTAUTH_URL=http://mahita.ai
NEXTAUTH_SECRET=your_nextauth_secret

# Google OAuth (for authentication)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Database
DATABASE_URL="file:./dev.db"

# App Settings
USE_MOCK_DATA=false
```

---

## Related Documentation

- [SCHWAB_SETUP.md](../SCHWAB_SETUP.md) - Initial setup guide
- [AUTHENTICATION_SYSTEM.md](../AUTHENTICATION_SYSTEM.md) - Authentication overview
- [ACTIVE_TRADER.md](../ACTIVE_TRADER.md) - Using the trading interface

---

**Last Updated**: 2026-03-07
**Version**: 1.0.0
