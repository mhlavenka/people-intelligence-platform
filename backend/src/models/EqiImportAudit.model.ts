import mongoose, { Document, Schema } from 'mongoose';

export interface IEqiImportAudit extends Document {
  importId: string;
  organizationId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  importTimestamp: Date;
  privacyMode: 'IDENTIFIED' | 'PSEUDONYMIZED' | 'ANONYMIZED';
  reportType: string;
  assessmentYear: number | null;
  consentObtained: boolean;
  consentMethod?: string;
  consentDate?: Date;
  profileId?: mongoose.Types.ObjectId;
  scoreId?: mongoose.Types.ObjectId;
  validationPassed: boolean;
  requiresManualReview: boolean;
  reviewReasons: string[];
  dataFieldsStored: string[];
  dataFieldsDiscarded: string[];
  pdfContentHash: string;
  erasedAt?: Date;
  createdAt: Date;
}

const EqiImportAuditSchema = new Schema<IEqiImportAudit>(
  {
    importId:             { type: String, required: true, unique: true },
    organizationId:       { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    coachId:              { type: Schema.Types.ObjectId, ref: 'User', required: true },
    importTimestamp:       { type: Date, default: Date.now },
    privacyMode:          { type: String, required: true, enum: ['IDENTIFIED', 'PSEUDONYMIZED', 'ANONYMIZED'] },
    reportType:           { type: String },
    assessmentYear:       { type: Number },
    consentObtained:      { type: Boolean, default: false },
    consentMethod:        { type: String },
    consentDate:          { type: Date },
    profileId:            { type: Schema.Types.ObjectId },
    scoreId:              { type: Schema.Types.ObjectId },
    validationPassed:     { type: Boolean },
    requiresManualReview: { type: Boolean },
    reviewReasons:        [{ type: String }],
    dataFieldsStored:     [{ type: String }],
    dataFieldsDiscarded:  [{ type: String }],
    pdfContentHash:       { type: String, index: true },
    erasedAt:             { type: Date },
  },
  { timestamps: true }
);

EqiImportAuditSchema.index({ organizationId: 1, importTimestamp: -1 });

export const EqiImportAudit = mongoose.model<IEqiImportAudit>('EqiImportAudit', EqiImportAuditSchema);
