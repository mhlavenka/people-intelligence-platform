import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticator } = require('otplib') as typeof import('otplib');
import { Organization } from '../models/Organization.model';
import { User } from '../models/User.model';
import { config } from '../config/env';

interface TokenPayload {
  userId: string;
  organizationId: string;
  role: string;
  email: string;
}

function generateTokens(payload: TokenPayload): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgName, orgSlug, billingEmail, firstName, lastName, email, password } = req.body;

    const existingOrg = await Organization.findOne({ slug: orgSlug }).setOptions({ bypassTenantCheck: true });
    if (existingOrg) {
      res.status(409).json({ error: 'Organization slug already taken' });
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

    const tokens = generateTokens({
      userId: user._id.toString(),
      organizationId: org._id.toString(),
      role: user.role,
      email: user.email,
    });

    res.status(201).json({
      ...tokens,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: org._id,
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
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
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

    const tokens = generateTokens({
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      role: user.role,
      email: user.email,
    });

    res.json({
      ...tokens,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
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
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as TokenPayload;
    const tokens = generateTokens(decoded);
    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
    next;
  }
}

export async function verify2fa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tempToken, otp } = req.body;
    if (!tempToken || !otp) {
      res.status(400).json({ error: 'tempToken and otp are required.' });
      return;
    }

    let payload: { pending2fa: boolean; userId: string; organizationId: string };
    try {
      payload = jwt.verify(tempToken, config.jwt.secret) as typeof payload;
    } catch {
      res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
      return;
    }

    if (!payload.pending2fa) {
      res.status(400).json({ error: 'Invalid token type.' });
      return;
    }

    // Load user with secret (field is select:false by default)
    const user = await User.findById(payload.userId)
      .select('+twoFactorSecret')
      .setOptions({ bypassTenantCheck: true });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const valid = authenticator.verify({ token: otp.replace(/\s/g, ''), secret: user.twoFactorSecret });
    if (!valid) {
      res.status(401).json({ error: 'Invalid authenticator code. Please try again.' });
      return;
    }

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = generateTokens({
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      role: user.role,
      email: user.email,
    });

    res.json({
      ...tokens,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
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
