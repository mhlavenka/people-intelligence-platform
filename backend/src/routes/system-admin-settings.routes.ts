import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { AppSettings } from '../models/AppSettings.model';

const router = Router();

router.use(authenticateToken, requireRole('system_admin'));

/** Get current app settings (creates defaults if none exist). */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = await AppSettings.create({});
    }
    res.json(settings);
  } catch (e) {
    next(e);
  }
});

/** Update app settings (partial merge). */
router.put('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { passwordPolicy, loginPolicy, sessionPolicy, tokenPolicy, general } = req.body;

    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = await AppSettings.create({});
    }

    if (passwordPolicy) { Object.assign(settings.passwordPolicy, passwordPolicy); }
    if (loginPolicy)    { Object.assign(settings.loginPolicy, loginPolicy); }
    if (sessionPolicy)  { Object.assign(settings.sessionPolicy, sessionPolicy); }
    if (tokenPolicy)    { Object.assign(settings.tokenPolicy, tokenPolicy); }
    if (general)        { Object.assign(settings.general, general); }

    settings.updatedBy = req.user!.userId as any;
    await settings.save();

    res.json(settings);
  } catch (e) {
    next(e);
  }
});

/** Reset all settings to defaults. */
router.post('/reset', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await AppSettings.deleteMany({});
    const settings = await AppSettings.create({ updatedBy: req.user!.userId });
    res.json(settings);
  } catch (e) {
    next(e);
  }
});

export default router;
