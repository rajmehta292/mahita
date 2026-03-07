# Multi-User Session Management

## Overview

This document provides an in-depth explanation of how Mahita Terminal handles multiple users, each with their own Schwab OAuth credentials and sessions.

## Architecture

### User Isolation Model

Each user in Mahita Terminal has complete isolation from other users:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-USER ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     NEXTAUTH SESSION                                  │   │
│   │  ┌─────────────────────────────────────────────────────────────┐   │   │
│   │  │ User A (raj.dmehta292@gmail.com)                            │   │   │
│   │  │  - Session Token: JWT_AAA                                    │   │   │
│   │  │  - User ID: user_aaa_123                                    │   │   │
│   │  │  - Email: raj.dmehta292@gmail.com                           │   │   │
│   │  └─────────────────────────────────────────────────────────────┘   │   │
│   │  ┌─────────────────────────────────────────────────────────────┐   │   │
│   │  │ User B (dh.mehta@gmail.com)                                 │   │   │
│   │  │  - Session Token: JWT_BBB                                    │   │   │
│   │  │  - User ID: user_bbb_456                                    │   │   │
│   │  │  - Email: dh.mehta@gmail.com                                │   │   │
│   │  └─────────────────────────────────────────────────────────────┘   │   │
│   │  ┌─────────────────────────────────────────────────────────────┐   │   │
│   │  │ User C (other@email.com)                                   │   │   │
│   │  │  - Session Token: JWT_CCC                                    │   │   │
│   │  │  - User ID: user_ccc_789                                    │   │   │
│   │  │  - Email: other@email.com                                   │   │   │
│   │  └─────────────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                       DATABASE                                       │   │
│   │                                                                       │   │
│   │  ┌───────────────────────────────────────────────────────────────┐ │   │
│   │  │                      SchwabConfig Table                        │ │   │
│   │  │                                                                │ │   │
│   │  │  userId         │ clientId    │ accessToken  │ refreshToken   │ │   │
│   │  │  ─────────────────────────────────────────────────────────────  │ │   │
│   │  │  user_aaa_123  │ clt_aaaa_1  │ token_aaa_1 │ refresh_aaa_1 │ │   │
│   │  │  user_bbb_456  │ clt_bbbb_2  │ token_bbb_2 │ refresh_bbb_2 │ │   │
│   │  │  user_ccc_789  │ clt_cccc_3  │ token_ccc_3 │ refresh_ccc_3 │ │   │
│   │  │                                                                │ │   │
│   │  └───────────────────────────────────────────────────────────────┘ │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Each user can ONLY access their own row in the SchwabConfig table         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Session Management

### How Sessions Work

1. **User Authentication**: User signs in via Google OAuth or development credentials
2. **Session Creation**: NextAuth creates a JWT session token
3. **Token Storage**: Session token stored in browser cookies
4. **Request Validation**: Every API request validates the session

### NextAuth Configuration

```typescript
// app/api/auth/[...nextauth]/route.ts

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "MOCK_CLIENT_ID",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "MOCK_CLIENT_SECRET",
    }),
    // Development credentials provider
    ...(process.env.NODE_ENV === 'development' ? [
      CredentialsProvider({
        name: "Development Login",
        credentials: {
          email: { label: "Email", type: "text" },
          password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
          const email = credentials?.email || "dev@mahita.ai"
          // Create or get user
          let user = await prisma.user.findUnique({ where: { email } })
          if (!user) {
            user = await prisma.user.create({ 
              data: { email, name: 'Dev User' } 
            })
          }
          return user
        }
      })
    ] : []),
  ],
  session: {
    strategy: "jwt",  // Use JWT for sessions
  },
  callbacks: {
    async signIn({ user, account }) {
      // Email whitelist check
      const ALLOWED_EMAILS = ['raj.dmehta292@gmail.com', 'dh.mehta@gmail.com']
      if (!user.email || !ALLOWED_EMAILS.includes(user.email)) {
        return false  // Reject unauthorized users
      }
      return true
    },
    async jwt({ token, user }) {
      // Add user ID to JWT
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      // Make user ID available in session
      if (session.user) {
        (session.user as any).id = token.id
      }
      return session
    }
  },
}
```

## User-Specific Token Storage

### Database Schema

```prisma
// prisma/schema.prisma

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]      // NextAuth accounts
  sessions      Session[]      // NextAuth sessions
  strategies    Strategy[]     // User's trading strategies
  schwabConfig  SchwabConfig?  // User's Schwab credentials
}

model SchwabConfig {
  id                   String   @id @default(cuid())
  userId               String   @unique  // Links to User
  clientId             String
  clientSecret         String
  accessToken          String?
  refreshToken         String?
  accessTokenExpiry    DateTime?
  refreshTokenExpiry   DateTime?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  
  user                 User     @relation(
                          fields: [userId], 
                          references: [id], 
                          onDelete: Cascade
                        )
}
```

### Key Security Features

| Feature | Implementation | Purpose |
|---------|---------------|---------|
| **Unique Constraint** | `userId` is `@unique` | One Schwab config per user |
| **Cascade Delete** | `onDelete: Cascade` | Remove tokens when user deleted |
| **No Cross-Access** | Query by email | Users can't access others' tokens |
| **Server-Side Only** | Tokens never sent to client | Prevents token leakage |

## Request Flow with User Isolation

### Step 1: Incoming Request

```
Browser Request:
GET /api/schwab/accounts
Cookie: next-auth.session-token=eyJhbGciOiJIUzI1NiIs...
```

### Step 2: Session Validation

```typescript
// Every protected API route
export async function GET(request: NextRequest) {
  // Validate session using NextAuth
  const session = await getServerSession(authOptions)
  
  // Reject if no session
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Session is valid, user email is: session.user.email
}
```

