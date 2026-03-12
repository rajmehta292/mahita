# Schwab API Setup Guide

Status: Active operational setup guide. For the canonical auth/brokerage architecture and callback rules, see [docs/guidebook/auth/README.md](/Users/rmehta01/Sites/mahita/docs/guidebook/auth/README.md) and [docs/onboarding/schwab_setup_faq.md](/Users/rmehta01/Sites/mahita/docs/onboarding/schwab_setup_faq.md).

## Quick Start

This guide will help you set up Charles Schwab API integration for live trading in Mahita Terminal.

## Prerequisites

- Charles Schwab brokerage account
- Approved trading permissions
- Developer account access

## Step-by-Step Setup

### 1. Create Schwab Developer Account

1. Visit [Schwab Developer Portal](https://beta-developer.schwab.com/)
2. Click "Sign Up" or "Register"
3. Fill in your information:
   - Email address
   - Password
   - Company/Individual details
4. Verify your email address
5. Complete the registration

### 2. Create Your Application

1. Log in to the [Schwab Developer Portal](https://beta-developer.schwab.com/)
2. Navigate to **Dashboard** → **My Apps**
3. Click **Create App** button
4. Fill in the application form:

   **Application Details:**
   - **App Name**: `Mahita Terminal` (or your preferred name)
   - **Description**: `Algorithmic trading platform with automated strategy execution`
   - **App Type**: `Web Application`

   **API Products:**
   - ✅ Market Data Production
   - ✅ Accounts and Trading Production

   **OAuth Settings:**
   - **Redirect URI**: `https://mahita.ai/schwab/callback`

5. Click **Submit** or **Create App**

### 3. Wait for Approval

- Schwab will review your application
- This typically takes 1-3 business days
- You'll receive an email when approved
- Check your application status in the developer portal

### 4. Get Your API Credentials

Once approved:

1. Go to **My Apps** in the developer portal
2. Click on your application name
3. You'll see:
   - **Client ID** (also called App Key)
   - **Client Secret** (click "Show" to reveal)
4. Copy both values - you'll need them next

### 5. Configure Mahita Terminal

#### Option A: Using Environment Variables (Recommended)

1. Open your `.env.local` file in the Mahita project root
2. Add the following lines:

```env
# Schwab API Configuration
SCHWAB_CLIENT_ID=your_client_id_here
SCHWAB_CLIENT_SECRET=your_client_secret_here
SCHWAB_CALLBACK_URL=https://mahita.ai/schwab/callback
```

3. Replace `your_client_id_here` and `your_client_secret_here` with your actual credentials

### 6. Restart the Application

```bash
# Stop the current dev server (Ctrl+C)
# Start it again
npm run dev
```

### 7. Test the Connection

1. Open Mahita Terminal in your browser
2. Navigate to **Active Trader** from the sidebar
3. Click **Connect Schwab Account**
4. A popup window will open
5. Log in with your Schwab credentials
6. Authorize the application
7. The window should close automatically
8. You should see "Connected" status

## Troubleshooting

### Application Not Approved

**Issue**: Application stuck in "Pending" status

**Solutions**:
- Wait 1-3 business days for review
- Check your email for any requests from Schwab
- Ensure all required fields were filled correctly
- Contact Schwab developer support if delayed

### Invalid Redirect URI

**Issue**: "redirect_uri_mismatch" error

**Solutions**:
- Verify the callback URL in your app settings matches exactly
- Check for trailing slashes (should not have one)
- Ensure protocol matches (http vs https)
- Use `https://mahita.ai/schwab/callback` for real-user Schwab app setup
- Do not point real-user Schwab apps at localhost or a developer machine

### Authorization Window Doesn't Open

**Issue**: Popup blocked or doesn't appear

**Solutions**:
- Check browser popup blocker settings
- Allow popups for mahita.ai
- Try a different browser
- Check browser console for errors

### "Unauthorized" Error

**Issue**: Can't authenticate even with correct credentials

**Solutions**:
- Verify Client ID and Client Secret are correct
- Check for extra spaces when copying credentials
- Ensure application is approved and active
- Try regenerating credentials in developer portal

### Connection Lost

**Issue**: "Connected" status changes to disconnected

**Solutions**:
- Access tokens expire after 30 minutes
- Refresh tokens expire after 7 days
- Reconnect your account
- Check if Schwab API is experiencing issues

## Security Best Practices

### Protecting Your Credentials

1. **Never commit credentials to Git**
   ```bash
   # .env.local is already in .gitignore
   # Double-check it's not tracked
   git status
   ```

2. **Use environment variables**
   - Store in `.env.local` for development
   - Use secure environment variable management in production
   - Never hardcode credentials in source code

3. **Rotate credentials regularly**
   - Change credentials every 90 days
   - Immediately rotate if compromised
   - Use different credentials for dev/prod

### API Usage Limits

Schwab API has rate limits:
- **Market Data**: 120 requests per minute
- **Trading**: 60 requests per minute
- **Account Data**: 60 requests per minute

Exceeding limits results in temporary blocks.

## Testing Your Setup

### 1. Test Authentication

```bash
# In browser console after connecting
console.log('Connected:', connected)
console.log('Account ID:', accountId)
```

### 2. Test Market Data

Navigate to Active Trader and verify:
- Account balance displays correctly
- Positions load (if you have any)
- Real-time updates work

### 3. Test Paper Trading First

Before live trading:
1. Use small position sizes
2. Test with liquid stocks (AAPL, MSFT, etc.)
3. Verify orders execute correctly
4. Check P&L calculations

## Production Deployment

### Environment Variables

For production (Vercel, AWS, etc.):

1. Add environment variables in your hosting platform
2. Use the production callback URL
3. Ensure HTTPS is enabled
4. Set up proper error logging

### Monitoring

Set up monitoring for:
- API request failures
- Authentication errors
- Order execution issues
- Rate limit warnings

## Support Resources

### Official Documentation
- [Schwab Developer Portal](https://beta-developer.schwab.com/)
- [API Documentation](https://developer.schwab.com/docs)
- [OAuth Guide](https://developer.schwab.com/oauth)

### Mahita Support
- [Active Trader Documentation](ACTIVE_TRADER.md)
- Email: support@mahita.ai
- Discord: [Join our community](https://discord.gg/mahita)

### Community
- [GitHub Issues](https://github.com/yourusername/mahita/issues)
- [Discord Server](https://discord.gg/mahita)
- [Twitter](https://twitter.com/mahita)

## Next Steps

After successful setup:

1. ✅ Read the [Active Trader Guide](ACTIVE_TRADER.md)
2. ✅ Understand [Risk Management](ACTIVE_TRADER.md#risk-management)
3. ✅ Review [Trading Best Practices](ACTIVE_TRADER.md#best-practices)
4. ✅ Start with paper trading
5. ✅ Deploy your first strategy

## FAQ

**Q: Do I need a Schwab account to use Mahita?**
A: No, only for the Active Trader (live trading) feature. All other features work without Schwab.

**Q: Is there a fee for Schwab API access?**
A: No, Schwab API access is free for approved developers.

**Q: Can I use multiple Schwab accounts?**
A: Yes, you can connect multiple accounts and switch between them.

**Q: What happens if my token expires?**
A: You'll need to reconnect your account. We're working on automatic token refresh.

**Q: Is my data secure?**
A: Yes, we use OAuth 2.0 and never store your Schwab password. Tokens are encrypted.

**Q: Can I trade options?**
A: Options trading support is coming in Q3 2026.

**Q: What about crypto trading?**
A: Schwab doesn't support crypto. We're exploring other integrations.

---

**Last Updated**: 2026-03-06
**Version**: 1.0.0
