import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

/**
 * Generic catch-all assessment record for everything that isn't EQ-i (which
 * keeps its dedicated PDF parsing pipeline in `EqiScoreRecord`). Used for
 * DISC, Hogan, Leadership Circle, MBTI, CliftonStrengths, TKI, custom rubrics,
 * and the materialised output of an in-house 360 (Phase 5/6).
 *
 * Score storage is intentionally a flat string→number map so the same model
 * can hold any instrument's dimension set without schema churn. Optional
 * `scoresMeta` lets the UI render scales correctly per-instrument.
 *
 * Per coaching_15-1: readable by coach + coachee on the engagement, plus
 * admin/hr_manager. Sponsor never. Authorization is enforced in the routes,
 * not on the model.
 */

export type AssessmentType =
  | 'eq-i'
  | 'disc'
  | 'hogan'
  | 'leadership_circle'
  | 'mbti'
  | '360'
  | 'cliftonstrengths'
  | 'tki'
  | 'custom';

export type AssessmentPhase = 'baseline' | 'midpoint' | 'final' | 'ad_hoc';

export interface IAssessmentScoresMeta {
  unit?: string;            // e.g. 'percentile', 'standard_score', 'raw'
  scaleMin?: number;
  scaleMax?: number;
  normGroup?: string;       // e.g. 'general_population', 'leadership_pool'
}

export interface IAssessmentRecord extends Document {
  organizationId: mongoose.Types.ObjectId;
  engagementId: mongoose.Types.ObjectId;
  coacheeId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;

  assessmentType: AssessmentType;
  /** Free-form label for `custom`/`360` types so the UI can show e.g.
   *  "Inhouse 360 — Q2 2026" or "Hogan HPI". Optional for built-in types. */
  assessmentLabel?: string;

  administeredAt: Date;
  phase: AssessmentPhase;

  /** Dimension → numeric score. Mongoose stores Maps as BSON sub-documents. */
  scores: Map<string, number>;
  scoresMeta?: IAssessmentScoresMeta;

  pdfS3Key?: string;
  pdfFilename?: string;
  pdfSizeBytes?: number;

  coachInterpretation?: string;
  /** Set when the record was materialised from a 360 SurveyTemplate run. */
  sourceTemplateId?: mongoose.Types.ObjectId;

  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ScoresMetaSchema = new Schema<IAssessmentScoresMeta>({
  unit:      { type: String, trim: true },
  scaleMin:  { type: Number },
  scaleMax:  { type: Number },
  normGroup: { type: String, trim: true },
}, { _id: false });

const AssessmentRecordSchema = new Schema<IAssessmentRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization',     required: true, index: true },
    engagementId:   { type: Schema.Types.ObjectId, ref: 'CoachingEngagement', required: true, index: true },
    coacheeId:      { type: Schema.Types.ObjectId, ref: 'User',             required: true, index: true },
    coachId:        { type: Schema.Types.ObjectId, ref: 'User',             required: true, index: true },

    assessmentType: {
      type: String,
      enum: ['eq-i', 'disc', 'hogan', 'leadership_circle', 'mbti', '360', 'cliftonstrengths', 'tki', 'custom'],
      required: true,
    },
    assessmentLabel: { type: String, trim: true, maxlength: 120 },

    administeredAt:  { type: Date, required: true },
    phase: {
      type: String,
      enum: ['baseline', 'midpoint', 'final', 'ad_hoc'],
      required: true,
      default: 'ad_hoc',
    },

    scores: {
      type: Map,
      of: Number,
      default: () => new Map<string, number>(),
    },
    scoresMeta: { type: ScoresMetaSchema },

    pdfS3Key:      { type: String, trim: true },
    pdfFilename:   { type: String, trim: true },
    pdfSizeBytes:  { type: Number, min: 0 },

    coachInterpretation: { type: String, trim: true, maxlength: 8000 },
    sourceTemplateId:    { type: Schema.Types.ObjectId, ref: 'SurveyTemplate' },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

AssessmentRecordSchema.plugin(tenantFilterPlugin);

// Common access patterns: list-by-engagement (sorted) and per-coachee history.
AssessmentRecordSchema.index({ organizationId: 1, engagementId: 1, administeredAt: -1 });
AssessmentRecordSchema.index({ organizationId: 1, coacheeId: 1, assessmentType: 1, administeredAt: -1 });

export const AssessmentRecord = mongoose.model<IAssessmentRecord>(
  'AssessmentRecord',
  AssessmentRecordSchema,
);
