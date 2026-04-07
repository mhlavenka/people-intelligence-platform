import crypto from 'crypto';
import { eqiParser, ParseResult } from './eqi-pdf-parser.service';
import { EqiImportAudit } from '../models/EqiImportAudit.model';
import { EqiScoreRecord } from '../models/EqiScoreRecord.model';
import { HeqNormContribution } from '../models/HeqNormContribution.model';

export interface ImportOptions {
  privacyMode: 'IDENTIFIED' | 'PSEUDONYMIZED' | 'ANONYMIZED';
  clientName?: string;
  clientEmail?: string;
  clientRole?: string;
  clientOrganization?: string;
  consentObtained?: boolean;
  consentDate?: Date;
  consentMethod?: 'written' | 'verbal' | 'email';
  clientCode?: string;
  roleLevel?: string;
  industrySector?: string;
  coachingGoals?: string[];
  assessmentYear?: number;
  normGroup?: string;
  addToNormDatabase: boolean;
  organizationId: string;
  coachId: string;
}

export interface ImportResult {
  success: boolean;
  importId: string;
  scoreId?: string;
  normRecordId?: string;
  privacyMode: string;
  validationPassed: boolean;
  requiresManualReview: boolean;
  reviewReasons: string[];
  auditLogId: string;
  errors: string[];
  parseResult?: ParseResult;
}

export class EqiImportService {

  async importSinglePDF(pdfBuffer: Buffer, options: ImportOptions): Promise<ImportResult> {
    const importId = crypto.randomUUID();
    const errors: string[] = [];

    // Validate privacy mode requirements
    if (options.privacyMode === 'IDENTIFIED') {
      if (!options.consentObtained) {
        return this.errorResult(importId, options, ['Consent is required for identified imports']);
      }
      if (!options.clientName || !options.clientEmail) {
        return this.errorResult(importId, options, ['Client name and email are required for identified imports']);
      }
    }

    // Validate PDF magic bytes
    if (pdfBuffer.length < 4 || pdfBuffer.slice(0, 4).toString() !== '%PDF') {
      return this.errorResult(importId, options, ['Invalid PDF file — magic bytes check failed']);
    }

    // Check for duplicate
    const contentHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const existing = await EqiImportAudit.findOne({ pdfContentHash: contentHash, organizationId: options.organizationId });
    if (existing) {
      errors.push(`This PDF was previously imported (Import ID: ${existing.importId})`);
      // Warn but don't block
    }

    // Parse
    const parseResult = await eqiParser.parseFromBuffer(pdfBuffer);

    // Apply year override
    if (options.assessmentYear && !parseResult.metadata.assessmentYear) {
      parseResult.metadata.assessmentYear = options.assessmentYear;
    }
    if (options.normGroup && !parseResult.metadata.normGroup) {
      parseResult.metadata.normGroup = options.normGroup;
    }

    // Build stored/discarded field lists
    const { storedFields, discardedFields } = this.fieldLists(options.privacyMode);

    // Create audit log FIRST (legal requirement)
    const auditEntry = await EqiImportAudit.create({
      importId,
      organizationId: options.organizationId,
      coachId: options.coachId,
      privacyMode: options.privacyMode,
      reportType: parseResult.reportType,
      assessmentYear: parseResult.metadata.assessmentYear,
      consentObtained: options.consentObtained ?? false,
      consentMethod: options.consentMethod,
      consentDate: options.consentDate,
      validationPassed: parseResult.validation.allScoresPresent && parseResult.validation.allScoresInRange,
      requiresManualReview: parseResult.validation.requiresManualReview,
      reviewReasons: [...parseResult.validation.reviewReasons, ...errors],
      dataFieldsStored: storedFields,
      dataFieldsDiscarded: discardedFields,
      pdfContentHash: contentHash,
    });

    // Build sanitized score data
    const scoreData = this.buildScoreData(parseResult, options);
    scoreData['importId'] = importId;

    // Store score record
    const scoreRecord = await EqiScoreRecord.create(scoreData);

    // Update audit with scoreId
    auditEntry.scoreId = scoreRecord._id;
    await auditEntry.save();

    // Contribute to norm database if requested
    let normRecordId: string | undefined;
    if (options.addToNormDatabase || options.privacyMode === 'ANONYMIZED') {
      const normRecord = await this.createNormContribution(parseResult, options);
      normRecordId = normRecord?.contributionId;
    }

    return {
      success: true,
      importId,
      scoreId: scoreRecord._id.toString(),
      normRecordId,
      privacyMode: options.privacyMode,
      validationPassed: parseResult.validation.allScoresPresent && parseResult.validation.allScoresInRange,
      requiresManualReview: parseResult.validation.requiresManualReview,
      reviewReasons: [...parseResult.validation.reviewReasons, ...errors],
      auditLogId: auditEntry._id.toString(),
      errors,
      parseResult,
    };
  }

