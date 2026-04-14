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
    // Keyed by numeric string so renderers can map scale points to labels exactly.
    // e.g. { "1": "Never", "3": "Sometimes", "5": "Always" }
    // Replaces the previous string[] which lost the association between value and label.
    labels?: Record<string, string>;
}

// ── Individual question ───────────────────────────────────────────────────────
export interface IQuestion {
    id: string;

    // Question stem shown above the response UI.
    // Required for all types. For forced_choice items the stem frames the behavioral
    // dilemma; the actual statements live in options[].text.
    text: string;

    // Core type — 'forced_choice' renders two radio buttons (A/B); TKI-style ipsative.
    type: 'scale' | 'text' | 'boolean' | 'forced_choice';

    category: string;

    // TKI / forced-choice grouping
    pair_id?: number;           // groups a pair of options into one dyad (TKI item number)
    scale_descriptor?: string;  // e.g. "forced_choice_dyad", "likert_5"

    // TKI scoring matrix validation helper.
    // Documents which two TKI subscales are contrasted in a given pair, enabling
    // the engine to verify the 5×6 ipsative matrix without decoding options[].
    modes_contrasted?: string[];

    // Psychometric routing
    subscale?: string;           // scoring bucket for scale/boolean items
    options?: IQuestionOption[]; // for forced_choice: one entry per choice (typically 2)

    // Reverse scoring — critical for PSS (items q1, q2, q6) and ROCI-II dominating subscale.
    // Formula is stored explicitly to prevent ambiguity across instruments with
    // different scale ranges. Standard formula: reversed = (scale_range.max + 1) - raw.
    reverse_scored?: boolean;
    reverse_score_formula?: string; // e.g. "max_plus_one_minus_raw"

    // Instrument-specific range: ROCI-II = 1-5, CDP = 1-6, PSS = 1-7.
    // Set at item level when items within the same template can differ.
    scale_range?: IScaleRange;

    // CDP-specific behavioural classification
    behavior_temperature?: 'hot' | 'cool'; // hot = active/escalating, cool = passive/de-escalating
    behavior_cluster?: string;             // named sub-grouping within a CDP subscale

    // Temporal anchor for frequency-based items (de Dreu, ROCI-II, etc.)
    reference_period?: string; // e.g. "past_month", "past_quarter"
}

// ── Subscale detail (CDP, de Dreu) ───────────────────────────────────────────
// Carries richer per-subscale metadata beyond a name string.
// Used alongside scoring.subscales (which stays string[] for backward compat).
export interface ISubscaleDetail {
    items?: string[];               // item IDs belonging to this subscale
    item_count?: number;
    description?: string;           // plain-language description for reports
    // CDP-specific
    behavior_temperature?: 'hot' | 'cool';
    valence?: 'constructive' | 'destructive';
    clusters?: string[];            // named behavioral clusters within the subscale
}

// ── Aggregation threshold (de Dreu team instrument) ──────────────────────────
export interface IAggregationThreshold {
    rwg_minimum?: number;           // minimum acceptable rwg for team aggregation
    below_threshold_action?: string;
    below_threshold_message?: string;
}

// ── Benchmark band (PSS, and any future instrument with norm-referenced bands) ──
export interface IBenchmarkBand {
    range: [number, number];   // [min, max] inclusive
    label: string;             // e.g. "Psychologically unsafe"
    interpretation: string;    // coaching-facing explanatory text
}

// ── Rater pool config (CDP-360 and any future 360 instrument) ────────────────
export interface IRaterPool {
    min: number;
    max: number;
    role_types?: string[]; // e.g. ["peer", "manager", "direct_report"]
}

// ── Scoring configuration (template-level) ───────────────────────────────────
export interface IScoringConfig {
    method: 'ipsative' | 'normative';
    // ipsative = TKI (forced-choice, fixed total across subscales)
    // normative = ROCI-II, PSS, CDP, de Dreu

    // Flat list of subscale names. Always present; used by the engine for routing.
    subscales?: string[];

    // Rich per-subscale config (CDP, de Dreu). Keyed by subscale name.
    // Carries item lists, descriptions, clusters, valence — details too complex
    // for the flat subscales[] array.
    subscale_config?: Record<string, ISubscaleDetail>;

    items_per_subscale?: number;
    total_items?: number;
    score_range_per_subscale?: { min: number; max: number };

    // PSS / team instrument: list of item IDs that must be reverse-scored
    // before subscale averaging. Engine applies reverse_score_formula per item.
    reverse_scored_items?: string[];

    // Team aggregation failure behaviour (de Dreu, PSS team mode).
    aggregation_threshold?: IAggregationThreshold;

    // Norm-referenced interpretive bands for coaching reports (PSS).
    // Keyed by band name, e.g. { "low": {...}, "moderate": {...}, "high": {...} }
    benchmarks?: Record<string, IBenchmarkBand>;

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
    instructions?: string;       // shown before question 1
    questions: IQuestion[];
    isActive: boolean;
    isGlobal: boolean;
    createdBy?: mongoose.Types.ObjectId;

