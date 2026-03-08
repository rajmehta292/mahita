# Token Storage and Security

## Overview

This document provides detailed information on how OAuth tokens are stored securely and the security measures implemented in Mahita Terminal.

## Token Storage Architecture

### Database Storage

Tokens are stored in the SQLite database via Prisma ORM:

```prisma
model SchwabConfig {
  id                   String    @id @default(cuid())
  userId               String    @unique          // Links to User
  clientId             String                     // OAuth Client ID
  clientSecret         String                     // OAuth Client Secret
  accessToken          String?                   // OAuth Access Token
  refreshToken         String?                   // OAuth Refresh Token
  accessTokenExpiry    DateTime?                 // When access token expires
  refreshTokenExpiry   DateTime?                 // When refresh token expires
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  
  user                 User      @relation(
                          fields: [userId], 
                          references: [id], 
                          onDelete: Cascade
                        )
}
```

### Storage Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TOKEN STORAGE FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. USER COMPLETES OAUTH                                                    │
│     └─ Schwab returns authorization code                                     │
│                                                                              │
│  2. BACKEND EXCHANGES CODE                                                  │
│     └─ POST /oauth/token with code                                          │
│     └─ Receives: { access_token, refresh_token, expires_in, ... }         │
│                                                                              │
│  3. SERVER PROCESSES TOKENS                                                 │
│     └─ Calculate accessTokenExpiry: now + 1800 seconds                    │
│     └─ Calculate refreshTokenExpiry: now + 604800 seconds                  │
│                                                                              │
│  4. STORE IN DATABASE                                                       │
│     └─ prisma.schwabConfig.update({                                         │
│          where: { userId: user.id },                                        │
│          data: {                                                             │
│            accessToken: authResponse.access_token,                          │
│            refreshToken: authResponse.refresh_token,                        │
│            accessTokenExpiry,                                               │
│            refreshTokenExpiry                                                │
│          }                                                                  │
│        })                                                                    │
│                                                                              │
│  5. TOKENS PERSISTED                                                       │
│     └─ Associated with userId in SchwabConfig table                         │
│     └─ Can be retrieved on subsequent requests                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Security Layers

### Layer 1: User Isolation

Each user can only access their own tokens:

```typescript
// Every API request is user-specific
export async function GET(request: NextRequest) {
  // Get the authenticated user's session
  const session = await getServerSession(authOptions)
  
  // This query returns ONLY the authenticated user's data
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },  // ← User's own email
    include: { schwabConfig: true }
  })
  
  // Result: Other users' tokens are never accessible
}
```

### Layer 2: Server-Side Only

Tokens are never exposed to the client:

```typescript
// WRONG: Sending tokens to client (NEVER DO THIS)
return NextResponse.json({
  accessToken: config.accessToken,  // ❌ SECURITY RISK!
  refreshToken: config.refreshToken // ❌ SECURITY RISK!
})

// CORRECT: Only send non-sensitive data
return NextResponse.json({
  hasAccessToken: !!config.accessToken,
  hasRefreshToken: !!config.refreshToken,
  accessTokenExpiry: config.accessTokenExpiry
  // ↑ No actual tokens sent
})
```

### Layer 3: Session Validation

Every request validates authentication:

```typescript
export async function GET(request: NextRequest) {
  // 1. Validate session exists
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // 2. Get user from database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })
  
  // 3. Verify user exists
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  
  // 4. Proceed with user-specific operation
}
```

### Layer 4: Cascade Deletion

When a user is deleted, all their tokens are automatically removed:

```prisma
// If user is deleted, their SchwabConfig is automatically deleted
model SchwabConfig {
  // ...
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## Enhanced Security: Token Encryption

For production environments, consider encrypting tokens at rest:

### Installation

```bash
npm install crypto
```

### Encryption Utility

```typescript
// lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16
const SALT_LENGTH = 32
const KEY_LENGTH = 32
const ITERATIONS = 100000

