import { Router, Response, NextFunction } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { User, IPasskeyCredential } from '../models/User.model';
import { config } from '../config/env';
import jwt from 'jsonwebtoken';
import { buildPayload, generateTokens } from '../controllers/auth.controller';

const router = Router();

const rpName = config.webauthn.rpName;
const rpId   = config.webauthn.rpId;
const origin = config.webauthn.origin;

// In-memory challenge store (short-lived, keyed by unique ID)
const challengeStore = new Map<string, { challenge: string; expires: number }>();

function storeChallenge(key: string, challenge: string): void {
  challengeStore.set(key, { challenge, expires: Date.now() + 5 * 60 * 1000 });
}

function getChallenge(key: string): string | null {
  const entry = challengeStore.get(key);
  if (!entry || entry.expires < Date.now()) { challengeStore.delete(key); return null; }
  challengeStore.delete(key);
  return entry.challenge;
}

// ── Registration: generate options (authenticated user adds a passkey) ──────

router.post(
  '/register-options',
  authenticateToken, tenantResolver,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await User.findOne({
        _id: req.user!.userId,
        organizationId: req.user!.organizationId,
      });
      if (!user) { res.status(404).json({ error: 'User not found' }); return; }

      const existingCredentials = (user.passkeys || []).map((pk) => ({
        id: pk.credentialId,
        transports: (pk.transports || []) as AuthenticatorTransport[],
      }));

      const options = await generateRegistrationOptions({
        rpName,
        rpID: rpId,
        userName: user.email,
        userDisplayName: `${user.firstName} ${user.lastName}`,
        attestationType: 'none',
        excludeCredentials: existingCredentials,
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
      });

      storeChallenge(`reg:${user._id}`, options.challenge);
      res.json(options);
    } catch (e) { next(e); }
  }
);

// ── Registration: verify response ───────────────────────────────────────────

router.post(
  '/register-verify',
  authenticateToken, tenantResolver,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await User.findOne({
        _id: req.user!.userId,
        organizationId: req.user!.organizationId,
      });
      if (!user) { res.status(404).json({ error: 'User not found' }); return; }

      const expectedChallenge = getChallenge(`reg:${user._id}`);
      if (!expectedChallenge) { res.status(400).json({ error: 'Challenge expired. Please try again.' }); return; }

      const { credential, label } = req.body as {
        credential: RegistrationResponseJSON;
        label?: string;
      };

      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
      });

      if (!verification.verified || !verification.registrationInfo) {
        res.status(400).json({ error: 'Passkey verification failed' });
        return;
      }

      const { credential: cred, credentialDeviceType } = verification.registrationInfo;

      const newPasskey: IPasskeyCredential = {
        credentialId: cred.id,
        publicKey: Buffer.from(cred.publicKey).toString('base64url'),  // publicKey is Uint8Array
        counter: cred.counter,
        deviceType: credentialDeviceType,
        transports: credential.response.transports || [],
        createdAt: new Date(),
        label: label || 'Passkey',
      };

      user.passkeys.push(newPasskey);
      await user.save();

      res.json({ message: 'Passkey registered', passkeyCount: user.passkeys.length });
    } catch (e) { next(e); }
  }
);

// ── Authentication: generate options (unauthenticated) ──────────────────────

router.post('/login-options', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: 'Email is required' }); return; }

    const user = await User.findOne({ email: email.toLowerCase() }).setOptions({ bypassTenantCheck: true });
    if (!user || !user.isActive || !user.passkeys?.length) {
      res.status(400).json({ error: 'No passkey registered for this account' });
      return;
    }

    const allowCredentials = user.passkeys.map((pk) => ({
      id: pk.credentialId,
      transports: (pk.transports || []) as AuthenticatorTransport[],
    }));

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      allowCredentials,
      userVerification: 'preferred',
    });

    storeChallenge(`auth:${user._id}`, options.challenge);
    res.json({ options, userId: user._id.toString() });
  } catch (e) { next(e); }
});

// ── Authentication: verify response ─────────────────────────────────────────

router.post('/login-verify', async (req, res, next) => {
  try {
    const { userId, credential } = req.body as {
      userId: string;
      credential: AuthenticationResponseJSON;
    };

    const user = await User.findById(userId).setOptions({ bypassTenantCheck: true });
    if (!user || !user.isActive) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    const expectedChallenge = getChallenge(`auth:${user._id}`);
    if (!expectedChallenge) { res.status(400).json({ error: 'Challenge expired' }); return; }

    const credId = credential.id;
    const passkey = user.passkeys.find((pk) => pk.credentialId === credId);
    if (!passkey) { res.status(401).json({ error: 'Unknown passkey' }); return; }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: passkey.credentialId,
        publicKey: Buffer.from(passkey.publicKey, 'base64url'),
        counter: passkey.counter,
        transports: (passkey.transports || []) as AuthenticatorTransport[],
      },
    });

    if (!verification.verified) {
      res.status(401).json({ error: 'Passkey verification failed' });
      return;
    }

    // Update counter
    passkey.counter = verification.authenticationInfo.newCounter;
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

// ── List / delete passkeys (authenticated) ──────────────────────────────────

router.get(
  '/passkeys',
  authenticateToken, tenantResolver,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await User.findOne({ _id: req.user!.userId, organizationId: req.user!.organizationId });
      if (!user) { res.status(404).json({ error: 'User not found' }); return; }
      res.json(user.passkeys.map((pk) => ({
        credentialId: pk.credentialId,
        label: pk.label,
        deviceType: pk.deviceType,
        createdAt: pk.createdAt,
      })));
    } catch (e) { next(e); }
  }
);

router.delete(
  '/passkeys/:credentialId',
  authenticateToken, tenantResolver,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await User.findOne({ _id: req.user!.userId, organizationId: req.user!.organizationId });
      if (!user) { res.status(404).json({ error: 'User not found' }); return; }
      user.passkeys = user.passkeys.filter((pk) => pk.credentialId !== req.params['credentialId']);
      await user.save();
      res.json({ message: 'Passkey removed', passkeyCount: user.passkeys.length });
    } catch (e) { next(e); }
  }
);

export default router;
