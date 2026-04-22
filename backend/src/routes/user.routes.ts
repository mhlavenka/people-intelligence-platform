import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticator } = require('otplib') as typeof import('otplib');
import QRCode from 'qrcode';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { User } from '../models/User.model';
import { sendEmail } from '../services/email.service';
import { config } from '../config/env';
import { ensureUserPublicSlug } from './booking.routes';

const s3 = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, and WebP images are accepted'));
      return;
    }
    cb(null, true);
  },
});

async function uploadAvatarToS3(file: Express.Multer.File, userId: string): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const key = `avatars/${userId}-${Date.now()}${ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));
  return `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
}

const router = Router();
router.use(authenticateToken, tenantResolver);

// ── Own profile endpoints (any authenticated user) ──────────────────────────

router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findOne({
      _id: req.user!.userId,
      organizationId: req.user!.organizationId,
    }).select('-passwordHash');
    if (!user) { res.status(404).json({ error: req.t('errors.userNotFound') }); return; }
    res.json(user);
  } catch (e) { next(e); }
});

router.put('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, bio, publicSlug, preferredLanguage } = req.body;
    const update: Record<string, unknown> = { firstName, lastName };
    if (preferredLanguage !== undefined) {
      if (['en', 'fr', 'es', 'sk'].includes(preferredLanguage)) {
        update['preferredLanguage'] = preferredLanguage;
      }
    }
    if (bio !== undefined) update['bio'] = String(bio).trim().slice(0, 2000);
    if (publicSlug !== undefined) {
      const cleaned = String(publicSlug).trim().toLowerCase()
        .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!cleaned) { res.status(400).json({ error: req.t('errors.invalidPublicSlug') }); return; }
      const clash = await User.findOne({ publicSlug: cleaned, _id: { $ne: req.user!.userId } })
        .setOptions({ bypassTenantCheck: true });
      if (clash) { res.status(409).json({ error: req.t('errors.slugTaken') }); return; }
      update['publicSlug'] = cleaned;
    }
    const user = await User.findOneAndUpdate(
      { _id: req.user!.userId, organizationId: req.user!.organizationId },
      update,
      { new: true, runValidators: true }
    ).select('-passwordHash');
    if (!user) { res.status(404).json({ error: req.t('errors.userNotFound') }); return; }
    res.json(user);
  } catch (e) { next(e); }
});

// Ensure + return public slug (auto-generates from name on first call)
router.post('/me/public-slug', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user!.userId).select('_id firstName lastName publicSlug');
    if (!user) { res.status(404).json({ error: req.t('errors.userNotFound') }); return; }
    const slug = await ensureUserPublicSlug(user);
    res.json({ publicSlug: slug });
  } catch (e) { next(e); }
});

/** Get notification preferences. */
router.get('/me/notification-preferences', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findOne({
      _id: req.user!.userId, organizationId: req.user!.organizationId,
    }).select('notificationPreferences');
    if (!user) { res.status(404).json({ error: req.t('errors.userNotFound') }); return; }
    const defaults = {
      calendarInvites: false,
      sessionScheduled: true, sessionReminders: true, sessionForms: true,
      bookingConfirmed: true, bookingCancelled: true, bookingRescheduled: true,
      engagementCreated: true, directMessages: true,
    };
    res.json({ ...defaults, ...user.notificationPreferences });
  } catch (e) { next(e); }
});

/** Update notification preferences. */
router.put('/me/notification-preferences', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const allowed = [
      'calendarInvites',
      'sessionScheduled', 'sessionReminders', 'sessionForms',
      'bookingConfirmed', 'bookingCancelled', 'bookingRescheduled',
      'engagementCreated', 'directMessages',
    ];
    const prefs: Record<string, boolean> = {};
    for (const key of allowed) {
      if (typeof req.body[key] === 'boolean') prefs[key] = req.body[key];
    }
    const user = await User.findOneAndUpdate(
      { _id: req.user!.userId, organizationId: req.user!.organizationId },
      { notificationPreferences: prefs },
      { new: true },
    ).select('notificationPreferences');
    if (!user) { res.status(404).json({ error: req.t('errors.userNotFound') }); return; }
    res.json(user.notificationPreferences);
  } catch (e) { next(e); }
});