    // Analysis target
    level_of_analysis?: 'individual' | 'team';

    // ROCI-II: determines which norm table is applied at scoring time.
    // Each form variant (supervisor / subordinate / peer) has separate published norms.
    relationship_target?: 'supervisor' | 'subordinate' | 'peer';

    // PSS and any single-factor instrument: signals no subscale routing is needed.
    // A single aggregate score is the primary output.
    single_construct?: boolean;

    // CDP-360 and any future 360 instrument: rater nomination constraints.
    // Null on self-report instruments.
    rater_pool?: IRaterPool;

    // Team-level aggregation (only relevant when level_of_analysis = 'team')
    aggregation_method?: 'rwg' | 'icc1' | 'team_mean';
    minimum_respondents_per_team?: number;

    // Minimum number of responses required before results are displayed
    // and AI analysis can be run. Defaults per intakeType:
    //   survey     -> 5 (protects individual anonymity in aggregated reports)
    //   interview  -> 1 (coach-led, single-subject by design)
    //   assessment -> 1 (coach-administered, single-subject by design)
    minResponsesForAnalysis?: number;

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
        value:    { type: String, required: true },
        text:     { type: String, required: true },
        subscale: { type: String, required: true },
    },
    { _id: false }
);

const ScaleRangeSchema = new Schema<IScaleRange>(
    {
        min: { type: Number, required: true },
        max: { type: Number, required: true },
        // Map<string, string>: keys are numeric strings matching scale points.
        // Stored as a plain object in MongoDB; Mongoose Map handles arbitrary string keys.
        labels: { type: Map, of: String },
    },
    { _id: false }
);

const QuestionSchema = new Schema<IQuestion>(
    {
        id:               { type: String, required: true },
        text:             { type: String, required: true },  // now required on all question types
        type:             { type: String, enum: ['scale', 'text', 'boolean', 'forced_choice'], required: true },
        category:         { type: String, required: true },

        pair_id:          { type: Number },
        scale_descriptor: { type: String },
        modes_contrasted: [{ type: String }],  // TKI: ["competing", "avoiding"] etc.

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

// ── Sub-schemas for scoring config ───────────────────────────────────────────

const SubscaleDetailSchema = new Schema<ISubscaleDetail>(
    {
        items:                [{ type: String }],
        item_count:           { type: Number },
        description:          { type: String },
        behavior_temperature: { type: String, enum: ['hot', 'cool'] },
        valence:              { type: String, enum: ['constructive', 'destructive'] },
        clusters:             [{ type: String }],
    },
    { _id: false }
);

const AggregationThresholdSchema = new Schema<IAggregationThreshold>(
    {
        rwg_minimum:              { type: Number },
        below_threshold_action:   { type: String },
        below_threshold_message:  { type: String },
    },
    { _id: false }
);

const BenchmarkBandSchema = new Schema<IBenchmarkBand>(
    {
        range:          { type: [Number], validate: (v: number[]) => v.length === 2 },
        label:          { type: String, required: true },
        interpretation: { type: String, required: true },
    },
    { _id: false }
);

const RaterPoolSchema = new Schema<IRaterPool>(
    {
        min:        { type: Number, required: true },
        max:        { type: Number, required: true },
        role_types: [{ type: String }],
    },
    { _id: false }
);

const ScoringConfigSchema = new Schema<IScoringConfig>(
    {
        method: { type: String, enum: ['ipsative', 'normative'], required: true },

        subscales:          [{ type: String }],
        // Rich per-subscale detail keyed by subscale name (CDP, de Dreu).
        subscale_config:    { type: Map, of: SubscaleDetailSchema },

        items_per_subscale: { type: Number },
        total_items:        { type: Number },
        score_range_per_subscale: {
            type: new Schema({ min: Number, max: Number }, { _id: false }),
        },

        reverse_scored_items:   [{ type: String }],
        aggregation_threshold:  { type: AggregationThresholdSchema },
        // Benchmarks keyed by band name: "low", "moderate", "high", etc.
        benchmarks:             { type: Map, of: BenchmarkBandSchema },

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

        level_of_analysis:            { type: String, enum: ['individual', 'team'] },
        relationship_target:          { type: String, enum: ['supervisor', 'subordinate', 'peer'] },
        single_construct:             { type: Boolean },
        rater_pool:                   { type: RaterPoolSchema },

        aggregation_method:           { type: String, enum: ['rwg', 'icc1', 'team_mean'] },
        minimum_respondents_per_team: { type: Number, min: 1 },
        minResponsesForAnalysis:      { type: Number, min: 1 },

        scoring:    { type: ScoringConfigSchema },
        rater_type: { type: String, enum: ['self', 'multi_rater'] },
    },
    { timestamps: true }
);

SurveyTemplateSchema.plugin(tenantFilterPlugin);
SurveyTemplateSchema.index({ organizationId: 1, moduleType: 1 });

export const SurveyTemplate = mongoose.model<ISurveyTemplate>('SurveyTemplate', SurveyTemplateSchema);
