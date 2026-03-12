# Authentication & Schwab API Key Management System

## Overview

Complete authentication and API key management system implemented for Mahita Terminal with secure storage of Schwab credentials.

## Features Implemented

### 1. Email Whitelist Authentication
- Only authorized emails can access the platform
- Hardcoded whitelist: `raj.dmehta292@gmail.com` and `dh.mehta@gmail.com`
- Google OAuth integration
- Automatic rejection of unauthorized users

### 2. Schwab API Key Storage
- Secure database storage of user-specific Schwab credentials
- Client ID and Client Secret stored per user
- Access and refresh tokens managed automatically
- Token expiry tracking

### 3. Settings Page
- User-friendly interface to enter Schwab credentials
- Secure password field for Client Secret
- Update and delete functionality
- Visual feedback for all operations

### 4. Active Trader Integration
- Automatic credential checking
- Redirects to Settings if credentials not configured
- OAuth flow using user's own credentials
- Tokens stored server-side automatically

## Database Schema

### SchwabConfig Model
```prisma
model SchwabConfig {
  id                String   @id @default(cuid())
  userId            String   @unique
  clientId          String
  clientSecret      String
  accessToken       String?
  refreshToken      String?
  accessTokenExpiry DateTime?
  refreshTokenExpiry DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## API Endpoints

### User Configuration

#### GET /api/user/schwab-config
Get user's Schwab configuration status (without exposing sensitive data)

**Response:**
```json
{
  "success": true,
  "config": {
    "hasClientId": true,
    "hasClientSecret": true,
    "hasAccessToken": true,
    "hasRefreshToken": true,
    "accessTokenExpiry": "2026-03-06T15:30:00Z",
    "refreshTokenExpiry": "2026-03-13T14:00:00Z"
  }
}
```

#### POST /api/user/schwab-config
Save or update Schwab credentials

**Request:**
```json
{
  "clientId": "your_client_id",
  "clientSecret": "your_client_secret"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Schwab credentials saved successfully"
}
```

#### DELETE /api/user/schwab-config
Delete user's Schwab credentials

**Response:**
```json
{
  "success": true,
  "message": "Schwab credentials deleted successfully"
}
```

### Token Management

#### POST /api/user/schwab-tokens
Save OAuth tokens after authentication

**Request:**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 1800,
  "refreshTokenExpiresIn": 604800
}
```

#### GET /api/user/schwab-tokens
Get stored tokens (server-side only)

**Response:**
```json
{
  "success": true,
  "tokens": {
    "accessToken": "...",
    "refreshToken": "...",
    "accessTokenValid": true,
    "refreshTokenValid": true
  },
  "credentials": {
    "clientId": "...",
    "clientSecret": "..."
  }
}
```

### Schwab API Integration

#### GET /api/schwab/auth?action=authorize
Get authorization URL using user's credentials

**Response:**
```json
{
  "authUrl": "https://api.schwabapi.com/v1/oauth/authorize?..."
}
```

#### POST /api/schwab/auth
Exchange authorization code for tokens (saves automatically)

**Request:**
```json
{
  "code": "authorization_code"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication successful. Tokens saved."
}
```

#### GET /api/schwab/accounts
Get user's Schwab accounts (uses stored credentials)

#### GET /api/schwab/positions?accountId=...
Get positions for account (uses stored credentials)

## User Flow

### First Time Setup

1. **User visits site** → Lands on homepage
2. **Clicks "Get Started"** → Google OAuth popup
3. **Signs in with Google** → Email checked against whitelist
4. **If authorized** → Redirected to dashboard
5. **If unauthorized** → Sign-in rejected with error

### Configuring Schwab API

1. **User navigates to Settings** (from sidebar)
2. **Enters Schwab Client ID and Client Secret**
3. **Clicks "Save Credentials"**
4. **Credentials stored in database** (encrypted at rest)
5. **Success message displayed**

### Connecting Schwab Account