/** Upload profile picture (own). */
router.post('/me/avatar', avatarUpload.single('avatar'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ error: req.t('errors.noImageFileProvided') }); return; }
    const profilePicture = await uploadAvatarToS3(req.file, req.user!.userId.toString());
    const user = await User.findOneAndUpdate(
      { _id: req.user!.userId, organizationId: req.user!.organizationId },
      { profilePicture },
      { new: true },
    ).select('-passwordHash');
    if (!user) { res.status(404).json({ error: req.t('errors.userNotFound') }); return; }
    res.json({ profilePicture: user.profilePicture });
  } catch (e) { next(e); }
});

/** Upload profile picture for any user (admin/HR). */
router.post(
  '/:id/avatar',
  requirePermission('MANAGE_USERS'),
  avatarUpload.single('avatar'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) { res.status(400).json({ error: req.t('errors.noImageFileProvided') }); return; }
      const profilePicture = await uploadAvatarToS3(req.file, req.params['id']);
      const user = await User.findOneAndUpdate(
        { _id: req.params['id'], organizationId: req.user!.organizationId },
        { profilePicture },
        { new: true },
      ).select('-passwordHash');
      if (!user) { res.status(404).json({ error: req.t('errors.userNotFound') }); return; }
      res.json({ profilePicture: user.profilePicture });
    } catch (e) { next(e); }
  }
);

router.put('/me/password', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: req.t('errors.currentAndNewPasswordRequired') });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: req.t('errors.passwordMinLength') });
      return;
    }
    const user = await User.findOne({
      _id: req.user!.userId,
      organizationId: req.user!.organizationId,
    });
    if (!user) { res.status(404).json({ error: req.t('errors.userNotFound') }); return; }
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) { res.status(400).json({ error: req.t('errors.currentPasswordIncorrect') }); return; }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password updated successfully.' });
  } catch (e) { next(e); }
});

// ── Two-factor authentication ────────────────────────────────────────────────

// Generate a new TOTP secret + QR code (does NOT enable 2FA yet)
router.post('/me/2fa/setup', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const secret = authenticator.generateSecret();
    const user = await User.findOne({
      _id: req.user!.userId, organizationId: req.user!.organizationId,
    });
    if (!user) { res.status(404).json({ error: req.t('errors.userNotFound') }); return; }

    const otpAuthUrl = authenticator.keyuri(user.email, 'ARTES', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Store secret temporarily — will be confirmed on /enable
    user.twoFactorSecret = secret;
    await user.save();

    res.json({ qrCodeDataUrl, secret, otpAuthUrl });
  } catch (e) { next(e); }
});

// Confirm OTP code and activate 2FA
router.post('/me/2fa/enable', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { otp } = req.body;
    const user = await User.findOne({
      _id: req.user!.userId, organizationId: req.user!.organizationId,
    }).select('+twoFactorSecret');
    if (!user || !user.twoFactorSecret) {
      res.status(400).json({ error: req.t('errors.run2faSetupFirst') }); return;
    }
    const valid = authenticator.verify({ token: otp?.replace(/\s/g, ''), secret: user.twoFactorSecret });
    if (!valid) { res.status(400).json({ error: req.t('errors.invalidCodeTryAgain') }); return; }

    user.twoFactorEnabled = true;
    await user.save();
    res.json({ message: 'Two-factor authentication enabled.' });
  } catch (e) { next(e); }
});

// Disable 2FA — requires current OTP to confirm
router.delete('/me/2fa', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { otp } = req.body;
    const user = await User.findOne({
      _id: req.user!.userId, organizationId: req.user!.organizationId,
    }).select('+twoFactorSecret');
    if (!user) { res.status(404).json({ error: req.t('errors.userNotFound') }); return; }
    if (!user.twoFactorEnabled) { res.status(400).json({ error: req.t('errors.twoFactorNotEnabled') }); return; }

    const valid = authenticator.verify({ token: otp?.replace(/\s/g, ''), secret: user.twoFactorSecret! });
    if (!valid) { res.status(400).json({ error: req.t('errors.invalidCode') }); return; }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();
    res.json({ message: 'Two-factor authentication disabled.' });
  } catch (e) { next(e); }
});

