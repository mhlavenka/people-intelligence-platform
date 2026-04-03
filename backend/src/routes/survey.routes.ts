import { Router, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { SurveyTemplate } from '../models/SurveyTemplate.model';
import { SurveyResponse } from '../models/SurveyResponse.model';

function makeSubmissionToken(userId: string, templateId: string): string {
  return createHash('sha256').update(`${userId}:${templateId}`).digest('hex');
}

const router = Router();
const MIN_GROUP_SIZE = 5;

router.use(authenticateToken, tenantResolver);

router.post(
  '/templates',
  requireRole('admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const template = await SurveyTemplate.create({
        ...req.body,
        organizationId: req.user!.organizationId,
        createdBy: req.user!.userId,
      });
      res.status(201).json(template);
    } catch (e) {
      next(e);
    }
  }
);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const templates = await SurveyTemplate.find({
      $or: [
        { organizationId: req.user!.organizationId },
        { isGlobal: true },
      ],
      isActive: true,
    }).setOptions({ bypassTenantCheck: true });
    res.json(templates);
  } catch (e) {
    next(e);
  }
});

router.get(
  '/templates',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const templates = await SurveyTemplate.find({
        $or: [
          { organizationId: req.user!.organizationId },
          { isGlobal: true },
        ],
        isActive: true,
      }).setOptions({ bypassTenantCheck: true });
      res.json(templates);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/templates/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const template = await SurveyTemplate.findOne({
        _id: req.params['id'],
        $or: [
          { organizationId: req.user!.organizationId },
          { isGlobal: true },
        ],
      }).setOptions({ bypassTenantCheck: true });
      if (!template) {
        res.status(404).json({ error: 'Survey template not found' });
        return;
      }
      if (!template.isActive) {
        res.status(410).json({ error: 'This survey is no longer active.' });
        return;
      }
      res.json(template);
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  '/templates/:id',
  requireRole('admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const template = await SurveyTemplate.findOneAndUpdate(
        { _id: req.params['id'], organizationId: req.user!.organizationId },
        req.body,
        { new: true, runValidators: true }
      );
      if (!template) {
        res.status(404).json({ error: 'Survey template not found' });
        return;
      }
      res.json(template);
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  '/templates/:id',
  requireRole('admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const template = await SurveyTemplate.findOneAndDelete({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!template) {
        res.status(404).json({ error: 'Survey template not found' });
        return;
      }
      res.json({ message: 'Template deleted' });
    } catch (e) {
      next(e);
    }
  }
);

// Check if the authenticated user already submitted a response for this template
router.get('/check/:templateId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = makeSubmissionToken(
      req.user!.userId.toString(),
      req.params['templateId']
    );
    const existing = await SurveyResponse.findOne({ submissionToken: token }).setOptions({ bypassTenantCheck: true });
    res.json({ alreadySubmitted: !!existing });
  } catch (e) {
    next(e);
  }
});

router.post('/respond', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { templateId, isAnonymous = true, departmentId, responses } = req.body;
    const userId = req.user!.userId.toString();
    const submissionToken = makeSubmissionToken(userId, templateId);

    // Duplicate check — DB unique index is the safety net, but give a friendly error here
    const existing = await SurveyResponse.findOne({ submissionToken }).setOptions({ bypassTenantCheck: true });
    if (existing) {
      res.status(409).json({ error: 'You have already submitted a response for this survey.' });
      return;
    }

    const doc: Record<string, unknown> = {
      organizationId: req.user!.organizationId,
      templateId,
      submissionToken,
      departmentId,
      responses,
      isAnonymous,
      submittedAt: new Date(),
    };

    // Only store the raw user reference when explicitly NOT anonymous
    if (!isAnonymous) {
      doc['respondentId'] = req.user!.userId;
    }

    const response = await SurveyResponse.create(doc);
    res.status(201).json({ message: 'Response recorded', id: response._id });
  } catch (e) {
    next(e);
  }
});

router.get(
  '/responses/:templateId/count',
  requireRole('admin', 'hr_manager', 'manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const count = await SurveyResponse.countDocuments({
        organizationId: req.user!.organizationId,
        templateId: req.params['templateId'],
      });
      res.json({ count });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/responses/:templateId',
  requireRole('admin', 'hr_manager', 'manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user!.organizationId;
      const count = await SurveyResponse.countDocuments({
        organizationId,
        templateId: req.params['templateId'],
      });

      if (count < MIN_GROUP_SIZE) {
        res.status(403).json({
          error: `Minimum ${MIN_GROUP_SIZE} responses required before viewing results. Current: ${count}`,
        });
        return;
      }

      // Return responses without respondentId to protect anonymity
      const responses = await SurveyResponse.find({
        organizationId,
        templateId: req.params['templateId'],
      }).select('-respondentId');

      res.json({ count, responses });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
