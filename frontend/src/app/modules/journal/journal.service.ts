import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api.service';

export interface AccountabilityItem {
  _id?: string;
  item: string;
  dueDate?: string;
  completed: boolean;
}

export interface SessionNote {
  _id: string;
  organizationId: string;
  coachId: string;
  engagementId: string;
  coacheeId: string;
  sessionId?: string;
  sessionNumber: number;
  sessionDate: string;
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
    accountabilityItems: AccountabilityItem[];
  };
  coacheePre?: {
    moodRating?: number;
    topOfMind?: string;
    mainTopic?: string;
    valueDefinition?: string;
    recentShifts?: string;
    contextForCoach?: string;
  };
  coacheePost?: {
    takeaways?: string;
    reflection?: string;
    commitments?: string;
  };
  aiSummary?: string;
  aiThemes: string[];
  aiGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type JournalMood = 'energized' | 'reflective' | 'challenged' | 'inspired' | 'depleted';

export interface ReflectiveEntry {
  _id: string;
  organizationId: string;
  coachId: string;
  entryDate: string;
  title: string;
  body: string;
  mood: JournalMood;
  tags: string[];
  linkedEngagementIds: string[];
  isSupervisionReady: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiSummaryResult {
  aiSummary: string;
  aiThemes: string[];
  aiGeneratedAt: string;
  growthEdgeMoment: string;
}

export interface EngagementInsight {
  recurringThemes: string[];
  growthArc: string;
  coachObservations: string;
  openThreads: string[];
  suggestedNextFocus: string;
}

export interface SupervisionDigest {
  coachThemes: string[];
  crossEngagementPatterns: string;
  questionsForSupervisor: string[];
  developmentAreas: string[];
  meta: { reflectiveEntriesIncluded: number; sessionReflectionsIncluded: number };
}

@Injectable({ providedIn: 'root' })
export class JournalService {
  constructor(private api: ApiService) {}

  // ── Session Notes ──────────────────────────────────────────────────────
  getEngagementNotes(engagementId: string): Observable<SessionNote[]> {
    return this.api.get<SessionNote[]>(`/journal/engagements/${engagementId}/notes`);
  }

  createNote(engagementId: string, data: Partial<SessionNote>): Observable<SessionNote> {
    return this.api.post<SessionNote>(`/journal/engagements/${engagementId}/notes`, data);
  }

  getNote(noteId: string): Observable<SessionNote> {
    return this.api.get<SessionNote>(`/journal/notes/${noteId}`);
  }

  updateNote(noteId: string, data: Partial<SessionNote>): Observable<SessionNote> {
    return this.api.put<SessionNote>(`/journal/notes/${noteId}`, data);
  }

  deleteNote(noteId: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/journal/notes/${noteId}`);
  }

  generateAiSummary(noteId: string): Observable<AiSummaryResult> {
    return this.api.post<AiSummaryResult>(`/journal/notes/${noteId}/ai-summary`, {});
  }

  // ── Reflective Entries ─────────────────────────────────────────────────
  getReflectiveEntries(params?: Record<string, string>): Observable<ReflectiveEntry[]> {
    return this.api.get<ReflectiveEntry[]>('/journal/reflective', params);
  }

  createReflectiveEntry(data: Partial<ReflectiveEntry>): Observable<ReflectiveEntry> {
    return this.api.post<ReflectiveEntry>('/journal/reflective', data);
  }

  getReflectiveEntry(entryId: string): Observable<ReflectiveEntry> {
    return this.api.get<ReflectiveEntry>(`/journal/reflective/${entryId}`);
  }

  updateReflectiveEntry(entryId: string, data: Partial<ReflectiveEntry>): Observable<ReflectiveEntry> {
    return this.api.put<ReflectiveEntry>(`/journal/reflective/${entryId}`, data);
  }

  deleteReflectiveEntry(entryId: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/journal/reflective/${entryId}`);
  }

  // ── AI Insights ────────────────────────────────────────────────────────
  getEngagementInsights(engagementId: string): Observable<EngagementInsight> {
    return this.api.get<EngagementInsight>(`/journal/insights/engagement/${engagementId}`);
  }

  getSupervisionDigest(): Observable<SupervisionDigest> {
    return this.api.get<SupervisionDigest>('/journal/insights/supervision');
  }
}
