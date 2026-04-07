import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

interface AgingBucket { count: number; total: number; }
interface AgingSummary { current: AgingBucket; days30: AgingBucket; days60: AgingBucket; days90: AgingBucket; over90: AgingBucket; grandTotal: number; }
interface AgingItem { invoiceNumber: string; organization: { name: string }; total: number; dueDate: string; daysOverdue: number; status: string; reminderCount: number; }
interface RevenueItem { period: string; revenue: number; invoiceCount: number; }
interface PlatformUsage { organizations: { total: number; active: number; inactive: number }; users: { total: number; active: number; inactive: number }; activity: Record<string, number>; roleBreakdown: Record<string, number>; planBreakdown: Record<string, number>; }
interface OrgSummaryItem { name: string; plan: string; isActive: boolean; userCount: number; analysisCount: number; idpCount: number; responseCount: number; totalRevenue: number; }

@Component({
  selector: 'app-sa-reports',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatDividerModule, MatTooltipModule, MatSelectModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Reports</h1>
          <p>Platform-wide analytics and financial reporting</p>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {

        <!-- AR Aging Report -->
        <div class="report-card">
          <div class="report-header">
            <mat-icon>account_balance</mat-icon>
            <div>
              <h2>Accounts Receivable Aging</h2>
              <p>Outstanding invoices by aging bucket</p>
            </div>
          </div>

          @if (agingSummary()) {
            <div class="aging-buckets">
              @for (b of agingBuckets; track b.key) {
                <div class="aging-bucket" [class]="b.key" [class.active]="selectedBucket() === b.key"
                     (click)="selectedBucket.set(b.key)">
                  <div class="bucket-label">{{ b.label }}</div>
                  <div class="bucket-amount">{{ formatMoney(agingSummary()![b.key].total) }}</div>
                  <div class="bucket-count">{{ agingSummary()![b.key].count }} invoice{{ agingSummary()![b.key].count !== 1 ? 's' : '' }}</div>
                </div>
              }
              <div class="aging-bucket total">
                <div class="bucket-label">Total Outstanding</div>
                <div class="bucket-amount">{{ formatMoney(agingSummary()!.grandTotal) }}</div>
              </div>
            </div>

            @if (selectedBucketItems().length > 0) {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Organization</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Days Overdue</th>
                    <th>Reminders</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of selectedBucketItems(); track item.invoiceNumber) {
                    <tr>
                      <td class="mono">{{ item.invoiceNumber }}</td>
                      <td>{{ item.organization?.name || 'Unknown' }}</td>
                      <td class="amount">{{ formatMoney(item.total) }}</td>
                      <td>{{ item.dueDate | date:'MMM d, y' }}</td>
                      <td><span class="overdue-badge" [class]="overdueSeverity(item.daysOverdue)">{{ item.daysOverdue }}d</span></td>
                      <td>{{ item.reminderCount }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          }
        </div>

        <!-- Revenue Report -->
        <div class="report-card">
          <div class="report-header">
            <mat-icon>trending_up</mat-icon>
            <div>
              <h2>Revenue</h2>
              <p>Monthly paid invoice revenue</p>
            </div>
            <span class="report-total">Total: {{ formatMoney(revenueTotalAmount()) }}</span>
          </div>

          @if (revenueData().length > 0) {
            <div class="bar-chart">
              @for (item of revenueData(); track item.period) {
                <div class="bar-col" [matTooltip]="formatMoney(item.revenue) + ' (' + item.invoiceCount + ' invoices)'">
                  <div class="bar" [style.height.%]="barHeight(item.revenue)"></div>
                  <div class="bar-label">{{ item.period | slice:5 }}</div>
                </div>
              }
            </div>
          } @else {
            <div class="report-empty">No revenue data yet.</div>
          }
        </div>

        <!-- Platform Usage -->
        <div class="report-card">
          <div class="report-header">
            <mat-icon>speed</mat-icon>
            <div>
              <h2>Platform Usage</h2>
              <p>Users, organizations, and module activity</p>
            </div>
          </div>

          @if (usage()) {
            <div class="stats-grid">
              <div class="stat-box"><div class="stat-num">{{ usage()!.organizations.total }}</div><div class="stat-label">Organizations</div><div class="stat-sub">{{ usage()!.organizations.active }} active</div></div>
              <div class="stat-box"><div class="stat-num">{{ usage()!.users.total }}</div><div class="stat-label">Users</div><div class="stat-sub">{{ usage()!.users.active }} active</div></div>
              <div class="stat-box"><div class="stat-num">{{ usage()!.activity['conflictAnalyses'] }}</div><div class="stat-label">Conflict Analyses</div></div>
              <div class="stat-box"><div class="stat-num">{{ usage()!.activity['developmentPlans'] }}</div><div class="stat-label">Development Plans</div></div>
              <div class="stat-box"><div class="stat-num">{{ usage()!.activity['surveyResponses'] }}</div><div class="stat-label">Survey Responses</div></div>
              <div class="stat-box"><div class="stat-num">{{ usage()!.activity['neuroAssessments'] }}</div><div class="stat-label">Neuro Assessments</div></div>
            </div>

            <div class="breakdown-row">
              <div class="breakdown-col">
                <h4>Users by Role</h4>
                @for (entry of objectEntries(usage()!.roleBreakdown); track entry[0]) {
                  <div class="breakdown-item">
                    <span class="breakdown-key">{{ entry[0] }}</span>
                    <span class="breakdown-val">{{ entry[1] }}</span>
                  </div>
                }
              </div>
              <div class="breakdown-col">
                <h4>Organizations by Plan</h4>
                @for (entry of objectEntries(usage()!.planBreakdown); track entry[0]) {
                  <div class="breakdown-item">
                    <span class="breakdown-key">{{ entry[0] }}</span>
                    <span class="breakdown-val">{{ entry[1] }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Org Summary -->
        <div class="report-card">
          <div class="report-header">
            <mat-icon>business</mat-icon>
            <div>
              <h2>Organization Summary</h2>
              <p>Per-organization activity and revenue</p>
            </div>
          </div>

          @if (orgSummary().length > 0) {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Plan</th>
                  <th>Users</th>
                  <th>Analyses</th>
                  <th>IDPs</th>
                  <th>Responses</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                @for (org of orgSummary(); track org.name) {
                  <tr [class.inactive-row]="!org.isActive">
                    <td>{{ org.name }} @if (!org.isActive) { <span class="inactive-chip">Inactive</span> }</td>
                    <td>{{ org.plan || '—' }}</td>
                    <td>{{ org.userCount }}</td>
                    <td>{{ org.analysisCount }}</td>
                    <td>{{ org.idpCount }}</td>
                    <td>{{ org.responseCount }}</td>
                    <td class="amount">{{ formatMoney(org.totalRevenue) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 32px; max-width: 1200px; }
    .report-card {
      background: white; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      padding: 24px; margin-bottom: 24px;
    }
    .report-header {
      display: flex; align-items: flex-start; gap: 12px; margin-bottom: 20px;
      mat-icon { font-size: 24px; color: #3A9FD6; margin-top: 2px; }
      h2 { font-size: 18px; color: #1B2A47; margin: 0 0 2px; font-weight: 700; }
      p  { font-size: 13px; color: #9aa5b4; margin: 0; }
      .report-total { margin-left: auto; font-size: 16px; font-weight: 700; color: #27C4A0; }
    }
    .report-empty { padding: 24px; text-align: center; color: #9aa5b4; font-size: 14px; }

    /* Aging buckets */
    .aging-buckets {
      display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;
    }
    .aging-bucket {
      flex: 1; min-width: 120px; padding: 14px; border-radius: 10px; text-align: center;
      border: 2px solid #e8edf4; cursor: pointer; transition: all 0.15s;
      &:hover { border-color: #3A9FD6; }
      &.active { border-color: #3A9FD6; background: #EBF5FB; }
      &.current { .bucket-amount { color: #27C4A0; } }
      &.days30  { .bucket-amount { color: #f0a500; } }
      &.days60  { .bucket-amount { color: #e86c3a; } }
      &.days90  { .bucket-amount { color: #e53e3e; } }
      &.over90  { .bucket-amount { color: #c53030; } }
      &.total   { background: #1B2A47; color: white; cursor: default; .bucket-label, .bucket-amount { color: white; } }
    }
    .bucket-label { font-size: 11px; color: #9aa5b4; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; }
    .bucket-amount { font-size: 18px; font-weight: 700; color: #1B2A47; }
    .bucket-count { font-size: 11px; color: #9aa5b4; margin-top: 2px; }

    /* Data table */
    .data-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th { text-align: left; padding: 10px 12px; background: #f8fafc; color: #1B2A47; font-weight: 600; font-size: 12px; border-bottom: 2px solid #edf2f7; }
      td { padding: 10px 12px; border-bottom: 1px solid #f0f4f8; color: #374151; }
      tr:hover td { background: #fafbfc; }
      .mono { font-family: monospace; font-size: 12px; color: #3A9FD6; }
      .amount { font-weight: 600; color: #1B2A47; text-align: right; }
      th:last-child, td:last-child { text-align: right; }
    }
    .inactive-row { opacity: 0.6; }
    .inactive-chip { font-size: 10px; background: #fef2f2; color: #dc2626; padding: 1px 6px; border-radius: 4px; margin-left: 6px; }
    .overdue-badge {
      font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;
      &.low { background: #e8faf4; color: #1a9678; }
      &.medium { background: #FFF8E6; color: #b07800; }
      &.high { background: #fef2f2; color: #c53030; }
    }

    /* Bar chart */
    .bar-chart {
      display: flex; gap: 6px; align-items: flex-end; height: 160px; padding: 0 8px;
    }
    .bar-col {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%;
    }
    .bar {
      width: 100%; max-width: 40px; background: linear-gradient(180deg, #3A9FD6, #27C4A0);
      border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.3s;
    }
    .bar-label { font-size: 10px; color: #9aa5b4; margin-top: 6px; }

    /* Stats grid */
    .stats-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px;
    }
    .stat-box {
      background: #f8fafc; border-radius: 10px; padding: 16px; text-align: center;
      .stat-num { font-size: 28px; font-weight: 700; color: #1B2A47; }
      .stat-label { font-size: 12px; color: #5a6a7e; margin-top: 2px; }
      .stat-sub { font-size: 11px; color: #9aa5b4; margin-top: 2px; }
    }

    /* Breakdown */
    .breakdown-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .breakdown-col {
      h4 { font-size: 13px; font-weight: 600; color: #1B2A47; margin: 0 0 10px; }
    }
    .breakdown-item {
      display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f4f8;
      font-size: 13px;
      .breakdown-key { color: #5a6a7e; text-transform: capitalize; }
      .breakdown-val { font-weight: 600; color: #1B2A47; }
    }
  `],
})
export class SaReportsComponent implements OnInit {
  loading = signal(true);
  agingSummary = signal<AgingSummary | null>(null);
  agingItems = signal<Record<string, AgingItem[]>>({});
  selectedBucket = signal('current');
  revenueData = signal<RevenueItem[]>([]);
  usage = signal<PlatformUsage | null>(null);
  orgSummary = signal<OrgSummaryItem[]>([]);

  agingBuckets = [
    { key: 'current' as const, label: 'Current' },
    { key: 'days30' as const, label: '1–30 Days' },
    { key: 'days60' as const, label: '31–60 Days' },
    { key: 'days90' as const, label: '61–90 Days' },
    { key: 'over90' as const, label: '90+ Days' },
  ];

  revenueTotalAmount = computed(() => this.revenueData().reduce((s, d) => s + d.revenue, 0));
  selectedBucketItems = computed(() => this.agingItems()[this.selectedBucket()] || []);

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    Promise.all([
      this.api.get<any>('/reports/system-admin/ar-aging').toPromise(),
      this.api.get<any>('/reports/system-admin/revenue').toPromise(),
      this.api.get<any>('/reports/system-admin/platform-usage').toPromise(),
      this.api.get<any>('/reports/system-admin/org-summary').toPromise(),
    ]).then(([aging, revenue, usage, orgSummary]) => {
      this.agingSummary.set(aging.summary);
      this.agingItems.set(aging.buckets);
      this.revenueData.set(revenue.data);
      this.usage.set(usage);
      this.orgSummary.set(orgSummary);
      this.loading.set(false);
    }).catch(() => this.loading.set(false));
  }

  formatMoney(cents: number): string {
    if (!cents) return '$0';
    return 'CAD ' + new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
  }

  barHeight(revenue: number): number {
    const max = Math.max(...this.revenueData().map((d) => d.revenue), 1);
    return (revenue / max) * 100;
  }

  overdueSeverity(days: number): string {
    if (days <= 0) return 'low';
    if (days <= 30) return 'medium';
    return 'high';
  }

  objectEntries(obj: Record<string, number>): [string, number][] {
    return Object.entries(obj);
  }
}
