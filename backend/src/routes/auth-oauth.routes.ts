import { Router, Request, Response, NextFunction } from 'express';
import { User } from '../models/User.model';
import { config } from '../config/env';
import { buildPayload, generateTokens } from '../controllers/auth.controller';

const router = Router();

// ── Google OAuth ─────────────────────────────────────────────────────────────

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
}

/** Exchange authorization code for tokens, then fetch user profile. */
async function googleExchange(code: string): Promise<GoogleUserInfo> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.oauth.google.clientId,
      client_secret: config.oauth.google.clientSecret,
      redirect_uri: `${config.frontendUrl}/auth/oauth/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) throw new Error('Google token exchange failed');
  const tokens = (await tokenRes.json()) as GoogleTokenResponse;

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) throw new Error('Google user info fetch failed');
  return (await userRes.json()) as GoogleUserInfo;
}

router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: req.t('errors.authorizationCodeRequired') }); return; }
    if (!config.oauth.google.clientId) { res.status(501).json({ error: req.t('errors.googleOAuthNotConfigured') }); return; }

    const profile = await googleExchange(code);
    if (!profile.email_verified) {
      res.status(400).json({ error: req.t('errors.googleEmailNotVerified') });
      return;
    }

    // Find user by OAuth link or by email
    let user = await User.findOne({
      'oauthAccounts.provider': 'google',
      'oauthAccounts.providerId': profile.sub,
    }).setOptions({ bypassTenantCheck: true });

    if (!user) {
      user = await User.findOne({ email: profile.email.toLowerCase() }).setOptions({ bypassTenantCheck: true });
    }

    if (!user || !user.isActive) {
      res.status(401).json({ error: req.t('errors.noGoogleAccount') });
      return;
    }

    // Link OAuth account if not already linked
    if (!user.oauthAccounts.some((a) => a.provider === 'google' && a.providerId === profile.sub)) {
      user.oauthAccounts.push({
        provider: 'google',
        providerId: profile.sub,
        email: profile.email,
        linkedAt: new Date(),
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const payload = await buildPayload(user);
    const tokens = generateTokens(payload);

    res.json({
      ...tokens,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: payload.role,
        permissions: payload.permissions,
        customRoleId: payload.customRoleId,
        customRoleName: payload.customRoleName,
        organizationId: user.organizationId,
      },
    });
  } catch (e) { next(e); }
});

// ── Microsoft OAuth ──────────────────────────────────────────────────────────

interface MicrosoftTokenResponse {
  access_token: string;
  id_token: string;
}

interface MicrosoftProfile {
  id: string;
  mail?: string;
  userPrincipalName: string;
  displayName: string;
  givenName?: string;
  surname?: string;
}

async function microsoftExchange(code: string): Promise<MicrosoftProfile> {
  const tenant = config.oauth.microsoft.tenantId;
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.oauth.microsoft.clientId,
      client_secret: config.oauth.microsoft.clientSecret,
      redirect_uri: `${config.frontendUrl}/auth/oauth/callback`,
      grant_type: 'authorization_code',
      scope: 'openid email profile User.Read',
    }),
  });
  if (!tokenRes.ok) throw new Error('Microsoft token exchange failed');
  const tokens = (await tokenRes.json()) as MicrosoftTokenResponse;

  const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) throw new Error('Microsoft profile fetch failed');
  return (await profileRes.json()) as MicrosoftProfile;
}

router.post('/microsoft', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: req.t('errors.authorizationCodeRequired') }); return; }
    if (!config.oauth.microsoft.clientId) { res.status(501).json({ error: req.t('errors.microsoftOAuthNotConfigured') }); return; }

    const profile = await microsoftExchange(code);
    const email = (profile.mail || profile.userPrincipalName).toLowerCase();

    let user = await User.findOne({
      'oauthAccounts.provider': 'microsoft',
      'oauthAccounts.providerId': profile.id,
    }).setOptions({ bypassTenantCheck: true });

    if (!user) {
      user = await User.findOne({ email }).setOptions({ bypassTenantCheck: true });
    }

    if (!user || !user.isActive) {
      res.status(401).json({ error: req.t('errors.noMicrosoftAccount') });
      return;
    }

    if (!user.oauthAccounts.some((a) => a.provider === 'microsoft' && a.providerId === profile.id)) {
      user.oauthAccounts.push({
        provider: 'microsoft',
        providerId: profile.id,
        email,
        linkedAt: new Date(),
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const payload = await buildPayload(user);
    const tokens = generateTokens(payload);

    res.json({
      ...tokens,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: payload.role,
        permissions: payload.permissions,
        customRoleId: payload.customRoleId,
        customRoleName: payload.customRoleName,
        organizationId: user.organizationId,
      },
    });
  } catch (e) { next(e); }
});

// ── Available providers (public) ─────────────────────────────────────────────

router.get('/providers', (_req, res) => {
  res.json({
    google: !!config.oauth.google.clientId,
    microsoft: !!config.oauth.microsoft.clientId,
    passkey: true,
    googleClientId: config.oauth.google.clientId || undefined,
    microsoftClientId: config.oauth.microsoft.clientId || undefined,
    microsoftTenantId: config.oauth.microsoft.tenantId || undefined,
  });
});

export default router;