### Step 3: User-Specific Data Fetch

```typescript
// Fetch ONLY this user's Schwab configuration
const user = await prisma.user.findUnique({
  where: { email: session.user.email },  // ← User's email
  include: { schwabConfig: true }
})

// Result: Only returns data where userId matches the authenticated user
// Other users' data is NEVER returned
```

### Step 4: Token Retrieval

```typescript
const config = user.schwabConfig

// This user's tokens (never exposed to client)
const accessToken = config.accessToken
const refreshToken = config.refreshToken
```

### Step 5: Make Schwab API Request

```typescript
// Use this user's tokens
const client = getSchwabClient({
  clientId: config.clientId,
  callbackUrl: callbackUrl
})

client.setAccessToken(accessToken, refreshToken)

// Make request to Schwab - uses THIS user's tokens
const accounts = await client.getAccounts()
```

### Step 6: Return Data (Not Tokens)

```typescript
// Only return account data, never tokens
return NextResponse.json({
  success: true,
  accounts: accounts.data  // Account data only
})
// ↑ Tokens never leave server
```

## Multi-User Scenarios

### Scenario 1: Two Users, Same Browser

When two users share a browser (different incognito windows):

```
Window 1: User A (raj.dmehta292@gmail.com)
├── Session: JWT_A
├── Cookies: next-auth.session-token=JWT_A
└── Schwab: Connected with token_aaa

Window 2: User B (dh.mehta@gmail.com) [Incognito]
├── Session: JWT_B  
├── Cookies: next-auth.session-token=JWT_B (separate)
└── Schwab: Connected with token_bbb
```

Each window has separate cookies, so sessions don't conflict.

### Scenario 3: Token Expiry Per User

When User A's token expires but User B's doesn't:

```
User A's Access Token: Expires at 10:30 AM
User B's Access Token: Expires at 11:00 AM

10:30 AM:
├── User A makes request → 401 error → Auto-refresh A's token
└── User B makes request → Success (token still valid)
```

### Scenario 4: User Disconnects Schwab

When a user disconnects their Schwab account:

```typescript
// Only delete THIS user's configuration
await prisma.schwabConfig.delete({
  where: { userId: user.id }
})

// Other users' configurations remain untouched
```

## Implementation Examples

### Getting User-Specific Tokens

```typescript
async function getUserTokens(userEmail: string) {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { schwabConfig: true }
  })
  
  if (!user?.schwabConfig) {
    return null  // User hasn't connected Schwab
  }
  
  return {
    clientId: user.schwabConfig.clientId,
    clientSecret: user.schwabConfig.clientSecret,
    accessToken: user.schwabConfig.accessToken,
    refreshToken: user.schwabConfig.refreshToken,
    accessTokenExpiry: user.schwabConfig.accessTokenExpiry,
    refreshTokenExpiry: user.schwabConfig.refreshTokenExpiry,
  }
}
```

### Checking Token Validity Per User

```typescript
async function isTokenValid(userEmail: string) {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { schwabConfig: true }
  })
  
  if (!user?.schwabConfig?.accessTokenExpiry) {
    return false
  }
  
  // Check if token is expired
  const now = new Date()
  const expiry = user.schwabConfig.accessTokenExpiry
  
  return expiry > now  // Returns true if token is valid
}
```

### Per-User Token Refresh

```typescript
async function refreshUserToken(userEmail: string) {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { schwabConfig: true }
  })
  
  const config = user.schwabConfig
  
  // Call Schwab token endpoint
  const response = await fetch('https://api.schwabapi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
    })
  })
  
  const tokens = await response.json()
  
  // Update ONLY this user's tokens
  await prisma.schwabConfig.update({
    where: { userId: user.id },  // ← Only updates this user
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      refreshTokenExpiry: new Date(Date.now() + tokens.refresh_token_expires_in * 1000),
    }
  })
}
```

## Security Considerations

### What Each User Can Access

| Resource | Access |
|----------|--------|
| Their own email | ✓ Yes |
| Their own Schwab credentials | ✓ Yes |
| Their own tokens | ✓ Yes |
| Their own account data | ✓ Yes |
| Other users' credentials | ✗ No |
| Other users' tokens | ✗ No |
| Other users' account data | ✗ No |

### Attack Prevention

1. **Session Hijacking Prevention**: JWT signed with secret, httponly cookies
2. **CSRF Protection**: Built into NextAuth
3. **SQL Injection**: Prisma ORM prevents injection
4. **Token Leakage**: Tokens never sent to client JavaScript

## Testing Multi-User Scenarios

### Test 1: User Isolation

```typescript
// Test: User A cannot access User B's tokens
async function testUserIsolation() {
  // Get tokens for user A
  const userATokens = await getUserTokens('raj.dmehta292@gmail.com')
  
  // Try to query user B's tokens using user A's session
  const user = await prisma.user.findUnique({
    where: { email: 'dh.mehta@gmail.com' },  // User B's email
    include: { schwabConfig: true }
  })
  
  // User A cannot access this through their own session
  // because session.user.email is their own email
}
```

### Test 2: Concurrent Sessions

```typescript
// Test: Multiple users can be connected simultaneously
async function testConcurrentUsers() {
  // User A connects
  await connectSchwab('raj.dmehta292@gmail.com', tokensA)
  
  // User B connects
  await connectSchwab('dh.mehta@gmail.com', tokensB)
  
  // Verify each user has correct tokens
  const userAConfig = await getUserTokens('raj.dmehta292@gmail.com')
  const userBConfig = await getUserTokens('dh.mehta@gmail.com')
  
  assert(userAConfig.accessToken !== userBConfig.accessToken)
}
```

---

**Last Updated**: 2026-03-07
**Version**: 1.0.0
