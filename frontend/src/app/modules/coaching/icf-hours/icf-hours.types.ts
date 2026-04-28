export type HoursLogCategory = 'session' | 'mentor_coaching_received' | 'cce';
export type HoursClientType = 'individual' | 'team' | 'group';
export type HoursPaidStatus = 'paid' | 'pro_bono';
export type CceCategory = 'core_competency' | 'resource_development';
export type IcfLevelKey = 'ACC' | 'PCC' | 'MCC';

export interface HoursSummary {
  totals: {
    coachingTotal: number;
    paid: number;
    proBono: number;
    individual: number;
    team: number;
    group: number;
    mentorCoachingReceived: number;
    cceCredits: number;
  };
  bySource: { fromSessions: number; fromManualLog: number };
  icfProgress: Array<{
    level: IcfLevelKey;
    name: string;
    coachingHoursRequired: number;
    coachingHoursLogged: number;
    coachingHoursRemaining: number;
    percentComplete: number;
    mentorCoachingRequired: number;
    mentorCoachingLogged: number;
    eligible: boolean;
  }>;
  dateRange: { from?: string; to?: string };
}

export interface HoursLogEntry {
  source: 'session' | 'manual';
  id: string;
  date: string;
  hours: number;
  category: HoursLogCategory;
  clientType?: HoursClientType;
  paidStatus?: HoursPaidStatus;
  clientName?: string;
  clientOrganization?: string;
  sponsorContactName?: string;
  assessmentType?: string;
  mentorCoachName?: string;
  mentorCoachOrganization?: string;
  notes?: string;
}

export interface HoursLogPayload {
  _id?: string;
  coachId?: string;
  date: string;
  hours: number;
  category: HoursLogCategory;
  clientType?: HoursClientType;
  paidStatus?: HoursPaidStatus;
  clientName?: string;
  clientOrganization?: string;
  clientEmail?: string;
  sponsorContactName?: string;
  assessmentType?: string;
  mentorCoachName?: string;
  mentorCoachIcfCredential?: 'ACC' | 'PCC' | 'MCC';
  mentorCoachOrganization?: string;
  cceCategory?: CceCategory;
  cceProvider?: string;
  cceCertificateUrl?: string;
  notes?: string;
}
