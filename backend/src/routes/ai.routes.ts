import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.middleware';
import { callClaude } from '../services/ai.service';

const router = Router();
router.use(authenticateToken);

router.post(
  '/analyze',
  requirePermission('RUN_CONFLICT_ANALYSIS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { prompt, systemPrompt } = req.body;
      if (!prompt) {
        res.status(400).json({ error: 'prompt is required' });
        return;
      }
      const result = await callClaude(prompt, systemPrompt);
      res.json({ result });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
