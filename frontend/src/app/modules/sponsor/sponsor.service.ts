import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api.service';

export interface Sponsor {
  _id: string;
  organizationId: string;
  name: string;
  email: string;
  organization?: string;
  phone?: string;
  billingAddress?: string;
  defaultHourlyRate?: number;
  notes?: string;
  coacheeId?: { _id: string; firstName: string; lastName: string; email: string } | string | null;
  isActive: boolean;
  totalEngagements?: number;
  activeEngagements?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SponsorBilling {
  sponsor: Sponsor;
  engagements: Array<{
    engagementId: string;
    coach: { _id: string; firstName: string; lastName: string; email?: string; profilePicture?: string };
    coachee: { _id: string; firstName: string; lastName: string; email: string };
    status: string;
    hourlyRate: number;
    sessionsPurchased: number;
    sessionsUsed: number;
    sessionsCompleted: number;
    sessionsTotal: number;
    billedHours: number;
    completedHours: number;
    totalAmount: number;
  }>;
  grandTotal: number;
}

@Injectable({ providedIn: 'root' })
export class SponsorService {
  constructor(private api: ApiService) {}

  list(): Observable<Sponsor[]> {
    return this.api.get<Sponsor[]>('/sponsors');
  }

  get(id: string): Observable<Sponsor> {
    return this.api.get<Sponsor>(`/sponsors/${id}`);
  }

  create(data: Partial<Sponsor>): Observable<Sponsor> {
    return this.api.post<Sponsor>('/sponsors', data);
  }

  update(id: string, data: Partial<Sponsor>): Observable<Sponsor> {
    return this.api.put<Sponsor>(`/sponsors/${id}`, data);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/sponsors/${id}`);
  }

  fromCoachee(coacheeId: string): Observable<Sponsor> {
    return this.api.post<Sponsor>(`/sponsors/from-coachee/${coacheeId}`, {});
  }

  billing(id: string): Observable<SponsorBilling> {
    return this.api.get<SponsorBilling>(`/sponsors/${id}/billing`);
  }
}
