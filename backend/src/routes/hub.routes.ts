import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { Message } from '../models/Message.model';
import { Notification } from '../models/Notification.model';
import { User } from '../models/User.model';
import { sendMessageNotificationEmail } from '../services/email.service';

const router = Router();
router.use(authenticateToken, tenantResolver);

// ─── Unread count (badge) ─────────────────────────────────────────────────────

router.get('/unread-count', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const orgId  = new mongoose.Types.ObjectId(req.user!.organizationId);

    const [messages, notifications] = await Promise.all([
      Message.countDocuments({ organizationId: orgId, toUserId: userId, isRead: false }),
      Notification.countDocuments({ organizationId: orgId, userId, isRead: false }),
    ]);

    res.json({ messages, notifications, total: messages + notifications });
  } catch (e) { next(e); }
});

// ─── Messages ─────────────────────────────────────────────────────────────────

/** Inbox: latest message per conversation partner */
router.get('/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const orgId  = new mongoose.Types.ObjectId(req.user!.organizationId);

    const messages = await Message.find({
      organizationId: orgId,
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    })
      .sort({ createdAt: -1 })
      .lean()
      .setOptions({ bypassTenantCheck: true });

    // Group by conversation partner, keep only the latest per pair
    const seen = new Map<string, typeof messages[0]>();
    for (const m of messages) {
      const partnerId = m.fromUserId.toString() === req.user!.userId
        ? m.toUserId.toString()
        : m.fromUserId.toString();
      if (!seen.has(partnerId)) seen.set(partnerId, m);
    }

    const conversations = await Promise.all(
      [...seen.entries()].map(async ([partnerId, lastMsg]) => {
        const partner = await User.findById(partnerId)
          .select('firstName lastName role')
          .setOptions({ bypassTenantCheck: true });
        const unreadCount = await Message.countDocuments({
          organizationId: orgId,
          fromUserId: new mongoose.Types.ObjectId(partnerId),
          toUserId: userId,
          isRead: false,
        }).setOptions({ bypassTenantCheck: true });
        return { partner, lastMsg, unreadCount };
      })
    );

    res.json(conversations.filter(c => c.partner !== null));
  } catch (e) { next(e); }
});

/** Full thread with a specific user */
router.get('/messages/:userId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const me        = new mongoose.Types.ObjectId(req.user!.userId);
    const other     = new mongoose.Types.ObjectId(req.params['userId']);
    const orgId     = new mongoose.Types.ObjectId(req.user!.organizationId);

    const thread = await Message.find({
      organizationId: orgId,
      $or: [
        { fromUserId: me,    toUserId: other },
        { fromUserId: other, toUserId: me },
      ],
    })
      .sort({ createdAt: 1 })
      .lean()
      .setOptions({ bypassTenantCheck: true });

    // Mark incoming messages as read
    await Message.updateMany(
      { organizationId: orgId, fromUserId: other, toUserId: me, isRead: false },
      { isRead: true }
    ).setOptions({ bypassTenantCheck: true });

    res.json(thread);
  } catch (e) { next(e); }
});

/** Send a message */
router.post('/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { toUserId, content } = req.body;
    if (!toUserId || !content?.trim()) {
      res.status(400).json({ error: 'toUserId and content are required' });
      return;
    }

    const orgId    = new mongoose.Types.ObjectId(req.user!.organizationId);
    const fromId   = new mongoose.Types.ObjectId(req.user!.userId);
    const toId     = new mongoose.Types.ObjectId(toUserId);

    const recipient = await User.findOne({ _id: toId, organizationId: orgId })
      .setOptions({ bypassTenantCheck: true });
    if (!recipient) {
      res.status(404).json({ error: 'Recipient not found in this organization' });
      return;
    }

    const message = await Message.create({
      organizationId: orgId,
      fromUserId: fromId,
      toUserId: toId,
      content: content.trim(),
    });

    // Create in-app notification for the recipient
    const sender = await User.findById(fromId).setOptions({ bypassTenantCheck: true });
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';

    await Notification.create({
      organizationId: orgId,
      userId: toId,
      type: 'message',
      title: `New message from ${senderName}`,
      body: content.trim().slice(0, 120),
      link: '/dashboard',
    });

    // Email notification (fire-and-forget)
    sendMessageNotificationEmail({
      email: recipient.email,
      firstName: recipient.firstName,
      fromName: senderName,
      preview: content.trim().slice(0, 200),
    }).catch((err) => console.warn('[Hub] Email notification failed:', err));

    res.status(201).json(message);
  } catch (e) { next(e); }
});

/** List org users available to message */
router.get('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId  = new mongoose.Types.ObjectId(req.user!.organizationId);
    const meId   = req.user!.userId;

    const users = await User.find({
      organizationId: orgId,
      _id: { $ne: meId },
      isActive: true,
      role: { $ne: 'system_admin' },
    })
      .select('firstName lastName role')
      .sort({ firstName: 1 })
      .lean()
      .setOptions({ bypassTenantCheck: true });

    res.json(users);
  } catch (e) { next(e); }
});

// ─── Notifications ────────────────────────────────────────────────────────────

router.get('/notifications', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const orgId  = new mongoose.Types.ObjectId(req.user!.organizationId);

    const notifications = await Notification.find({ organizationId: orgId, userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .setOptions({ bypassTenantCheck: true });

    res.json(notifications);
  } catch (e) { next(e); }
});

router.put('/notifications/read-all', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const orgId  = new mongoose.Types.ObjectId(req.user!.organizationId);

    await Notification.updateMany(
      { organizationId: orgId, userId, isRead: false },
      { isRead: true }
    ).setOptions({ bypassTenantCheck: true });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/notifications/:id/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const orgId  = new mongoose.Types.ObjectId(req.user!.organizationId);

    await Notification.findOneAndUpdate(
      { _id: req.params['id'], organizationId: orgId, userId },
      { isRead: true }
    ).setOptions({ bypassTenantCheck: true });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