router.post('/me/test-email', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { to } = req.body as { to?: string };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!to || !emailRegex.test(to)) {
      res.status(400).json({ error: req.t('errors.validRecipientEmailRequired') });
      return;
    }

    const user = await User.findOne({
      _id: req.user!.userId,
      organizationId: req.user!.organizationId,
    }).select('firstName');

    if (!user) { res.status(404).json({ error: req.t('errors.userNotFound') }); return; }

    await sendEmail({
      to,
      subject: 'ARTES — Test Email',
      html: `
        <p>Hi there,</p>
        <p>This is a test email from <strong>ARTES</strong>, sent by ${user.firstName}.</p>
        <p>If you received this message, AWS SES email notifications are configured correctly.</p>
        <p style="color:#9aa5b4;font-size:12px;">Sent from the Email Notifications settings page.</p>
      `,
    });

    res.json({ ok: true, sentTo: to });
  } catch (e) { next(e); }
});

// ── Coach endpoint: list coachees in same org ────────────────────────────────

router.get(
  '/coachees',
  requirePermission('MANAGE_COACHING'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // A coachee is anyone already flagged, or anyone in the org who is a
      // legal candidate to be coached — i.e. not a coach/admin/system_admin.
      // Toggled via `?onlyActive=true` when the caller wants only flagged
      // coachees (e.g. the "Coachees" list view); default returns the pool
      // that a coach can pick from when attaching an engagement.
      const onlyActive = req.query['onlyActive'] === 'true';
      const filter: Record<string, unknown> = {
        organizationId: req.user!.organizationId,
        isActive: true,
      };
      if (onlyActive) {
        filter['isCoachee'] = true;
      } else {
        filter['role'] = { $nin: ['coach', 'admin', 'system_admin'] };
      }
      const users = await User.find(filter)
        .select('_id firstName lastName email department role isCoachee sponsorId profilePicture isActive')
        .populate('sponsorId', 'name email organization');
      res.json(users);
    } catch (e) { next(e); }
  }
);

// List active coaches in the same org with their public booking slug
// (auto-generated on demand for any that don't have one yet)
router.get(
  '/coaches',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coaches = await User.find({
        organizationId: req.user!.organizationId,
        role: 'coach',
        isActive: true,
      }).select('_id firstName lastName email profilePicture bio publicSlug');

      const result = [];
      for (const c of coaches) {
        const slug = await ensureUserPublicSlug(c);
        result.push({
          _id: c._id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          profilePicture: c.profilePicture ?? null,
          bio: c.bio ?? '',
          publicSlug: slug,
        });
      }
      res.json(result);
    } catch (e) { next(e); }
  },
);

// ── Admin / HR endpoints ─────────────────────────────────────────────────────

router.get(
  '/',
  requirePermission('VIEW_ALL_USERS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const users = await User.find({ organizationId: req.user!.organizationId })
        .select('-passwordHash')
        .populate('sponsorId', 'name email organization');
      res.json(users);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/',
  requirePermission('MANAGE_USERS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { email, password, firstName, lastName, role, department, customRoleId, isCoachee, canChooseCoach } = req.body;
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({
        organizationId: req.user!.organizationId,
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        department: department || null,
        customRoleId: customRoleId || null,
        isCoachee: isCoachee === true || role === 'coachee',
        canChooseCoach: typeof canChooseCoach === 'boolean' ? canChooseCoach : undefined,
      });
      res.status(201).json({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  '/:id',
  requirePermission('MANAGE_USERS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Never allow passwordHash to be set via this endpoint
      const { passwordHash: _, ...safeBody } = req.body;
      void _;
      const user = await User.findOneAndUpdate(
        { _id: req.params['id'], organizationId: req.user!.organizationId },
        safeBody,
        { new: true, runValidators: true }
      ).select('-passwordHash');
      if (!user) {
        res.status(404).json({ error: req.t('errors.userNotFound') });
        return;
      }
      res.json(user);
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  '/:id',
  requirePermission('MANAGE_USERS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (req.params['id'] === req.user!.userId.toString()) {
        res.status(400).json({ error: req.t('errors.cannotDeleteOwnAccount') });
        return;
      }
      const user = await User.findOneAndDelete({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!user) {
        res.status(404).json({ error: req.t('errors.userNotFound') });
        return;
      }
      res.json({ message: 'User deleted' });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
