# OAuth Callback Flow - Detailed Explanation

## Overview

This document provides an in-depth explanation of how the OAuth popup window works, how the authorization code is captured from the callback URL, and how it flows back to the application.

## The Complete OAuth Popup Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OAUTH POPUP FLOW DIAGRAM                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────┐                                           │
│  │      MAIN WINDOW             │                                           │
│  │                              │                                           │
│  │  ┌────────────────────────┐  │                                           │
│  │  │  Active Trader Page   │  │                                           │
│  │  │                        │  │                                           │
│  │  │  [Connect Schwab] ────┼──┼─── Opens Popup Window                     │
│  │  │                        │  │                                           │
│  │  │  ┌──────────────────┐  │  │                                           │
│  │  │  │ Listen for       │  │                                           │
│  │  │  │ postMessage      │  │                                           │
│  │  │  └──────────────────┘  │  │                                           │
│  │  └────────────────────────┘  │                                           │
│  └──────────────────────────────┘                                           │
│              ▲                                                                │
│              │ postMessage (with code)                                      │
│              │                                                                │
│  ┌───────────┴───────────────────────────────────────────────────────────┐ │
│  │                     POPUP WINDOW                                       │ │
│  │                                                                     │ │
│  │  1. Opens Schwab OAuth URL                                          │ │
│  │     https://api.schwabapi.com/v1/oauth/authorize?                   │ │
│  │        client_id=XXX&redirect_uri=https://mahita.ai/schwab/callback │ │
│  │                                                                     │ │
│  │  2. User sees Schwab login screen                                   │ │
│  │     ┌─────────────────────────────────────┐                        │ │
│  │     │  🏦 Charles Schwab                    │                        │ │
│  │     │                                     │                        │ │
│  │     │  Username: [____________]           │                        │ │
│  │     │  Password: [____________]           │                        │ │
│  │     │                                     │                        │ │
│  │     │  [Sign In]                         │                        │ │
│  │     └─────────────────────────────────────┘                        │ │
│  │                                                                     │ │
│  │  3. User authorizes app                                            │ │
│  │     ┌─────────────────────────────────────┐                        │ │
│  │     │  🏦 Charles Schwab                   │                        │ │
│  │     │                                     │                        │ │
│  │     │  Allow Mahita Terminal to:          │                        │ │
│  │     │  ☑ Access account balances         │                        │ │
│  │     │  ☑ View positions                  │                        │ │
│  │     │  ☑ Place trades                    │                        │ │
│  │     │                                     │                        │ │
│  │     │  [Authorize]  [Deny]               │                        │ │
│  │     └─────────────────────────────────────┘                        │ │
│  │                                                                     │ │
│  │  4. Schwab redirects to callback URL                               │ │
│  │     https://mahita.ai/schwab/callback?code=AUTH_CODE_XXX          │ │
│  │                 │                                                   │ │
│  │                 ▼                                                   │ │
│  │     ┌─────────────────────────────────────┐                        │ │
│  │     │  "Completing authorization..."     │                        │ │
│  │     │  (Spinner)                          │                        │ │
│  │     │                                     │                        │ │
│  │     │  - Extracts code from URL           │                        │ │
│  │     │  - Sends to parent via postMessage │                        │ │
│  │     │  - Closes window                    │                        │ │
│  │     └─────────────────────────────────────┘                        │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Frontend Implementation

### Step 1: Opening the Popup

```typescript
// app/active-trader/page.tsx or component

function handleConnectSchwab() {
  // 1. Generate authorization URL from backend
  fetch('/api/schwab/auth?action=authorize')
    .then(res => res.json())
    .then(({ authUrl }) => {
      // 2. Open popup window
      const width = 600
      const height = 700
      const left = (screen.width - width) / 2
      const top = (screen.height - height) / 2
      
      const popup = window.open(
        authUrl,
        'Schwab Authorization',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      )
      
      // 3. Set up listener for the authorization code
      window.addEventListener('message', handleAuthCallback)
    })
}
```

### Step 2: Listening for the Code

```typescript
// Listen for postMessage from popup
function handleAuthCallback(event: MessageEvent) {
  // Verify the message is from our callback page
  if (event.data?.type === 'schwab-callback') {
    const { code } = event.data
    
    console.log('Authorization code received:', code)
    
    // Send code to backend to exchange for tokens
    exchangeCodeForTokens(code)
  }
}

async function exchangeCodeForTokens(code: string) {
  const response = await fetch('/api/schwab/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  })
  
  const data = await response.json()
  
  if (data.success) {
    // Tokens saved successfully!
    // Refresh UI to show connected status
    refreshConnectionStatus()
  } else {
    // Handle error
    console.error('Token exchange failed:', data.error)
  }
}
```

