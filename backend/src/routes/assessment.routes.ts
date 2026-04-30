import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { AssessmentRecord, AssessmentType, AssessmentPhase } from '../models/AssessmentRecord.model';
import { CoachingEngagement } from '../models/CoachingEngagement.model';
import { config } from '../config/env';
import { logActivity } from '../services/activityLog.service';

const router = Router();
router.use(authenticateToken, tenantResolver);

const s3Client = new S3Client({
  region: config.aws.region,
  ...(config.aws.accessKeyId && config.aws.secretAccessKey
    ? { credentials: { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey } }
    : {}),
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are accepted'));
      return;
    }
    cb(null, true);
  },
});

const ALLOWED_TYPES: AssessmentType[] = ['eq-i', 'disc', 'hogan', 'leadership_circle', 'mbti', '360', 'cliftonstrengths', 'tki', 'custom'];
const ALLOWED_PHASES: AssessmentPhase[] = ['baseline', 'midpoint', 'final', 'ad_hoc'];

/**
 * Authorize the requester for assessment operations on an engagement.
 * Coach (own engagement), the engagement's coachee, admin, and hr_manager
 * are allowed. Sponsors are explicitly excluded per the 15.1 design doc.
 */
async function authorizeEngagementAccess(
  req: AuthRequest,
  engagementId: string,
): Promise<InstanceType<typeof CoachingEngagement> | null> {
  const engagement = await CoachingEngagement.findOne({
    _id: engagementId,
    organizationId: req.user!.organizationId,
  });
  if (!engagement) return null;

  const role = req.user!.role;
  const userId = req.user!.userId;
  if (role === 'admin' || role === 'hr_manager') return engagement;
  if (role === 'coach' && String(engagement.coachId) === userId) return engagement;
  if (String(engagement.coacheeId) === userId) return engagement;
  return null;
}

/** Sanitise a `scores` payload coming from the client. Accepts a plain object
 *  or array of {key, value} pairs; rejects non-numeric values; trims keys. */
function normaliseScores(input: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!input) return out;
  const entries: Array<[string, unknown]> = Array.isArray(input)
    ? input.map((e) => [String((e as { key?: string }).key ?? ''), (e as { value?: unknown }).value])
    : Object.entries(input as Record<string, unknown>);
  for (const [rawKey, rawValue] of entries) {
    const key = String(rawKey).trim().slice(0, 80);
    if (!key) continue;
    const num = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (Number.isFinite(num)) out.set(key, num);
  }
  return out;
}

// ── List ────────────────────────────────────────────────────────────────────

/** GET /api/assessments?engagementId=X — list all records for an engagement. */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const engagementId = String(req.query['engagementId'] || '');
    if (!engagementId) { res.status(400).json({ error: 'engagementId is required' }); return; }

    const engagement = await authorizeEngagementAccess(req, engagementId);
    if (!engagement) { res.status(404).json({ error: req.t('errors.engagementNotFound') }); return; }

    const records = await AssessmentRecord.find({
      organizationId: req.user!.organizationId,
      engagementId: engagement._id,
    })
      .sort({ administeredAt: -1, createdAt: -1 })
      .lean();
    res.json(records);
  } catch (e) { next(e); }
});

// ── Read ────────────────────────────────────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const record = await AssessmentRecord.findOne({
      _id: req.params['id'],
      organizationId: req.user!.organizationId,
    }).lean();
    if (!record) { res.status(404).json({ error: req.t('errors.recordNotFound') }); return; }

    const engagement = await authorizeEngagementAccess(req, String(record.engagementId));
    if (!engagement) { res.status(403).json({ error: req.t('errors.accessDenied') }); return; }

    res.json(record);
  } catch (e) { next(e); }
});

