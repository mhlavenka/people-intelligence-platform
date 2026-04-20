import { Router, Response, NextFunction } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { registerDeviceToken, unregisterDeviceToken } from '../services/push.service';

const router = Router();
router.use(authenticateToken, tenantResolver);

router.post('/register', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token, platform } = req.body;

    if (!token || !platform) {
      return res.status(400).json({ message: 'token and platform are required' });
    }

    if (!['android', 'ios', 'web'].includes(platform)) {
      return res.status(400).json({ message: 'platform must be android, ios, or web' });
    }

    await registerDeviceToken(
      req.user!.userId,
      req.user!.organizationId,
      token,
      platform,
    );

    res.json({ message: 'Device registered' });
  } catch (err) {
    next(err);
  }
});

router.delete('/unregister', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    await unregisterDeviceToken(req.user!.userId, token);
    res.json({ message: 'Device unregistered' });
  } catch (err) {
    next(err);
  }
});

export default router;