### Step 3: Setting up the Callback Page

```typescript
// app/schwab/callback/page.tsx

'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function SchwabCallbackContent() {
  const searchParams = useSearchParams()
  
  useEffect(() => {
    // 1. Get the authorization code from URL
    const code = searchParams.get('code')
    
    if (code) {
      console.log('Callback received code:', code)
      
      // 2. Check if there's a parent window (was opened as popup)
      if (window.opener) {
        // 3. Send the code back to the parent window
        window.opener.postMessage({
          type: 'schwab-callback',
          code: code
        }, window.location.origin)
        
        console.log('Code sent to parent window')
        
        // 4. Close this popup after a short delay
        setTimeout(() => {
          window.close()
        }, 1000)
      }
    } else if (searchParams.get('error')) {
      // Handle error from Schwab
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')
      
      if (window.opener) {
        window.opener.postMessage({
          type: 'schwab-error',
          error: error,
          description: errorDescription
        }, window.location.origin)
        
        setTimeout(() => window.close(), 1000)
      }
    }
  }, [searchParams])
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      height: '100vh',
      background: '#131722',
      color: 'white'
    }}>
      <div className="spinner" />
      <p>Completing authorization...</p>
      <p style={{ color: '#888', fontSize: '14px' }}>
        This window will close automatically
      </p>
    </div>
  )
}

export default function SchwabCallbackPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SchwabCallbackContent />
    </Suspense>
  )
}
```

## Backend Implementation

### Step 4: Exchanging Code for Tokens

```typescript
// app/api/schwab/auth/route.ts

export async function POST(request: NextRequest) {
  // 1. Validate session
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // 2. Get the authorization code from request body
  const body = await request.json()
  const { code } = body
  
  if (!code) {
    return NextResponse.json(
      { error: 'Authorization code required' },
      { status: 400 }
    )
  }
  
  // 3. Get user's Schwab credentials
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { schwabConfig: true }
  })
  
  if (!user?.schwabConfig) {
    return NextResponse.json(
      { error: 'Schwab credentials not configured' },
      { status: 400 }
    )
  }
  
  const { clientId, clientSecret } = user.schwabConfig
  const callbackUrl = `${process.env.NEXTAUTH_URL}/schwab/callback`
  
  // 4. Exchange authorization code for tokens
  const client = getSchwabClient({ clientId, callbackUrl })
  
  try {
    const authResponse = await client.authenticate(code)
    
    // 5. Calculate token expiry times
    const now = new Date()
    const accessTokenExpiry = new Date(
      now.getTime() + (authResponse.expires_in || 1800) * 1000
    )
    const refreshTokenExpiry = new Date(
      now.getTime() + (authResponse.refresh_token_expires_in || 604800) * 1000
    )
    
    // 6. Store tokens in database
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
    
    console.log('Tokens saved for user:', user.email)
    
    return NextResponse.json({
      success: true,
      message: 'Authentication successful. Tokens saved.'
    })
    
  } catch (error: any) {
    console.error('Authentication error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to authenticate' },
      { status: 500 }
    )
  }
}
```

## Complete Flow Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OAUTH SEQUENCE DIAGRAM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MAIN WINDOW                    POPUP WINDOW              SCHWAB          │
│      │                              │                        │              │
│      │  1. User clicks              │                        │              │
│      │  "Connect Schwab"            │                        │              │
│      │─────────────────────────────▶│                        │              │
│      │                              │                        │              │
│      │                              │  2. GET auth URL      │              │
│      │                              │───────────────────────▶│              │
│      │                              │                        │              │
│      │                              │◀───────────────────────│              │
│      │                              │   Authorization URL   │              │
│      │                              │                        │              │
│      │                              │  3. Redirect to       │              │
│      │                              │     Schwab login       │              │
│      │                              │───────────────────────▶│              │
│      │                              │                        │              │
│      │                              │                        │  4. Show     │
│      │                              │                        │  login page  │
│      │                              │◀───────────────────────│              │
│      │                              │                        │              │
│      │                              │  5. User enters creds │              │
│      │                              │───────────────────────▶│              │
│      │                              │                        │              │
│      │                              │                        │  6. Validate │
│      │                              │                        │◀─────────────│
│      │                              │                        │              │
│      │                              │  7. User authorizes   │              │
│      │                              │───────────────────────▶│              │
│      │                              │                        │              │
│      │                              │                        │  8. Generate │
│      │                              │                        │  auth code   │
│      │                              │                        │◀─────────────│
│      │                              │                        │              │
│      │                              │  9. Redirect to       │              │
│      │                              │  callback URL with    │              │
│      │                              │  ?code=XXX            │              │
│      │                              │◀───────────────────────│              │
│      │                              │                        │              │
│      │                              │  10. Extract code     │              │
│      │                              │     from URL          │              │
│      │                              │                        │              │
│      │  11. postMessage            │                        │              │
│      │◀────────────────────────────│   with code           │              │
│      │                              │                        │              │
│      │                              │  12. Close popup     │              │
│      │                              │     window            │              │
│      │                              │                        │              │
│      │  13. POST /api/schwab/auth │                        │              │
│      │     with code               │                        │              │
│      │─────────────────────────────▶│                        │              │
│      │                              │                        │              │
│      │                              │  14. Exchange code   │              │
│      │                              │     for tokens        │              │
│      │                              │───────────────────────▶│              │
│      │                              │                        │              │
│      │                              │◀───────────────────────│ Tokens      │
│      │                              │                        │              │
│      │  15. Save tokens           │                        │              │
│      │  to database               │                        │              │
│      │◀────────────────────────────│                        │              │
│      │                              │                        │              │
│      │  16. Update UI to          │                        │              │
│      │     "Connected" status     │                        │              │
│      │                              │                        │              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Error Handling in Callback

