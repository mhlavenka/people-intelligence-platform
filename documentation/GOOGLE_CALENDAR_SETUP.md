# Google Calendar Integration Setup

Follow these steps to enable Google Calendar sync for coaches.

## 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable **Google Calendar API** under **APIs & Services > Library**
4. Go to **APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID**
5. Application type: **Web Application**
6. Name: `People Intelligence Platform`
7. Authorized redirect URIs: add your callback URL:
   - Production: `https://pip.helenacoaching.com/api/calendar/auth/google/callback`
   - Local dev: `http://localhost:3030/api/calendar/auth/google/callback`
8. Copy the **Client ID** and **Client Secret**
9. Enable Calndar API !!

## 2. OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. App name: `People Intelligence Platform`
3. User support email: your support email
4. Scopes: add `https://www.googleapis.com/auth/calendar.events`
5. Add test users during development (any Google account that will connect)
6. Submit for verification before production launch

## 3. Environment Variables

Add to your `.env` file:

```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_CALENDAR_REDIRECT_URI=https://pip.helenacoaching.com/api/calendar/auth/google/callback
```

## 4. How It Works

- Each **coach** connects their own Google account from **Settings > Google Calendar Sync**
- OAuth tokens are stored per-coach (not per-tenant)
- When a coaching session is created/updated/deleted, the corresponding Google Calendar event is automatically synced
- Coaches select which calendar to sync to (e.g., "Work", "Coaching", etc.)
- Access tokens are automatically refreshed using the stored refresh token

## 5. Scopes

The integration requests only `calendar.events` scope, which allows:
- Creating, reading, updating, and deleting events
- Does NOT access contacts, other calendar settings, or full calendar read

## 6. Production Verification

Before launching to all users:
1. Complete the OAuth consent screen verification process
2. Google will review the app (may take several days)
3. Until verified, only test users added to the consent screen can connect