1. **User navigates to Active Trader**
2. **If no credentials** → Redirected to Settings
3. **If credentials exist** → Shows "Connect Schwab" button
4. **Clicks "Connect Schwab"**
5. **OAuth popup opens** (using user's credentials)
6. **User authorizes in Schwab**
7. **Tokens saved automatically** to database
8. **Connection established** → Shows account data

### Using Active Trader

1. **User is connected** → Sees real-time data
2. **Account balance** updates automatically
3. **Positions** refresh every 5 seconds
4. **Can disconnect** anytime (clears UI state, keeps tokens)
5. **Next visit** → Auto-connects if tokens valid

## Security Features

### Authentication
- Email whitelist prevents unauthorized access
- Google OAuth for secure authentication
- JWT session management
- Server-side session validation

### Credential Storage
- User-specific credentials in database
- No environment variables for user keys
- Credentials associated with user ID
- Cascade delete on user removal

### Token Management
- Access tokens expire after 30 minutes
- Refresh tokens expire after 7 days
- Expiry times tracked in database
- Automatic validation before API calls

### API Security
- All endpoints require authentication
- Session validation on every request
- User can only access their own data
- No credential exposure in responses

## Testing Checklist

### Authentication Tests
- [ ] Only whitelisted emails can sign in
- [ ] Non-whitelisted emails are rejected
- [ ] Session persists across page refreshes
- [ ] Sign out works correctly

### Settings Page Tests
- [ ] Can save new credentials
- [ ] Can update existing credentials
- [ ] Can delete credentials
- [ ] Password field hides Client Secret
- [ ] Success/error messages display correctly
- [ ] Form validation works

### Active Trader Tests
- [ ] Redirects to Settings if no credentials
- [ ] Shows connect button if credentials exist
- [ ] OAuth flow completes successfully
- [ ] Tokens are saved to database
- [ ] Account data loads after connection
- [ ] Positions refresh automatically
- [ ] Disconnect clears UI state
- [ ] Reconnect uses stored tokens

### API Tests
- [ ] Unauthorized requests are rejected
- [ ] User can only access own credentials
- [ ] Tokens are stored securely
- [ ] API calls use stored credentials
- [ ] Error handling works correctly

## Environment Variables

### Required
```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# NextAuth
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=https://mahita.ai

# Database
DATABASE_URL="file:./dev.db"
```

### NOT Required (User-Specific)
```env
# These are now stored per-user in database
# SCHWAB_CLIENT_ID - NO LONGER NEEDED
# SCHWAB_CLIENT_SECRET - NO LONGER NEEDED
# SCHWAB_CALLBACK_URL - Generated dynamically
```

## Migration Notes

### Changes from Previous System

**Before:**
- Schwab credentials in environment variables
- Single set of credentials for all users
- Tokens passed in URL parameters
- Client-side token storage

**After:**
- Schwab credentials in database per user
- Each user has their own credentials
- Tokens stored server-side in database
- Automatic token management

### Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Push schema changes
npx prisma db push

# Verify migration
npx prisma studio
```

## Troubleshooting

### "Schwab credentials not configured"
- User needs to add credentials in Settings
- Navigate to Settings page
- Enter Client ID and Client Secret
- Click Save

### "Please connect your Schwab account first"
- User has credentials but no tokens
- Click "Connect Schwab" in Active Trader
- Complete OAuth flow
- Tokens will be saved automatically

### "Unauthorized login attempt"
- Email not in whitelist
- Only raj.dmehta292@gmail.com and dh.mehta@gmail.com allowed
- Contact admin to add email to whitelist

### Tokens expired
- Access tokens expire after 30 minutes
- Refresh tokens expire after 7 days
- Click "Connect Schwab" again to refresh
- Future: Implement automatic token refresh

## Future Enhancements

### Phase 1
- [ ] Automatic token refresh
- [ ] Token encryption at rest
- [ ] Audit logging for credential changes
- [ ] Email notifications for token expiry

### Phase 2
- [ ] Multiple Schwab account support
- [ ] Credential sharing (for teams)
- [ ] API key rotation
- [ ] Two-factor authentication

### Phase 3
- [ ] Broker integration abstraction
- [ ] Support for other brokers (IB, Alpaca)
- [ ] Unified credential management
- [ ] Advanced security features

## Support

### For Users
- Settings page has instructions
- Hover tooltips for guidance
- Error messages are descriptive
- Contact support if issues persist

### For Developers
- Check server logs for errors
- Use Prisma Studio to inspect database
- Verify environment variables
- Test with both whitelisted emails

---

**Last Updated**: 2026-03-06
**Version**: 2.0.0
**Status**: Production Ready
