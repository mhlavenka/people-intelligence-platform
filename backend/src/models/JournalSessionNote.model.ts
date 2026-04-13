import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export interface IAccountabilityItem {
  item: string;
  dueDate?: Date;
  completed: boolean;
}

export interface IJournalSessionNote extends Document {
  organizationId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  engagementId: mongoose.Types.ObjectId;
  coacheeId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  sessionNumber: number;
  sessionDate: Date;
  durationMinutes: number;
  format: 'in_person' | 'video' | 'phone';
  status: 'draft' | 'complete';

  preSession: {
    agenda?: string;
    hypotheses?: string;
    coachIntention?: string;
  };

  inSession: {
    openingState?: string;
    keyThemes: string[];
    observations?: string;
    notableQuotes: string[];
    coachInterventions?: string;
    energyShifts?: string;
  };

  postSession: {
    coachReflection?: string;
    whatWorked?: string;
    whatToExplore?: string;
    clientGrowthEdge?: string;
    accountabilityItems: IAccountabilityItem[];
  };

  // Coachee-owned sections. Coachee writes pre/post; coach reads.
  coacheePre: {
    moodRating?: number;          // 1–5 (star rating) — current energy/mood
    topOfMind?: string;           // What's most present / top of mind today
    mainTopic?: string;           // Main topic or challenge to explore
    valueDefinition?: string;     // What would make this session valuable
    recentShifts?: string;        // What changed since last session
    contextForCoach?: string;     // Anything to share before starting
  };

  coacheePost: {
    // Reflections
    biggestInsight?: string;          // Biggest insight or 'aha' moment
    whatShifted?: string;             // What feels different / shifted
    // Commitments & next steps
    commitment1?: string;
    commitment2?: string;
    commitment3?: string;
    followThroughConfidence?: number; // 1–10
    // Session feedback
    sessionRating?: number;           // 1–5 stars
    exploreNext?: string;             // What to explore next session
    feedbackForCoach?: string;        // Feedback for the coach
  };

  aiSummary?: string;
  aiThemes: string[];
  aiGeneratedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const AccountabilityItemSchema = new Schema<IAccountabilityItem>(
  {
    item:      { type: String, required: true },
    dueDate:   { type: Date },
    completed: { type: Boolean, default: false },
  },
  { _id: true }
);

const JournalSessionNoteSchema = new Schema<IJournalSessionNote>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    coachId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    engagementId:   { type: Schema.Types.ObjectId, ref: 'CoachingEngagement', required: true },
    coacheeId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId:      { type: Schema.Types.ObjectId, ref: 'CoachingSession' },
    sessionNumber:  { type: Number, required: true },
    sessionDate:    { type: Date, required: true },
    durationMinutes: { type: Number, default: 60 },
    format:         { type: String, enum: ['in_person', 'video', 'phone'], default: 'video' },
    status:         { type: String, enum: ['draft', 'complete'], default: 'draft' },

    preSession: {
      agenda:         { type: String },
      hypotheses:     { type: String },
      coachIntention: { type: String },
    },

    inSession: {
      openingState:       { type: String },
      keyThemes:          [{ type: String }],
      observations:       { type: String },
      notableQuotes:      [{ type: String }],
      coachInterventions: { type: String },
      energyShifts:       { type: String },
    },

    postSession: {
      coachReflection:    { type: String },
      whatWorked:         { type: String },
      whatToExplore:      { type: String },
      clientGrowthEdge:  { type: String },
      accountabilityItems: [AccountabilityItemSchema],
    },

    coacheePre: {
      moodRating:      { type: Number, min: 1, max: 5 },
      topOfMind:       { type: String },
      mainTopic:       { type: String },
      valueDefinition: { type: String },
      recentShifts:    { type: String },
      contextForCoach: { type: String },
    },

    coacheePost: {
      biggestInsight:          { type: String },
      whatShifted:             { type: String },
      commitment1:             { type: String },
      commitment2:             { type: String },
      commitment3:             { type: String },
      followThroughConfidence: { type: Number, min: 1, max: 10 },
      sessionRating:           { type: Number, min: 1, max: 5 },
      exploreNext:             { type: String },
      feedbackForCoach:        { type: String },
    },

    aiSummary:     { type: String },
    aiThemes:      [{ type: String }],
    aiGeneratedAt: { type: Date },
  },
  { timestamps: true }
);

JournalSessionNoteSchema.plugin(tenantFilterPlugin);
JournalSessionNoteSchema.index({ organizationId: 1, engagementId: 1, sessionNumber: -1 });
JournalSessionNoteSchema.index({ organizationId: 1, coachId: 1 });

export const JournalSessionNote = mongoose.model<IJournalSessionNote>('JournalSessionNote', JournalSessionNoteSchema);
