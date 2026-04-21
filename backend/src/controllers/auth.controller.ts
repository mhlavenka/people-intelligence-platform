import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import i18next from 'i18next';

function t(req: Request, key: string): string {
  if (typeof req.t === 'function') return req.t(key);
  return i18next.t(key) as string;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticator } = require('otplib') as typeof import('otplib');
import crypto from 'crypto';
import { Organization } from '../models/Organization.model';
import { User, IUser } from '../models/User.model';
import { LoginSession } from '../models/LoginSession.model';
import { CustomRole } from '../models/CustomRole.model';
import { SystemRoleOverride } from '../models/SystemRoleOverride.model';
import { SYSTEM_ROLE_PERMISSIONS } from '../config/permissions';
import { config } from '../config/env';

interface TokenPayload {
  userId: string;
  organizationId: string;
  role: string;
  email: string;
  permissions?: string[];
  customRoleId?: string;
  customRoleName?: string;
}

async function trackLoginSession(req: Request, userId: string, organizationId: string, accessToken: string): Promise<void> {
  try {
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    const ua = req.headers['user-agent'] || 'Unknown device';
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '';
    const device = parseDevice(ua);

    await LoginSession.findOneAndUpdate(
      { userId, device, ip },
      { userId, organizationId, tokenHash, device, ip, lastActiveAt: new Date() },
      { upsert: true },
    );
  } catch (err) {
    console.error('[LoginSession] Failed to track session:', err);
  }
}

function parseDevice(ua: string): string {
  if (ua.includes('Capacitor') || ua.includes('Android')) return 'ARTES Mobile (Android)';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'ARTES Mobile (iOS)';
  if (ua.includes('Chrome')) return 'Chrome Browser';
  if (ua.includes('Firefox')) return 'Firefox Browser';
  if (ua.includes('Safari')) return 'Safari Browser';
  if (ua.includes('Edge')) return 'Edge Browser';
  return ua.substring(0, 80);
}

export function generateTokens(payload: TokenPayload): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

/** Effective "coachee can choose their own coach when booking": user override
 *  beats org default; undefined on User means inherit. */
export async function resolveCanChooseCoach(user: IUser): Promise<boolean> {
  if (typeof user.canChooseCoach === 'boolean') return user.canChooseCoach;
  const org = await Organization.findById(user.organizationId)
    .select('coacheeCanChooseCoach')
    .setOptions({ bypassTenantCheck: true });
  return org?.coacheeCanChooseCoach !== false;
}

