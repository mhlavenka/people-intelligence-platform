import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticator } = require('otplib') as typeof import('otplib');
import { Organization } from '../models/Organization.model';
import { User, IUser } from '../models/User.model';
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
      res.status(409).json({ error: req.t('errors.orgSlugTaken') });
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
      res.status(401).json({ error: req.t('errors.invalidCredentials') });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: req.t('errors.invalidCredentials') });
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
      res.status(401).json({ error: req.t('errors.refreshTokenRequired') });
      return;
    }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as TokenPayload;
    const tokens = generateTokens(decoded);
    res.json(tokens);
  } catch {
    res.status(401).json({ error: req.t('errors.invalidRefreshToken') });
    next;
  }
}

export async function verify2fa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tempToken, otp } = req.body;
    if (!tempToken || !otp) {
      res.status(400).json({ error: req.t('errors.tempTokenAndOtpRequired') });
      return;
    }

    let pending: { pending2fa: boolean; userId: string; organizationId: string };
    try {
      pending = jwt.verify(tempToken, config.jwt.secret) as typeof pending;
    } catch {
      res.status(401).json({ error: req.t('errors.invalidOrExpiredTokenLogin') });
      return;
    }

    if (!pending.pending2fa) {
      res.status(400).json({ error: req.t('errors.invalidTokenType') });
      return;
    }

    // Load user with secret (field is select:false by default)
    const user = await User.findById(pending.userId)
      .select('+twoFactorSecret')
      .setOptions({ bypassTenantCheck: true });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      res.status(401).json({ error: req.t('errors.invalidCredentialsDot') });
      return;
    }

    const valid = authenticator.verify({ token: otp.replace(/\s/g, ''), secret: user.twoFactorSecret });
    if (!valid) {
      res.status(401).json({ error: req.t('errors.invalidAuthenticatorCode') });
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