  async importBatch(
    files: Array<{ buffer: Buffer; filename: string; options: ImportOptions }>,
    batchOptions: { stopOnError: boolean; maxConcurrent: number }
  ): Promise<{ total: number; succeeded: number; failed: number; requiresReview: number; results: ImportResult[] }> {
    const results: ImportResult[] = [];
    let succeeded = 0;
    let failed = 0;
    let requiresReview = 0;

    for (const file of files) {
      const result = await this.importSinglePDF(file.buffer, file.options);
      results.push(result);
      if (result.success) {
        succeeded++;
        if (result.requiresManualReview) requiresReview++;
      } else {
        failed++;
        if (batchOptions.stopOnError) break;
      }
    }

    return { total: files.length, succeeded, failed, requiresReview, results };
  }

  // ── Private ───────────────────────────────────────────────────

  private buildScoreData(parseResult: ParseResult, options: ImportOptions): Record<string, unknown> {
    const scores = parseResult.scores;
    const subscaleScores: Record<string, number> = {};
    const compositeScores: Record<string, number> = {};

    // Build subscale scores map
    for (const key of ['selfRegard','selfActualization','emotionalSelfAwareness','emotionalExpression',
      'assertiveness','independence','interpersonalRelationships','empathy','socialResponsibility',
      'problemSolving','realityTesting','impulseControl','flexibility','stressTolerance','optimism'] as const) {
      if (scores[key] !== null) subscaleScores[key] = scores[key];
    }

    for (const key of ['selfPerceptionComposite','selfExpressionComposite','interpersonalComposite',
      'decisionMakingComposite','stressManagementComposite'] as const) {
      if (scores[key] !== null) compositeScores[key] = scores[key];
    }

    const base: Record<string, unknown> = {
      organizationId: options.organizationId,
      importId: '', // will be set by caller
      privacyMode: options.privacyMode,
      reportType: parseResult.reportType,
      assessmentYear: parseResult.metadata.assessmentYear,
      normGroup: parseResult.metadata.normGroup ?? options.normGroup,
      subscaleScores,
      compositeScores,
      totalEI: scores.totalEI,
      wellBeingIndicator: scores.wellBeingIndicator,
      observerCompositeScores: parseResult.observerScores ? { ...parseResult.observerScores } : undefined,
      requiresManualReview: parseResult.validation.requiresManualReview,
      reviewReasons: parseResult.validation.reviewReasons,
      roleLevel: options.roleLevel,
      industrySector: options.industrySector,
      coachingGoals: options.coachingGoals,
    };

    if (options.privacyMode === 'IDENTIFIED') {
      base['clientName'] = options.clientName;
      base['clientEmail'] = options.clientEmail;
      base['clientRole'] = options.clientRole;
      base['clientOrganization'] = options.clientOrganization;
      base['consentObtained'] = options.consentObtained;
      base['consentDate'] = options.consentDate;
      base['consentMethod'] = options.consentMethod;
    } else if (options.privacyMode === 'PSEUDONYMIZED') {
      base['clientCode'] = options.clientCode;
    }
    // Mode C: no identity fields

    return base;
  }

  private async createNormContribution(parseResult: ParseResult, options: ImportOptions) {
    const scores = parseResult.scores;
    const subscaleScores: Record<string, number> = {};
    const compositeScores: Record<string, number> = {};

    for (const [k, v] of Object.entries(scores)) {
      if (v === null) continue;
      if (k.includes('Composite')) compositeScores[k] = v;
      else if (k !== 'totalEI' && k !== 'wellBeingIndicator') subscaleScores[k] = v;
    }

    if (scores.totalEI === null) return null;

    return HeqNormContribution.create({
      contributionId: crypto.randomUUID(),
      source: 'mhs_imported',
      assessmentYear: parseResult.metadata.assessmentYear ?? options.assessmentYear,
      industrySector: options.industrySector ?? '',
      roleLevel: options.roleLevel ?? '',
      normGroup: parseResult.metadata.normGroup ?? options.normGroup ?? '',
      subscaleScores,
      compositeScores,
      totalEI: scores.totalEI,
      wellBeingIndicator: scores.wellBeingIndicator ?? 0,
    });
  }

  private fieldLists(mode: string): { storedFields: string[]; discardedFields: string[] } {
    const allScoreFields = ['subscaleScores', 'compositeScores', 'totalEI', 'wellBeingIndicator'];
    const metaFields = ['reportType', 'assessmentYear', 'normGroup', 'roleLevel', 'industrySector'];
    const identityFields = ['clientName', 'clientEmail', 'clientRole', 'clientOrganization'];
    const pseudoFields = ['clientCode'];

    if (mode === 'IDENTIFIED') {
      return {
        storedFields: [...identityFields, ...allScoreFields, ...metaFields, 'consentObtained', 'consentDate'],
        discardedFields: [],
      };
    }
    if (mode === 'PSEUDONYMIZED') {
      return {
        storedFields: [...pseudoFields, ...allScoreFields, ...metaFields],
        discardedFields: identityFields,
      };
    }
    // ANONYMIZED
    return {
      storedFields: [...allScoreFields, ...metaFields],
      discardedFields: [...identityFields, ...pseudoFields],
    };
  }

  private errorResult(importId: string, options: ImportOptions, errors: string[]): ImportResult {
    return {
      success: false,
      importId,
      privacyMode: options.privacyMode,
      validationPassed: false,
      requiresManualReview: false,
      reviewReasons: [],
      auditLogId: '',
      errors,
    };
  }
}

export const eqiImportService = new EqiImportService();
