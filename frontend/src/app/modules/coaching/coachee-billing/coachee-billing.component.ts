import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';

interface BillingSession {
  _id: string;
  date: string;
  duration: number;
  status: string;
  format: string;
}

interface BillingEngagement {
  engagementId: string;
  coach: { _id: string; firstName: string; lastName: string } | null;
  status: string;
  hourlyRate: number;
  sessionsPurchased: number;
  sessionsUsed: number;
  sessionsCompleted: number;
  sessionsTotal: number;
  billedHours: number;
  completedHours: number;
  totalAmount: number;
  sessions: BillingSession[];
}

interface BillingData {
  coachee: { _id: string; firstName: string; lastName: string; email: string; department?: string; profilePicture?: string } | null;
  engagements: BillingEngagement[];
  summary: { totalEngagements: number; totalHours: number; totalAmount: number };
}

@Component({
  selector: 'app-coachee-billing',
  standalone: true,
  imports: [
    CommonModule, DatePipe, CurrencyPipe, RouterLink, MatIconModule,
    MatButtonModule, MatProgressSpinnerModule, MatDividerModule, MatTooltipModule,
    EmptyStateComponent,
  ],
  template: `
    <div class="billing-page">
      <div class="page-header">
        <a [routerLink]="backLink()" class="back-link"><mat-icon>arrow_back</mat-icon> Back to Engagement</a>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else if (data()) {

        <!-- Coachee header -->
        <div class="coachee-header">
          @if (data()!.coachee?.profilePicture) {
            <img class="avatar avatar-img" [src]="data()!.coachee!.profilePicture" alt="" />
          } @else {
            <div class="avatar">{{ initials() }}</div>
          }
          <div class="coachee-info">
            <h1>{{ data()!.coachee?.firstName }} {{ data()!.coachee?.lastName }}</h1>
            <span class="email">{{ data()!.coachee?.email }}</span>
            @if (data()!.coachee?.department) {
              <span class="dept">{{ data()!.coachee?.department }}</span>
            }
          </div>
          <div class="header-badge">
            <mat-icon>receipt_long</mat-icon>
            Coachee Billing
          </div>
        </div>

        <!-- Summary cards -->
        <div class="summary-row">
          <div class="summary-card">
            <div class="sum-num">{{ data()!.summary.totalEngagements }}</div>
            <div class="sum-label">Billable Engagements</div>
          </div>
          <div class="summary-card">
            <div class="sum-num">{{ data()!.summary.totalHours }}h</div>
            <div class="sum-label">Total Hours</div>
          </div>
          <div class="summary-card accent">
            <div class="sum-num">{{ data()!.summary.totalAmount | currency:'CAD':'symbol':'1.2-2' }}</div>
            <div class="sum-label">Total Billed</div>
          </div>
        </div>

        <!-- Engagements -->
        @if (data()!.engagements.length === 0) {
          <app-empty-state icon="money_off" title="No billable engagements" message="This coachee has no engagements with rebilling enabled."></app-empty-state>
        }

        @for (eng of data()!.engagements; track eng.engagementId) {
          <div class="eng-billing-card">
            <div class="eng-header">
              <div class="eng-title">
                <a [routerLink]="'/coaching/' + eng.engagementId" class="eng-link">
                  <mat-icon>psychology_alt</mat-icon>
                  Engagement
                </a>
                <span class="eng-status" [class]="eng.status">{{ eng.status }}</span>
              </div>
              <div class="eng-meta">
                @if (eng.coach) {
                  <span class="meta-item"><mat-icon>person</mat-icon> {{ eng.coach.firstName }} {{ eng.coach.lastName }}</span>
                }
                <span class="meta-item"><mat-icon>attach_money</mat-icon> {{ eng.hourlyRate | currency:'CAD':'symbol':'1.2-2' }}/hr</span>
                <span class="meta-item"><mat-icon>schedule</mat-icon> {{ eng.billedHours }}h</span>
              </div>
            </div>

            <div class="eng-totals">
              <div class="total-item">
                <span class="total-label">Purchased</span>
                <span class="total-val">{{ eng.billedHours }}h ({{ eng.sessionsPurchased }} sessions)</span>
              </div>
              <div class="total-item">
                <span class="total-label">Delivered</span>
                <span class="total-val">{{ eng.completedHours }}h ({{ eng.sessionsCompleted }} completed)</span>
              </div>
              <div class="total-item">
                <span class="total-label">Billed Amount</span>
                <span class="total-val total-amount">{{ eng.totalAmount | currency:'CAD':'symbol':'1.2-2' }}</span>
              </div>
            </div>

            @if (eng.sessions.length > 0) {
              <mat-divider />
              <table class="sessions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Format</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of eng.sessions; track s._id) {
                    <tr [class.completed]="s.status === 'completed'" [class.dimmed]="s.status !== 'completed'">
                      <td>{{ s.date | date:'MMM d, y' }}</td>
                      <td>{{ s.duration }} min</td>
                      <td>{{ s.format }}</td>
                      <td><span class="status-dot" [class]="s.status"></span> {{ s.status }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        }

      }
    </div>
  `,
  styles: [`
    .billing-page { padding: 32px; max-width: 960px; }
    .back-link { display: flex; align-items: center; gap: 4px; color: var(--artes-accent); text-decoration: none; font-size: 14px; font-weight: 500; }

    .coachee-header {
      display: flex; align-items: center; gap: 16px; margin-bottom: 24px;
      background: white; border-radius: 16px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .avatar {
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #7c5cbf, #5a3ea0);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .avatar-img { object-fit: cover; background: none; }
    .coachee-info {
      flex: 1;
      h1 { font-size: 22px; color: var(--artes-primary); margin: 0 0 2px; }
      .email { font-size: 13px; color: #5a6a7e; display: block; }
      .dept { font-size: 12px; color: #9aa5b4; display: block; margin-top: 2px; }
    }
    .header-badge {
      display: flex; align-items: center; gap: 6px;
      background: rgba(124,92,191,0.1); color: #7c5cbf;
      padding: 8px 16px; border-radius: 999px; font-size: 13px; font-weight: 600;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .summary-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .summary-card {
      background: white; border-radius: 12px; padding: 20px; text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      .sum-num { font-size: 28px; font-weight: 700; color: var(--artes-primary); }
      .sum-label { font-size: 12px; color: #9aa5b4; margin-top: 2px; }
      &.accent {
        background: linear-gradient(135deg, #7c5cbf, #5a3ea0); color: white;
        .sum-num { color: white; }
        .sum-label { color: rgba(255,255,255,0.7); }
      }
    }


    .eng-billing-card {
      background: white; border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      margin-bottom: 16px; overflow: hidden;
    }
    .eng-header { padding: 20px; }
    .eng-title {
      display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
    }
    .eng-link {
      display: flex; align-items: center; gap: 4px; font-size: 15px; font-weight: 600;
      color: var(--artes-primary); text-decoration: none;
      mat-icon { color: #7c5cbf; font-size: 20px; }
      &:hover { color: var(--artes-accent); }
    }
    .eng-status {
      font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 10px; border-radius: 999px;
      &.active { background: #e8faf4; color: #1a9678; }
      &.completed { background: #e8faf4; color: #1a9678; }
      &.prospect { background: #f0f4f8; color: #9aa5b4; }
      &.contracted { background: var(--artes-bg); color: var(--artes-accent); }
      &.paused { background: #fefce8; color: #b07800; }
      &.alumni { background: #f3eeff; color: #7c5cbf; }
    }
    .eng-meta {
      display: flex; gap: 16px; flex-wrap: wrap;
      .meta-item {
        display: flex; align-items: center; gap: 4px; font-size: 13px; color: #5a6a7e;
        mat-icon { font-size: 14px; width: 14px; height: 14px; color: #9aa5b4; }
      }
    }

    .eng-totals {
      display: flex; gap: 32px; padding: 0 20px 16px;
      .total-item { display: flex; flex-direction: column; gap: 2px; }
      .total-label { font-size: 11px; color: #9aa5b4; text-transform: uppercase; }
      .total-val { font-size: 14px; color: #374151; font-weight: 500; }
      .total-amount { color: #7c5cbf; font-weight: 700; }
    }

    .sessions-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th { text-align: left; padding: 10px 16px; font-size: 11px; color: #9aa5b4; text-transform: uppercase; letter-spacing: 0.3px; background: #f8fafc; font-weight: 600; }
      td { padding: 10px 16px; color: #374151; border-top: 1px solid #f0f4f8; }
      .right { text-align: right; }
      tr.completed td { color: #374151; }
      tr.dimmed td { color: #9aa5b4; }
    }

    .status-dot {
      display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px;
      &.completed { background: #27C4A0; }
      &.scheduled { background: var(--artes-accent); }
      &.cancelled { background: #9aa5b4; }
      &.no_show { background: #e53e3e; }
    }

    @media (max-width: 768px) {
      .summary-row { grid-template-columns: 1fr; }
      .coachee-header { flex-wrap: wrap; }
      .sessions-table { font-size: 12px; th, td { padding: 8px 10px; } }
    }
  `],
})
export class CoacheeBillingComponent implements OnInit {
  loading = signal(true);
  data = signal<BillingData | null>(null);
  private coacheeId = '';
  private engagementId = '';

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  initials(): string {
    const c = this.data()?.coachee;
    return c ? `${c.firstName[0]}${c.lastName[0]}` : '?';
  }

  backLink(): string {
    return this.engagementId ? `/coaching/${this.engagementId}` : '/coaching';
  }

  ngOnInit(): void {
    this.coacheeId = this.route.snapshot.params['coacheeId'];
    this.engagementId = this.route.snapshot.queryParams['engagementId'] || '';
    this.api.get<BillingData>(`/coaching/billing/coachee/${this.coacheeId}`).subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