// ── Create ──────────────────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      engagementId,
      assessmentType,
      assessmentLabel,
      administeredAt,
      phase,
      scores,
      scoresMeta,
      coachInterpretation,
    } = req.body;

    if (!engagementId) { res.status(400).json({ error: 'engagementId is required' }); return; }
    if (!ALLOWED_TYPES.includes(assessmentType)) {
      res.status(400).json({ error: 'Invalid assessmentType' }); return;
    }
    if (phase && !ALLOWED_PHASES.includes(phase)) {
      res.status(400).json({ error: 'Invalid phase' }); return;
    }
    const adminAt = administeredAt ? new Date(administeredAt) : new Date();
    if (isNaN(adminAt.getTime())) { res.status(400).json({ error: 'Invalid administeredAt' }); return; }

    const engagement = await authorizeEngagementAccess(req, engagementId);
    if (!engagement) { res.status(404).json({ error: req.t('errors.engagementNotFound') }); return; }

    // Coachees may view but not create — only coach / admin / hr_manager can.
    const role = req.user!.role;
    if (role === 'coachee' || (role !== 'admin' && role !== 'hr_manager' && role !== 'coach')) {
      res.status(403).json({ error: req.t('errors.accessDenied') });
      return;
    }

    const record = await AssessmentRecord.create({
      organizationId: req.user!.organizationId,
      engagementId: engagement._id,
      coacheeId: engagement.coacheeId,
      coachId: engagement.coachId,
      assessmentType,
      assessmentLabel: typeof assessmentLabel === 'string' ? assessmentLabel.trim().slice(0, 120) : undefined,
      administeredAt: adminAt,
      phase: phase || 'ad_hoc',
      scores: normaliseScores(scores),
      scoresMeta: scoresMeta && typeof scoresMeta === 'object' ? scoresMeta : undefined,
      coachInterpretation: typeof coachInterpretation === 'string' ? coachInterpretation.trim() : undefined,
      createdBy: req.user!.userId,
    });

    logActivity({
      org: req.user!.organizationId, actor: req.user!.userId,
      type: 'assessment.created',
      label: 'Assessment record created',
      detail: `${record.assessmentType} — ${record.phase}`,
      refModel: 'AssessmentRecord', refId: record._id,
    });

    res.status(201).json(record);
  } catch (e) { next(e); }
});

// ── Update ──────────────────────────────────────────────────────────────────

router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const record = await AssessmentRecord.findOne({
      _id: req.params['id'],
      organizationId: req.user!.organizationId,
    });
    if (!record) { res.status(404).json({ error: req.t('errors.recordNotFound') }); return; }

    const engagement = await authorizeEngagementAccess(req, String(record.engagementId));
    if (!engagement) { res.status(403).json({ error: req.t('errors.accessDenied') }); return; }
    const role = req.user!.role;
    if (role === 'coachee' || (role !== 'admin' && role !== 'hr_manager' && role !== 'coach')) {
      res.status(403).json({ error: req.t('errors.accessDenied') }); return;
    }

    const {
      assessmentType, assessmentLabel, administeredAt, phase,
      scores, scoresMeta, coachInterpretation,
    } = req.body;

    if (assessmentType !== undefined) {
      if (!ALLOWED_TYPES.includes(assessmentType)) { res.status(400).json({ error: 'Invalid assessmentType' }); return; }
      record.assessmentType = assessmentType;
    }
    if (assessmentLabel !== undefined) {
      record.assessmentLabel = typeof assessmentLabel === 'string'
        ? assessmentLabel.trim().slice(0, 120) || undefined
        : undefined;
    }
    if (administeredAt !== undefined) {
      const d = new Date(administeredAt);
      if (isNaN(d.getTime())) { res.status(400).json({ error: 'Invalid administeredAt' }); return; }
      record.administeredAt = d;
    }
    if (phase !== undefined) {
      if (!ALLOWED_PHASES.includes(phase)) { res.status(400).json({ error: 'Invalid phase' }); return; }
      record.phase = phase;
    }
    if (scores !== undefined) {
      record.scores = normaliseScores(scores);
    }
    if (scoresMeta !== undefined) {
      record.scoresMeta = scoresMeta && typeof scoresMeta === 'object' ? scoresMeta : undefined;
    }
    if (coachInterpretation !== undefined) {
      record.coachInterpretation = typeof coachInterpretation === 'string' ? coachInterpretation.trim() : undefined;
    }
    await record.save();

    logActivity({
      org: req.user!.organizationId, actor: req.user!.userId,
      type: 'assessment.updated',
      label: 'Assessment record updated',
      detail: `${record.assessmentType} — ${record.phase}`,
      refModel: 'AssessmentRecord', refId: record._id,
    });

    res.json(record);
  } catch (e) { next(e); }
});

