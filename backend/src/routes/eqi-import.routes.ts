import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { eqiParser } from '../services/eqi-pdf-parser.service';
import { eqiImportService, ImportOptions } from '../services/eqi-import.service';
import { EqiImportAudit } from '../models/EqiImportAudit.model';
import { EqiScoreRecord } from '../models/EqiScoreRecord.model';

const router = Router();
router.use(authenticateToken, tenantResolver, requirePermission('IMPORT_EQI'));

const upload = multer({
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

/** Parse a single PDF for preview — no database write. */
router.post('/parse', upload.single('pdf'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ error: req.t('errors.pdfFileRequired') }); return; }

    // Validate PDF magic bytes
    const buf = req.file.buffer;
    if (buf.length < 4 || buf.slice(0, 4).toString() !== '%PDF') {
      res.status(400).json({ error: req.t('errors.invalidPdfFile') });
      return;
    }

    const result = await eqiParser.parseFromBuffer(buf);
    res.json(result);
  } catch (e) { next(e); }
});

/** Import a single PDF with privacy options. */
router.post('/single', upload.single('pdf'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ error: req.t('errors.pdfFileRequired') }); return; }

    const buf = req.file.buffer;
    if (buf.length < 4 || buf.slice(0, 4).toString() !== '%PDF') {
      res.status(400).json({ error: req.t('errors.invalidPdfFile') });
      return;
    }

    let options: ImportOptions;
    try {
      options = JSON.parse(req.body.options || '{}');
    } catch {
      res.status(400).json({ error: req.t('errors.invalidOptionsJson') });
      return;
    }

    options.organizationId = req.user!.organizationId;
    options.coachId = req.user!.userId;

    const result = await eqiImportService.importSinglePDF(buf, options);
    res.status(result.success ? 201 : 400).json(result);
  } catch (e) { next(e); }
});

/** Batch import multiple PDFs. */
router.post('/batch', upload.array('pdfs', 20), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) { res.status(400).json({ error: req.t('errors.atLeastOnePdfRequired') }); return; }

    let batchOptions: { stopOnError: boolean; maxConcurrent: number };
    let sharedOptions: Omit<ImportOptions, 'organizationId' | 'coachId'>;
    try {
      batchOptions = JSON.parse(req.body.batchOptions || '{"stopOnError":false,"maxConcurrent":1}');
      sharedOptions = JSON.parse(req.body.options || '{}');
    } catch {
      res.status(400).json({ error: req.t('errors.invalidOptionsJson') });
      return;
    }

    const fileEntries = files.map((f) => ({
      buffer: f.buffer,
      filename: f.originalname,
      options: {
        ...sharedOptions,
        organizationId: req.user!.organizationId,
        coachId: req.user!.userId,
      } as ImportOptions,
    }));

    const result = await eqiImportService.importBatch(fileEntries, batchOptions);
    res.json(result);
  } catch (e) { next(e); }
});

/** Audit log — paginated. */
router.get('/audit', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { organizationId: req.user!.organizationId };
    if (req.query['privacyMode']) filter['privacyMode'] = req.query['privacyMode'];

    const [entries, total] = await Promise.all([
      EqiImportAudit.find(filter)
        .sort({ importTimestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EqiImportAudit.countDocuments(filter),
    ]);

    res.json({ entries, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
});

/** Import status by ID. */
router.get('/status/:importId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const audit = await EqiImportAudit.findOne({
      importId: req.params['importId'],
      organizationId: req.user!.organizationId,
    });
    if (!audit) { res.status(404).json({ error: req.t('errors.importNotFound') }); return; }
    res.json(audit);
  } catch (e) { next(e); }
});

/** List imported score records. */
router.get('/records', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filter: Record<string, unknown> = { organizationId: req.user!.organizationId };
    if (req.query['privacyMode']) filter['privacyMode'] = req.query['privacyMode'];

    const records = await EqiScoreRecord.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(records);
  } catch (e) { next(e); }
});

/** Get a single score record. */
router.get('/records/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const record = await EqiScoreRecord.findOne({
      _id: req.params['id'],
      organizationId: req.user!.organizationId,
    }).lean();
    if (!record) { res.status(404).json({ error: req.t('errors.recordNotFound') }); return; }
    res.json(record);
  } catch (e) { next(e); }
});

/** Right to erasure — delete all data linked to a score record. */
router.delete('/record/:scoreId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const scoreRecord = await EqiScoreRecord.findOne({
      _id: req.params['scoreId'],
      organizationId: req.user!.organizationId,
    });
    if (!scoreRecord) { res.status(404).json({ error: req.t('errors.recordNotFound') }); return; }

    if (scoreRecord.privacyMode === 'ANONYMIZED') {
      res.status(400).json({ error: req.t('errors.anonymizedCannotBeErased') });
      return;
    }

    // Delete the score record
    await scoreRecord.deleteOne();

    // Mark audit log entry as erased (do NOT delete the audit log)
    await EqiImportAudit.updateOne(
      { importId: scoreRecord.importId, organizationId: req.user!.organizationId },
      { erasedAt: new Date() }
    );

    res.json({
      message: 'Client data erased',
      erasedCollections: ['eqi_score_records'],
      auditLogPreserved: true,
      normContributionsPreserved: true,
    });
  } catch (e) { next(e); }
});

export default router;
