import { Router, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { SurveyTemplate } from '../models/SurveyTemplate.model';
import { SurveyResponse } from '../models/SurveyResponse.model';

function makeSubmissionToken(userId: string, templateId: string, sessionId?: string): string {
  const payload = sessionId ? `${userId}:${templateId}:${sessionId}` : `${userId}:${templateId}`;
  return createHash('sha256').update(payload).digest('hex');
}

const router = Router();
const MIN_GROUP_SIZE = 5;

router.use(authenticateToken, tenantResolver);

router.post(
  '/templates',
  requireRole('admin', 'hr_manager', 'coach'),
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
      const filter: Record<string, unknown> = {
        $or: [
          { organizationId: req.user!.organizationId },
          { isGlobal: true },
        ],
      };
      if (req.query['includeInactive'] !== 'true') {
        filter['isActive'] = true;
      }
      const templates = await SurveyTemplate.find(filter).setOptions({ bypassTenantCheck: true });
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
        res.status(404).json({ error: 'Intake template not found' });
        return;
      }
      if (!template.isActive) {
        res.status(410).json({ error: 'This intake is no longer active.' });
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
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const template = await SurveyTemplate.findOneAndUpdate(
        { _id: req.params['id'], $or: [{ organizationId: req.user!.organizationId }, { isGlobal: true }] },
        req.body,
        { new: true, runValidators: true }
      ).setOptions({ bypassTenantCheck: true });
      if (!template) {
        res.status(404).json({ error: 'Intake template not found' });
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
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const template = await SurveyTemplate.findOneAndDelete({
        _id: req.params['id'],
        $or: [{ organizationId: req.user!.organizationId }, { isGlobal: true }],
      }).setOptions({ bypassTenantCheck: true });
      if (!template) {
        res.status(404).json({ error: 'Intake template not found' });
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
    const sessionId = typeof req.query['sessionId'] === 'string' ? req.query['sessionId'] : undefined;
    const token = makeSubmissionToken(
      req.user!.userId.toString(),
      req.params['templateId'],
      sessionId,
    );
    const existing = await SurveyResponse.findOne({ submissionToken: token }).setOptions({ bypassTenantCheck: true });
    res.json({ alreadySubmitted: !!existing });
  } catch (e) {
    next(e);
  }
});

router.post('/respond', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      templateId, isAnonymous = true, departmentId, responses,
      coacheeId, sessionFormat, targetName, sessionId,
    } = req.body;

    // When a coach submits on behalf of a coachee, de-duplicate by coachee+template.
    // When the response is tied to a coaching session, include the sessionId so
    // the same template can be reused across multiple sessions for the same coachee.
    const tokenSubject = coacheeId ? coacheeId.toString() : req.user!.userId.toString();
    const submissionToken = makeSubmissionToken(tokenSubject, templateId, sessionId);

    // Duplicate check — DB unique index is the safety net, but give a friendly error here
    const existing = await SurveyResponse.findOne({ submissionToken }).setOptions({ bypassTenantCheck: true });
    if (existing) {
      res.status(409).json({ error: 'A response for this coachee and template has already been submitted.' });
      return;
    }

    const doc: Record<string, unknown> = {
      organizationId: req.user!.organizationId,
      templateId,
      submissionToken,
      departmentId,
      responses,
      isAnonymous: coacheeId ? false : isAnonymous,
      submittedAt: new Date(),
    };

    if (sessionId) doc['sessionId'] = sessionId;

    // Coach-led submission: attribute to the coachee
    if (coacheeId) {
      doc['respondentId'] = coacheeId;
      doc['coachId'] = req.user!.userId;
      if (sessionFormat) doc['sessionFormat'] = sessionFormat;
      if (targetName)    doc['targetName']    = targetName;
    } else if (!isAnonymous) {
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
  requireRole('admin', 'hr_manager', 'manager', 'coach'),
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

router.delete(
  '/responses/:templateId',
  requireRole('admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await SurveyResponse.deleteMany({
        organizationId: req.user!.organizationId,
        templateId: req.params['templateId'],
      });
      res.json({ message: 'Responses cleared', deletedCount: result.deletedCount });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/responses/:templateId',
  requireRole('admin', 'hr_manager', 'manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user!.organizationId;
      const templateId = req.params['templateId'];
      const sessionId = typeof req.query['sessionId'] === 'string' ? req.query['sessionId'] : undefined;

      const template = await SurveyTemplate.findById(templateId).setOptions({ bypassTenantCheck: true });
      const isSurvey = !template || template.intakeType === 'survey';
      // When scoped to a single session the aggregation floor doesn't apply —
      // there's exactly one known respondent and anonymity is not at stake.
      const minRequired = sessionId
        ? 1
        : template?.minResponsesForAnalysis ?? (isSurvey ? MIN_GROUP_SIZE : 1);

      const filter: Record<string, unknown> = { organizationId, templateId };
      if (sessionId) filter['sessionId'] = sessionId;

      const count = await SurveyResponse.countDocuments(filter);

      if (count < minRequired) {
        res.status(403).json({
          error: `Minimum ${minRequired} response${minRequired > 1 ? 's' : ''} required before viewing results. Current: ${count}`,
        });
        return;
      }

      // Return responses without respondentId to protect anonymity — except
      // when scoped to a single session, where the response is already
      // coachee-attributed by design.
      const query = SurveyResponse.find(filter);
      if (!sessionId) query.select('-respondentId');
      const responses = await query;

      res.json({ count, responses });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
