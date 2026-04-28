import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

/**
 * Manual ICF-credentialing hours entries. Hours from completed CoachingSession
 * documents are NOT materialized here — they are unioned at read time by
 * coachingHours.service.ts so we never have to keep the two stores in sync.
 *
 * This model holds:
 *   - 'session'                    external clients coached outside ARTES
 *   - 'mentor_coaching_received'   mentor-coaching hours the coach received
 *                                   (separate ICF category for credentialing)
 *   - 'cce'                        Continuing Coach Education credits earned
 */
export type HoursLogCategory = 'session' | 'mentor_coaching_received' | 'cce';
export type HoursLogClientType = 'individual' | 'team' | 'group';
export type HoursLogPaidStatus = 'paid' | 'pro_bono';
export type CceCategory = 'core_competency' | 'resource_development';

export interface ICoachingHoursLog extends Document {
  organizationId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  date: Date;
  hours: number;
  category: HoursLogCategory;

  // session-only fields
  clientType?: HoursLogClientType;
  paidStatus?: HoursLogPaidStatus;
  clientName?: string;
  clientOrganization?: string;
  clientEmail?: string;            // ICF requires client contact for verification
  /** HR / referring contact at the client organization (sponsor liaison).
   *  Stored as free text now; future enhancement could auto-link to a Sponsor. */
  sponsorContactName?: string;
  /** Assessment instrument used when the session was an assessment debrief
   *  (e.g. "EQi-2.0", "Hogan", "DISC"). Empty for plain coaching sessions. */
  assessmentType?: string;

  // mentor-coaching only
  mentorCoachName?: string;
  mentorCoachIcfCredential?: string;  // ACC / PCC / MCC of the mentor
  /** Institution / program that delivered the mentor coaching
   *  (e.g. "Corry Robertson Academy"). */
  mentorCoachOrganization?: string;

  // CCE only
  cceCategory?: CceCategory;
  cceProvider?: string;
  cceCertificateUrl?: string;

  notes?: string;
  importedFromFile?: string;       // filename trace for csv imports
  createdAt: Date;
  updatedAt: Date;
}

const CoachingHoursLogSchema = new Schema<ICoachingHoursLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    coachId:        { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date:           { type: Date, required: true },
    hours:          { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ['session', 'mentor_coaching_received', 'cce'],
      required: true,
    },
    clientType: {
      type: String,
      enum: ['individual', 'team', 'group'],
    },
    paidStatus: {
      type: String,
      enum: ['paid', 'pro_bono'],
    },
    clientName:           { type: String, trim: true },
    clientOrganization:   { type: String, trim: true },
    clientEmail:          { type: String, trim: true, lowercase: true },
    sponsorContactName:   { type: String, trim: true },
    assessmentType:       { type: String, trim: true },
    mentorCoachName:      { type: String, trim: true },
    mentorCoachIcfCredential: { type: String, enum: ['ACC', 'PCC', 'MCC', null] },
    mentorCoachOrganization:  { type: String, trim: true },
    cceCategory:          { type: String, enum: ['core_competency', 'resource_development', null] },
    cceProvider:          { type: String, trim: true },
    cceCertificateUrl:    { type: String, trim: true },
    notes:                { type: String, trim: true },
    importedFromFile:     { type: String, trim: true },
  },
  { timestamps: true }
);

CoachingHoursLogSchema.plugin(tenantFilterPlugin);
CoachingHoursLogSchema.index({ organizationId: 1, coachId: 1, date: -1 });
CoachingHoursLogSchema.index({ organizationId: 1, category: 1 });

export const CoachingHoursLog = mongoose.model<ICoachingHoursLog>(
  'CoachingHoursLog',
  CoachingHoursLogSchema,
);