### User Denies Authorization

If user clicks "Deny" on Schwab's authorization screen:

```typescript
// Schwab redirects to callback with error
// https://mahita.ai/schwab/callback?error=access_denied&error_description=...

// In callback page
const error = searchParams.get('error')
const errorDescription = searchParams.get('error_description')

if (error) {
  window.opener.postMessage({
    type: 'schwab-error',
    error: error,
    description: errorDescription
  }, window.location.origin)
  
  setTimeout(() => window.close(), 1000)
}

// Frontend error handling
window.addEventListener('message', (event) => {
  if (event.data?.type === 'schwab-error') {
    alert(`Authorization failed: ${event.data.description}`)
  }
})
```

### Code Exchange Failures

```typescript
// If token exchange fails
async function exchangeCodeForTokens(code: string) {
  try {
    const response = await fetch('/api/schwab/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed')
    }
    
    return data
  } catch (error: any) {
    console.error('Token exchange error:', error)
    throw error
  }
}
```

## Security Considerations

### Verifying Origin

```typescript
// In the callback page, verify the origin
useEffect(() => {
  // This ensures the message can only be received from our own origin
  // The second parameter of postMessage specifies the target origin
}, [])

// In the parent window
window.addEventListener('message', (event) => {
  // Verify origin matches
  if (event.origin !== window.location.origin) {
    console.warn('Ignoring message from untrusted origin:', event.origin)
    return
  }
  
  // Process the message
  if (event.data?.type === 'schwab-callback') {
    // Handle the code
  }
})
```

### State Parameter (CSRF Protection)

For production, implement state parameter:

```typescript
// 1. Generate random state
const state = crypto.randomBytes(32).toString('hex')

// 2. Store in sessionStorage before opening popup
sessionStorage.setItem('oauth_state', state)

// 3. Include in authorization URL
const authUrl = `https://api.schwabapi.com/v1/oauth/authorize?
  client_id=${clientId}
  &redirect_uri=${encodeURIComponent(callbackUrl)}
  &state=${state}`

// 4. Verify state in callback
const returnedState = searchParams.get('state')
const storedState = sessionStorage.getItem('oauth_state')

if (returnedState !== storedState) {
  throw new Error('State mismatch - possible CSRF attack')
}
```

## Troubleshooting

### Popup Blocked

```typescript
function openPopup(url: string) {
  const popup = window.open(url, 'Auth', 'width=600,height=700')
  
  if (!popup || popup.closed) {
    // Popup was blocked
    alert('Please allow popups for this site')
    
    // Alternative: redirect instead of popup
    window.location.href = url
  }
  
  return popup
}
```

### Popup Doesn't Close

```typescript
// If window.close() doesn't work (browsers sometimes block this)
// Show a "Success" message instead
return (
  <div>
    <h2>Authorization Complete!</h2>
    <p>You can close this window and return to the application.</p>
    <button onClick={() => window.close()}>Close Window</button>
  </div>
)
```

### Code Already Used

If the authorization code has already been exchanged:

```typescript
// Schwab returns error
// ?error=invalid_grant&error_description=Authorization code already used

// Handle gracefully
if (error === 'invalid_grant') {
  // Start the OAuth flow again
  handleConnectSchwab()
}
```

---

**Last Updated**: 2026-03-07
**Version**: 1.0.0