/** Build the JWT payload for a user, resolving custom role permissions if set. */
export async function buildPayload(user: IUser): Promise<TokenPayload> {
  const base: TokenPayload = {
    userId:         user._id.toString(),
    organizationId: user.organizationId.toString(),
    role:           user.role,
    email:          user.email,
  };

  if (user.customRoleId) {
    const customRole = await CustomRole.findById(user.customRoleId)
      .setOptions({ bypassTenantCheck: true });
    if (customRole) {
      return {
        ...base,
        role:           customRole.baseRole,
        permissions:    customRole.permissions,
        customRoleId:   customRole._id.toString(),
        customRoleName: customRole.name,
      };
    }
  }

  // System role: check for org-level override, fall back to defaults
  const override = await SystemRoleOverride.findOne({
    organizationId: user.organizationId,
    role: user.role,
  }).setOptions({ bypassTenantCheck: true });

  return {
    ...base,
    permissions: override ? override.permissions : (SYSTEM_ROLE_PERMISSIONS[user.role] ?? []),
  };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgName, orgSlug, billingEmail, firstName, lastName, email, password } = req.body;

    const existingOrg = await Organization.findOne({ slug: orgSlug }).setOptions({ bypassTenantCheck: true });
    if (existingOrg) {
      res.status(409).json({ error: t(req, 'errors.orgSlugTaken') });
      return;
    }

    const org = await Organization.create({
      name: orgName,
      slug: orgSlug,
      billingEmail,
      plan: 'starter',
      modules: ['conflict'],
    });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      organizationId: org._id,
      email,
      passwordHash,
      role: 'admin',
      firstName,
      lastName,
    });

    const payload = await buildPayload(user);
    const tokens = generateTokens(payload);

    res.status(201).json({
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
        organizationId: org._id,
        profilePicture: user.profilePicture,
        isCoachee: user.isCoachee === true,
        canChooseCoach: true,
        preferredLanguage: user.preferredLanguage,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).setOptions({ bypassTenantCheck: true });
    if (!user || !user.isActive) {
      res.status(401).json({ error: t(req, 'errors.invalidCredentials') });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: t(req, 'errors.invalidCredentials') });
      return;
    }

    // If 2FA is enabled, issue a short-lived temp token instead of full tokens
    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign(
        { pending2fa: true, userId: user._id.toString(), organizationId: user.organizationId.toString() },
        config.jwt.secret,
        { expiresIn: '5m' } as jwt.SignOptions
      );
      res.json({ requiresTwoFactor: true, tempToken });
      return;
    }

    user.lastLoginAt = new Date();
    await user.save();

    const payload = await buildPayload(user);
    const tokens = generateTokens(payload);

    trackLoginSession(req, user._id.toString(), user.organizationId.toString(), tokens.accessToken);

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
        profilePicture: user.profilePicture,
        isCoachee: user.isCoachee === true,
        canChooseCoach: await resolveCanChooseCoach(user),
        preferredLanguage: user.preferredLanguage,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(401).json({ error: t(req, 'errors.refreshTokenRequired') });
      return;
    }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as TokenPayload;

    // Re-resolve permissions from the database so that role/permission
    // changes take effect without requiring a full re-login.
    const user = await User.findById(decoded.userId).setOptions({ bypassTenantCheck: true });
    let payload: TokenPayload;
    if (user) {
      payload = await buildPayload(user);
    } else {
      const { iat, exp, ...cleanPayload } = decoded as TokenPayload & { iat?: number; exp?: number };
      payload = cleanPayload;
    }

    const tokens = generateTokens(payload);

    trackLoginSession(req, payload.userId, payload.organizationId, tokens.accessToken);

    res.json({ ...tokens, user: payload });
  } catch (err) {
    console.error('[Refresh] Token verification failed:', (err as Error).message);
    res.status(401).json({ error: t(req, 'errors.invalidRefreshToken') });
  }
}

export async function verify2fa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tempToken, otp } = req.body;
    if (!tempToken || !otp) {
      res.status(400).json({ error: t(req, 'errors.tempTokenAndOtpRequired') });
      return;
    }

    let pending: { pending2fa: boolean; userId: string; organizationId: string };
    try {
      pending = jwt.verify(tempToken, config.jwt.secret) as typeof pending;
    } catch {
      res.status(401).json({ error: t(req, 'errors.invalidOrExpiredTokenLogin') });
      return;
    }

    if (!pending.pending2fa) {
      res.status(400).json({ error: t(req, 'errors.invalidTokenType') });
      return;
    }

    // Load user with secret (field is select:false by default)
    const user = await User.findById(pending.userId)
      .select('+twoFactorSecret')
      .setOptions({ bypassTenantCheck: true });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      res.status(401).json({ error: t(req, 'errors.invalidCredentialsDot') });
      return;
    }

    const valid = authenticator.verify({ token: otp.replace(/\s/g, ''), secret: user.twoFactorSecret });
    if (!valid) {
      res.status(401).json({ error: t(req, 'errors.invalidAuthenticatorCode') });
      return;
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
        profilePicture: user.profilePicture,
        isCoachee: user.isCoachee === true,
        canChooseCoach: await resolveCanChooseCoach(user),
        preferredLanguage: user.preferredLanguage,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body;
    // Always return success to prevent email enumeration
    const user = await User.findOne({ email: email.toLowerCase() }).setOptions({ bypassTenantCheck: true });
    if (user) {
      // TODO: Generate reset token, hash it, store it, send email
      console.log(`[Auth] Password reset requested for ${email}`);
    }
    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (error) {
    next(error);
  }
}
