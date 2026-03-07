# Schwab Resources Documentation

This folder contains comprehensive documentation on the Schwab OAuth integration in Mahita Terminal.

## Table of Contents

### Core Documentation

| Document | Description |
|----------|-------------|
| [OAUTH_IMPLEMENTATION.md](./OAUTH_IMPLEMENTATION.md) | Complete OAuth flow, token exchange, and API integration |
| [MULTI_USER_SESSIONS.md](./MULTI_USER_SESSIONS.md) | How multiple users are isolated and managed |
| [TOKEN_SECURITY.md](./TOKEN_SECURITY.md) | Secure token storage and encryption |
| [ERROR_HANDLING.md](./ERROR_HANDLING.md) | Error handling and token refresh mechanisms |

## Quick Reference

### OAuth Flow Summary

```
1. User clicks "Connect Schwab"
2. Backend generates authorization URL
3. User redirected to Schwab login
4. User authorizes the application
5. Schwab redirects to callback with code
6. Backend exchanges code for tokens
7. Tokens stored in database
8. User can make API requests
```

### Token Lifetimes

| Token | Lifetime | Refresh Method |
|-------|----------|----------------|
| Access Token | 30 minutes | Use refresh token |
| Refresh Token | 7 days | Re-authenticate |

### Key API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/schwab/auth?action=authorize` | Get OAuth URL |
| `/api/schwab/auth` | Exchange code for tokens |
| `/api/schwab/accounts` | Get accounts |
| `/api/schwab/positions` | Get positions |
| `/api/schwab/orders` | Place orders |

## Getting Started

1. **Set up Schwab Developer Account**: See [SCHWAB_SETUP.md](../SCHWAB_SETUP.md)
2. **Understand OAuth**: Read [OAUTH_IMPLEMENTATION.md](./OAUTH_IMPLEMENTATION.md)
3. **Learn about Security**: Read [TOKEN_SECURITY.md](./TOKEN_SECURITY.md)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MAHITA TERMINAL                                       │
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                    │
│  │   Browser   │────▶│  NextAuth  │────▶│   Prisma    │                    │
│  │  (Frontend) │     │  (Session) │     │  (Database) │                    │
│  └─────────────┘     └─────────────┘     └─────────────┘                    │
│         │                                        │                           │
│         │                                        │                           │
│         ▼                                        ▼                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     API Routes (Server)                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │   │
│  │  │ /api/schwab/ │  │ /api/schwab/ │  │ /api/schwab/ │             │   │
│  │  │    auth      │  │   accounts   │  │   positions  │             │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                    │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Schwab API                                       │   │
│  │  https://api.schwabapi.com/v1/oauth/authorize                       │   │
│  │  https://api.schwabapi.com/v1/oauth/token                          │   │
│  │  https://api.schwabapi.com/v1/accounts                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Common Tasks

### Making API Requests

```typescript
// Get user's tokens from database
const user = await prisma.user.findUnique({
  where: { email: session.user.email },
  include: { schwabConfig: true }
})

// Create client with tokens
const client = getSchwabClient({
  clientId: user.schwabConfig.clientId,
  callbackUrl: callbackUrl
})

client.setAccessToken(
  user.schwabConfig.accessToken,
  user.schwabConfig.refreshToken
)

// Make API call
const accounts = await client.getAccounts()
```

### Refreshing Tokens

```typescript
const response = await fetch('https://api.schwabapi.com/v1/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: currentRefreshToken,
  })
})

const tokens = await response.json()

// Update database
await prisma.schwabConfig.update({
  where: { userId },
  data: {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  }
})
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Unauthorized" error | Check session, re-authenticate |
| "Token expired" | Use refresh token |
| "Rate limit exceeded" | Wait 60 seconds, retry |
| "Credentials not configured" | Add credentials in Settings |

### Debug Mode

Set environment variable to enable verbose logging:

```env
DEBUG=schwab:*
```

## Related Documentation

- [../SCHWAB_SETUP.md](../SCHWAB_SETUP.md) - Initial setup guide
- [../AUTHENTICATION_SYSTEM.md](../AUTHENTICATION_SYSTEM.md) - Authentication overview
- [../ACTIVE_TRADER.md](../ACTIVE_TRADER.md) - Trading interface

---

**Last Updated**: 2026-03-07
**Version**: 1.0.0
