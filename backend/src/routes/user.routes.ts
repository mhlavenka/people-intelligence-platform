import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticator } = require('otplib') as typeof import('otplib');
import QRCode from 'qrcode';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { User } from '../models/User.model';
import { sendEmail } from '../services/email.service';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'avatars');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${(req as AuthRequest).user!.userId}-${Date.now()}${ext}`);
    },
  }),
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

const router = Router();
router.use(authenticateToken, tenantResolver);

// ── Own profile endpoints (any authenticated user) ──────────────────────────

router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findOne({
      _id: req.user!.userId,
      organizationId: req.user!.organizationId,
    }).select('-passwordHash');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (e) { next(e); }
});

router.put('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName } = req.body;
    const user = await User.findOneAndUpdate(
      { _id: req.user!.userId, organizationId: req.user!.organizationId },
      { firstName, lastName },
      { new: true, runValidators: true }
    ).select('-passwordHash');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (e) { next(e); }
});

/** Upload profile picture (own). */
router.post('/me/avatar', avatarUpload.single('avatar'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No image file provided' }); return; }
    const profilePicture = `/uploads/avatars/${req.file.filename}`;
    const user = await User.findOneAndUpdate(
      { _id: req.user!.userId, organizationId: req.user!.organizationId },
      { profilePicture },
      { new: true },
    ).select('-passwordHash');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ profilePicture: user.profilePicture });
  } catch (e) { next(e); }
});

/** Upload profile picture for any user (admin/HR). */
router.post(
  '/:id/avatar',
  requireRole('admin', 'hr_manager'),
  avatarUpload.single('avatar'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) { res.status(400).json({ error: 'No image file provided' }); return; }
      const profilePicture = `/uploads/avatars/${req.file.filename}`;
      const user = await User.findOneAndUpdate(
        { _id: req.params['id'], organizationId: req.user!.organizationId },
        { profilePicture },
        { new: true },
      ).select('-passwordHash');
      if (!user) { res.status(404).json({ error: 'User not found' }); return; }
      res.json({ profilePicture: user.profilePicture });
    } catch (e) { next(e); }
  }
);

router.put('/me/password', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'currentPassword and newPassword are required.' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }
    const user = await User.findOne({
      _id: req.user!.userId,
      organizationId: req.user!.organizationId,
    });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) { res.status(400).json({ error: 'Current password is incorrect.' }); return; }
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
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

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
      res.status(400).json({ error: 'Run /me/2fa/setup first.' }); return;
    }
    const valid = authenticator.verify({ token: otp?.replace(/\s/g, ''), secret: user.twoFactorSecret });
    if (!valid) { res.status(400).json({ error: 'Invalid code. Please try again.' }); return; }

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
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    if (!user.twoFactorEnabled) { res.status(400).json({ error: '2FA is not enabled.' }); return; }

    const valid = authenticator.verify({ token: otp?.replace(/\s/g, ''), secret: user.twoFactorSecret! });
    if (!valid) { res.status(400).json({ error: 'Invalid code.' }); return; }

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
      res.status(400).json({ error: 'A valid recipient email address is required' });
      return;
    }

    const user = await User.findOne({
      _id: req.user!.userId,
      organizationId: req.user!.organizationId,
    }).select('firstName');

    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

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
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const users = await User.find({
        organizationId: req.user!.organizationId,
        role: 'coachee',
      }).select('_id firstName lastName email department');
      res.json(users);
    } catch (e) { next(e); }
  }
);

// ── Admin / HR endpoints ─────────────────────────────────────────────────────

router.get(
  '/',
  requireRole('admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const users = await User.find({ organizationId: req.user!.organizationId }).select(
        '-passwordHash'
      );
      res.json(users);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/',
  requireRole('admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { email, password, firstName, lastName, role, department, customRoleId } = req.body;
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
  requireRole('admin', 'hr_manager'),
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
        res.status(404).json({ error: 'User not found' });
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
  requireRole('admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (req.params['id'] === req.user!.userId.toString()) {
        res.status(400).json({ error: 'You cannot delete your own account.' });
        return;
      }
      const user = await User.findOneAndDelete({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ message: 'User deleted' });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
