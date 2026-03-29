import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { User } from '../models/User.model';

const router = Router();
router.use(authenticateToken, tenantResolver);

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
      const { email, password, firstName, lastName, role } = req.body;
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({
        organizationId: req.user!.organizationId,
        email,
        passwordHash,
        firstName,
        lastName,
        role,
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

export default router;
