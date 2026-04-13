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

export interface SponsorBillingEngagement {
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
  billed?: boolean;
  billedInvoiceNumber?: string;
  billedInvoiceStatus?: string;
}

export interface SponsorBillingCoacheeGroup {
  coachee: { _id: string; firstName: string; lastName: string; email: string };
  engagements: SponsorBillingEngagement[];
  subtotal: number;
}

export interface SponsorInvoice {
  _id: string;
  invoiceNumber: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  total: number;          // cents
  subtotal: number;       // cents
  currency: string;
  dueDate: string;
  createdAt: string;
  paidAt?: string;
}

export interface SponsorBilling {
  sponsor: Sponsor;
  engagements: SponsorBillingEngagement[];
  coacheeGroups: SponsorBillingCoacheeGroup[];
  invoices: SponsorInvoice[];
  grandTotal: number;
  unbilledEstimate: number;
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

  generateInvoice(id: string): Observable<SponsorInvoice> {
    return this.api.post<SponsorInvoice>(`/sponsors/${id}/invoice`, {});
  }

  getInvoice(sponsorId: string, invoiceId: string): Observable<{
    invoice: SponsorInvoice & {
      lineItems: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
      period: { from: string; to: string };
      taxRate: number; tax: number; notes?: string;
    };
    sponsor: Sponsor;
  }> {
    return this.api.get(`/sponsors/${sponsorId}/invoices/${invoiceId}`);
  }

  voidInvoice(sponsorId: string, invoiceId: string): Observable<SponsorInvoice> {
    return this.api.patch<SponsorInvoice>(
      `/sponsors/${sponsorId}/invoices/${invoiceId}/void`, {},
    );
  }

  deleteInvoice(sponsorId: string, invoiceId: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(
      `/sponsors/${sponsorId}/invoices/${invoiceId}`,
    );
  }
}
