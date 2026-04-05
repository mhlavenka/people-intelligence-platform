import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

// ── Option (used by forced_choice questions) ─────────────────────────────────
export interface IQuestionOption {
  value: string;    // choice identifier, e.g. "A" or "B"
  text: string;     // full display text shown to the respondent
  subscale: string; // scoring bucket this choice routes to
}

// ── Scale range (instrument-specific: 1-5, 1-6, 1-7 …) ──────────────────────
export interface IScaleRange {
  min: number;
  max: number;
  labels?: string[]; // optional pole labels, e.g. ['Never', 'Always']
}

// ── Individual question ───────────────────────────────────────────────────────
export interface IQuestion {
  id: string;
  text?: string;   // omitted for forced_choice (text lives in options[].text)

  // Core type — 'forced_choice' renders two radio buttons (A/B); TKI-style ipsative
  type: 'scale' | 'text' | 'boolean' | 'forced_choice';

  category: string;

  // TKI / forced-choice grouping
  pair_id?: number;           // groups a pair of options into one dyad (TKI item number)
  scale_descriptor?: string;  // e.g. "forced_choice_dyad", "likert_5"

  // Psychometric routing
  subscale?: string;          // scoring bucket for scale/boolean items
  options?: IQuestionOption[]; // for forced_choice: one entry per choice (typically 2)

  // Reverse scoring — critical for instruments like PSS (items 4, 5, 7, 8)
  reverse_scored?: boolean;
  reverse_score_formula?: string; // e.g. "(max + 1) - x"

  // Instrument-specific range: ROCI-II = 1-5, CDP = 1-6, PSS = 1-7
  scale_range?: IScaleRange;

  // CDP-specific behavioural classification
  behavior_temperature?: 'hot' | 'cool';
  behavior_cluster?: string;   // sub-grouping within a CDP subscale

  // Temporal anchor for frequency-based items (de Dreu ROCI-II, etc.)
  reference_period?: string;   // e.g. "over the past month", "in the last 7 days"
}

// ── Scoring configuration (template-level) ───────────────────────────────────
export interface IScoringConfig {
  method: 'ipsative' | 'normative';
  // ipsative = TKI (forced-choice, fixed total across subscales)
  // normative = ROCI-II, PSS, CDP, etc.
  subscales?: string[];
  items_per_subscale?: number;
  total_items?: number;
  score_range_per_subscale?: { min: number; max: number };
  note?: string;
}

// ── Survey template ───────────────────────────────────────────────────────────
export interface ISurveyTemplate extends Document {
  organizationId?: mongoose.Types.ObjectId;
  moduleType: 'conflict' | 'neuroinclusion' | 'succession';
  intakeType: 'survey' | 'interview' | 'assessment';

  // Instrument identity
  instrumentId?: string;       // e.g. "TKI", "ROCI-II", "PSS", "CDP"
  instrumentVersion?: string;  // e.g. "2007", "2021-revised"

  title: string;
  description?: string;        // shown to respondent on the intake cover page
  instructions?: string;       // shown before question 1 (temporal anchor, response format guide)
  questions: IQuestion[];
  isActive: boolean;
  isGlobal: boolean;
  createdBy?: mongoose.Types.ObjectId;

  // Analysis target
  level_of_analysis?: 'individual' | 'team';

  // Team-level aggregation (only relevant when level_of_analysis = 'team')
  aggregation_method?: 'rwg' | 'icc1' | 'team_mean';
  minimum_respondents_per_team?: number;

  // Scoring
  scoring?: IScoringConfig;

  // Rater configuration: 'self' = respondent scores themselves; 'multi_rater' = 360
  rater_type?: 'self' | 'multi_rater';

  createdAt: Date;
  updatedAt: Date;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const QuestionOptionSchema = new Schema<IQuestionOption>(
  {
    value:    { type: String, required: true },  // "A", "B", etc.
    text:     { type: String, required: true },  // full option text
    subscale: { type: String, required: true },
  },
  { _id: false }
);

const ScaleRangeSchema = new Schema<IScaleRange>(
  {
    min:    { type: Number, required: true },
    max:    { type: Number, required: true },
    labels: [{ type: String }],
  },
  { _id: false }
);

const QuestionSchema = new Schema<IQuestion>(
  {
    id:               { type: String, required: true },
    text:             { type: String, default: '' },   // optional for forced_choice (text is in options[])
    type:             { type: String, enum: ['scale', 'text', 'boolean', 'forced_choice'], required: true },
    category:         { type: String, required: true },

    pair_id:          { type: Number },
    scale_descriptor: { type: String },

    subscale: { type: String },
    options:  [QuestionOptionSchema],

    reverse_scored:        { type: Boolean },
    reverse_score_formula: { type: String },

    scale_range: { type: ScaleRangeSchema },

    behavior_temperature: { type: String, enum: ['hot', 'cool'] },
    behavior_cluster:     { type: String },

    reference_period: { type: String },
  },
  { _id: false }
);

const ScoringConfigSchema = new Schema<IScoringConfig>(
  {
    method:               { type: String, enum: ['ipsative', 'normative'], required: true },
    subscales:            [{ type: String }],
    items_per_subscale:   { type: Number },
    total_items:          { type: Number },
    score_range_per_subscale: {
      type: new Schema({ min: Number, max: Number }, { _id: false }),
    },
    note: { type: String },
  },
  { _id: false }
);

const SurveyTemplateSchema = new Schema<ISurveyTemplate>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      index: true,
    },
    moduleType: {
      type: String,
      enum: ['conflict', 'neuroinclusion', 'succession'],
      required: true,
    },
    intakeType: {
      type: String,
      enum: ['survey', 'interview', 'assessment'],
      default: 'survey',
    },
    instrumentId:      { type: String, trim: true },
    instrumentVersion: { type: String, trim: true },
    title:             { type: String, required: true, trim: true },
    description:       { type: String },
    instructions:      { type: String },
    questions:         [QuestionSchema],
    isActive:  { type: Boolean, default: true },
    isGlobal:  { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },

    level_of_analysis:             { type: String, enum: ['individual', 'team'] },
    aggregation_method:            { type: String, enum: ['rwg', 'icc1', 'team_mean'] },
    minimum_respondents_per_team:  { type: Number, min: 1 },

    scoring:    { type: ScoringConfigSchema },
    rater_type: { type: String, enum: ['self', 'multi_rater'] },
  },
  { timestamps: true }
);

SurveyTemplateSchema.plugin(tenantFilterPlugin);
SurveyTemplateSchema.index({ organizationId: 1, moduleType: 1 });

export const SurveyTemplate = mongoose.model<ISurveyTemplate>('SurveyTemplate', SurveyTemplateSchema);