function getKey(salt: Buffer): Buffer {
  const password = process.env.TOKEN_ENCRYPTION_KEY || 'default-fallback-key'
  return scryptSync(password, salt, KEY_LENGTH, { N: 2 ** ITERATIONS, r: 8, p: 1 })
}

export function encryptToken(plaintext: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const key = getKey(salt)
  const iv = randomBytes(IV_LENGTH)
  
  const cipher = createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  // Store as: salt:iv:encrypted
  return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}`
}

export function decryptToken(encryptedData: string): string {
  const [saltHex, ivHex, encrypted] = encryptedData.split(':')
  
  const salt = Buffer.from(saltHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const key = getKey(salt)
  
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
```

### Using Encryption

```typescript
// When storing tokens
async function storeTokens(userId: string, accessToken: string, refreshToken: string) {
  // Encrypt tokens before storing
  const encryptedAccessToken = encryptToken(accessToken)
  const encryptedRefreshToken = encryptToken(refreshToken)
  
  await prisma.schwabConfig.upsert({
    where: { userId },
    update: {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
    },
    create: {
      userId,
      clientId: '',  // Set these separately
      clientSecret: '',
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
    }
  })
}

// When retrieving tokens
async function getTokens(userId: string) {
  const config = await prisma.schwabConfig.findUnique({
    where: { userId }
  })
  
  if (!config?.accessToken || !config?.refreshToken) {
    return null
  }
  
  return {
    accessToken: decryptToken(config.accessToken),
    refreshToken: decryptToken(config.refreshToken)
  }
}
```

## Environment Security

### Development vs Production

| Environment | Token Storage | Encryption | Session |
|-------------|--------------|------------|---------|
| Development | SQLite DB | None | Credentials provider |
| Production | SQLite DB (or PostgreSQL) | Recommended | Google OAuth |

### Required Environment Variables

```env
# .env.local

# NextAuth (REQUIRED)
NEXTAUTH_URL=http://mahita.ai
NEXTAUTH_SECRET=your-super-secret-key-min-32-chars

# Google OAuth (REQUIRED)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database (REQUIRED)
DATABASE_URL="file:./dev.db"

# Optional: Token Encryption Key (RECOMMENDED for production)
TOKEN_ENCRYPTION_KEY=your-32-character-encryption-key
```

### Security Checklist

- [ ] `NEXTAUTH_SECRET` is at least 32 characters
- [ ] `GOOGLE_CLIENT_SECRET` is kept secure
- [ ] Database file is not committed to git
- [ ] Session cookies are httpOnly
- [ ] HTTPS enforced in production
- [ ] Token encryption enabled for production
- [ ] Regular security audits performed

## Token Lifecycle Management

### Token Storage Process

```typescript
// Complete token storage process
async function saveTokens(userId: string, authResponse: SchwabAuthResponse) {
  const now = new Date()
  
  // Calculate expiry times
  const accessTokenExpiry = new Date(
    now.getTime() + (authResponse.expires_in || 1800) * 1000
  )
  const refreshTokenExpiry = new Date(
    now.getTime() + (authResponse.refresh_token_expires_in || 604800) * 1000
  )
  
  // Save to database
  await prisma.schwabConfig.update({
    where: { userId },
    data: {
      accessToken: authResponse.access_token,
      refreshToken: authResponse.refresh_token,
      accessTokenExpiry,
      refreshTokenExpiry,
      updatedAt: new Date(),
    }
  })
  
  console.log(`Tokens saved for user ${userId}`)
  console.log(`Access token expires: ${accessTokenExpiry}`)
  console.log(`Refresh token expires: ${refreshTokenExpiry}`)
}
```

### Token Retrieval Process

```typescript
// Complete token retrieval process
async function retrieveTokens(userEmail: string) {
  // Get user with their Schwab configuration
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { schwabConfig: true }
  })
  
  if (!user?.schwabConfig) {
    return { error: 'No Schwab configuration found' }
  }
  
  const config = user.schwabConfig
  
  // Validate tokens exist
  if (!config.accessToken || !config.refreshToken) {
    return { error: 'Tokens not found' }
  }
  
  // Check expiry
  const now = new Date()
  const accessTokenValid = config.accessTokenExpiry 
    ? config.accessTokenExpiry > now 
    : false
  const refreshTokenValid = config.refreshTokenExpiry 
    ? config.refreshTokenExpiry > now 
    : false
  
  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
    accessTokenExpiry: config.accessTokenExpiry,
    refreshTokenExpiry: config.refreshTokenExpiry,
    accessTokenValid,
    refreshTokenValid
  }
}
```