// ── Delete ──────────────────────────────────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const record = await AssessmentRecord.findOne({
      _id: req.params['id'],
      organizationId: req.user!.organizationId,
    });
    if (!record) { res.status(404).json({ error: req.t('errors.recordNotFound') }); return; }

    const engagement = await authorizeEngagementAccess(req, String(record.engagementId));
    if (!engagement) { res.status(403).json({ error: req.t('errors.accessDenied') }); return; }
    const role = req.user!.role;
    if (role === 'coachee' || (role !== 'admin' && role !== 'hr_manager' && role !== 'coach')) {
      res.status(403).json({ error: req.t('errors.accessDenied') }); return;
    }

    if (record.pdfS3Key) {
      s3Client.send(new DeleteObjectCommand({
        Bucket: config.aws.s3Bucket,
        Key: record.pdfS3Key,
      })).catch((err) => console.warn('[Assessment] S3 delete failed:', err));
    }

    await record.deleteOne();
    logActivity({
      org: req.user!.organizationId, actor: req.user!.userId,
      type: 'assessment.deleted',
      label: 'Assessment record deleted',
      detail: `${record.assessmentType} — ${record.phase}`,
      refModel: 'AssessmentRecord', refId: record._id,
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── PDF attach / download / remove ──────────────────────────────────────────

router.post('/:id/pdf', pdfUpload.single('pdf'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ error: req.t('errors.pdfFileRequired') }); return; }
    if (req.file.buffer.slice(0, 4).toString() !== '%PDF') {
      res.status(400).json({ error: req.t('errors.invalidPdfFile') }); return;
    }

    const record = await AssessmentRecord.findOne({
      _id: req.params['id'],
      organizationId: req.user!.organizationId,
    });
    if (!record) { res.status(404).json({ error: req.t('errors.recordNotFound') }); return; }

    const engagement = await authorizeEngagementAccess(req, String(record.engagementId));
    if (!engagement) { res.status(403).json({ error: req.t('errors.accessDenied') }); return; }
    const role = req.user!.role;
    if (role === 'coachee' || (role !== 'admin' && role !== 'hr_manager' && role !== 'coach')) {
      res.status(403).json({ error: req.t('errors.accessDenied') }); return;
    }

    // Best-effort: drop the previous object so storage doesn't leak on replace.
    if (record.pdfS3Key) {
      s3Client.send(new DeleteObjectCommand({
        Bucket: config.aws.s3Bucket,
        Key: record.pdfS3Key,
      })).catch((err) => console.warn('[Assessment] Old PDF delete failed:', err));
    }

    const ext = path.extname(req.file.originalname).toLowerCase() || '.pdf';
    const key = `org/${req.user!.organizationId}/assessments/${record._id}${ext}`;
    await s3Client.send(new PutObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
      Body: req.file.buffer,
      ContentType: 'application/pdf',
    }));

    record.pdfS3Key = key;
    record.pdfFilename = req.file.originalname;
    record.pdfSizeBytes = req.file.size;
    await record.save();

    logActivity({
      org: req.user!.organizationId, actor: req.user!.userId,
      type: 'assessment.pdf.uploaded',
      label: 'Assessment PDF uploaded',
      detail: req.file.originalname,
      refModel: 'AssessmentRecord', refId: record._id,
    });

    res.json({
      pdfFilename: record.pdfFilename,
      pdfSizeBytes: record.pdfSizeBytes,
      hasPdf: true,
    });
  } catch (e) { next(e); }
});

router.get('/:id/pdf/url', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const record = await AssessmentRecord.findOne({
      _id: req.params['id'],
      organizationId: req.user!.organizationId,
    });
    if (!record) { res.status(404).json({ error: req.t('errors.recordNotFound') }); return; }

    const engagement = await authorizeEngagementAccess(req, String(record.engagementId));
    if (!engagement) { res.status(403).json({ error: req.t('errors.accessDenied') }); return; }
    if (!record.pdfS3Key) { res.status(404).json({ error: 'No PDF attached' }); return; }

    const expiresInSeconds = 300;
    const command = new GetObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: record.pdfS3Key,
      ResponseContentDisposition: `inline; filename="${(record.pdfFilename || 'assessment.pdf').replace(/"/g, '')}"`,
      ResponseContentType: 'application/pdf',
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });

    res.json({
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      filename: record.pdfFilename,
    });
  } catch (e) { next(e); }
});

router.delete('/:id/pdf', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const record = await AssessmentRecord.findOne({
      _id: req.params['id'],
      organizationId: req.user!.organizationId,
    });
    if (!record) { res.status(404).json({ error: req.t('errors.recordNotFound') }); return; }

    const engagement = await authorizeEngagementAccess(req, String(record.engagementId));
    if (!engagement) { res.status(403).json({ error: req.t('errors.accessDenied') }); return; }
    const role = req.user!.role;
    if (role === 'coachee' || (role !== 'admin' && role !== 'hr_manager' && role !== 'coach')) {
      res.status(403).json({ error: req.t('errors.accessDenied') }); return;
    }

    if (record.pdfS3Key) {
      s3Client.send(new DeleteObjectCommand({
        Bucket: config.aws.s3Bucket,
        Key: record.pdfS3Key,
      })).catch((err) => console.warn('[Assessment] PDF delete failed:', err));
    }

    record.pdfS3Key = undefined;
    record.pdfFilename = undefined;
    record.pdfSizeBytes = undefined;
    await record.save();

    logActivity({
      org: req.user!.organizationId, actor: req.user!.userId,
      type: 'assessment.pdf.removed',
      label: 'Assessment PDF removed',
      refModel: 'AssessmentRecord', refId: record._id,
    });

    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