### Token Cleanup

```typescript
// Clean up expired tokens
async function cleanupExpiredTokens() {
  const now = new Date()
  
  // Find all configs with expired refresh tokens
  const expiredConfigs = await prisma.schwabConfig.findMany({
    where: {
      refreshTokenExpiry: {
        lt: now
      }
    }
  })
  
  // Clear tokens for expired configs
  for (const config of expiredConfigs) {
    await prisma.schwabConfig.update({
      where: { id: config.id },
      data: {
        accessToken: null,
        refreshToken: null,
        accessTokenExpiry: null,
        refreshTokenExpiry: null,
      }
    })
    
    console.log(`Cleared expired tokens for user ${config.userId}`)
  }
  
  return expiredConfigs.length
}
```

## Access Control

### Endpoint Protection

All Schwab API endpoints require authentication:

```typescript
// app/api/schwab/accounts/route.ts
export async function GET(request: NextRequest) {
  // Middleware: Validate session
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Proceed with user-specific operation
  // ...
}
```

### Token Validation Before Requests

```typescript
// Check token validity before making API calls
async function makeSchwabRequest(
  userEmail: string, 
  requestFn: (client: SchwabClient) => Promise<any>
) {
  // 1. Get user's tokens
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { schwabConfig: true }
  })
  
  const config = user.schwabConfig
  
  // 2. Check if tokens exist
  if (!config.accessToken || !config.refreshToken) {
    throw new Error('NOT_CONNECTED')
  }
  
  // 3. Check if access token is expired
  const now = new Date()
  const isExpired = !config.accessTokenExpiry || 
                    config.accessTokenExpiry <= now
  
  // 4. If expired, try to refresh
  if (isExpired) {
    const refreshed = await refreshToken(user.id, config.refreshToken, config)
    if (!refreshed) {
      throw new Error('TOKEN_REFRESH_FAILED')
    }
  }
  
  // 5. Make the API request
  const client = getSchwabClient({
    clientId: config.clientId,
    callbackUrl: callbackUrl
  })
  
  client.setAccessToken(config.accessToken, config.refreshToken)
  
  return await requestFn(client)
}
```

## Monitoring and Auditing

### Token Usage Logging

```typescript
// Log token usage for security auditing
function logTokenUsage(userId: string, action: string, success: boolean) {
  console.log(JSON.stringify({
    type: 'TOKEN_USAGE',
    userId,
    action,
    success,
    timestamp: new Date().toISOString(),
    ip: process.env.VERCEL ? undefined : request?.headers?.get('x-forwarded-for')
  }))
}

// Usage
logTokenUsage(user.id, 'GET_ACCOUNTS', true)
logTokenUsage(user.id, 'TOKEN_REFRESH', false)
```

### Failed Authentication Alerts

```typescript
// Alert on repeated failed authentication attempts
async function checkForBruteForce(email: string) {
  const recentFailures = await prisma.schwabConfig.count({
    where: {
      user: { email },
      updatedAt: {
        gte: new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
      }
    }
  })
  
  if (recentFailures > 5) {
    // Send alert to user
    console.warn(`Multiple auth failures for ${email}`)
    // Could integrate with email/Slack notifications
  }
}
```

---

## Related Documentation

- [OAUTH_IMPLEMENTATION.md](./OAUTH_IMPLEMENTATION.md) - OAuth flow
- [TOKEN_REFRESH.md](./TOKEN_REFRESH.md) - Token refresh mechanism
- [ERROR_HANDLING.md](./ERROR_HANDLING.md) - Error handling

---

**Last Updated**: 2026-03-07
**Version**: 1.0.0
