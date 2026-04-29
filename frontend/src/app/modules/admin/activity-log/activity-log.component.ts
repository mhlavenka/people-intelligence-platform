import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { OrgContextService } from '../../../core/org-context.service';
import { TranslateModule } from '@ngx-translate/core';

interface ActivityItem {
  type: string;
  label: string;
  detail: string;
  createdAt: string;
}

const PAGE_SIZE = 50;

/** Map an event type to the module group it belongs to (for hide-when-disabled). */
const TYPE_MODULE: Record<string, string> = {
  conflict_analysis: 'conflict',
  neuroinclusion: 'neuroinclusion',
  idp: 'succession',
  coaching_engagement: 'coaching',
  coaching_session: 'coaching',
  journal_note: 'coaching',
  journal_reflective: 'coaching',
};

/** Pick the visual category of an activity by its event type. Falls back
 *  to 'system' for everything that doesn't fit a domain bucket. */
function categoryFor(type: string): string {
  if (type.startsWith('auth.'))                    return 'auth';
  if (type.startsWith('user.'))                    return 'user';
  if (type.startsWith('survey.') || type === 'survey_response') return 'survey';
  if (type.startsWith('conflict.') || type === 'conflict_analysis') return 'conflict';
  if (type.startsWith('idp.') || type === 'idp')   return 'succession';
  if (type.startsWith('neuroinclusion'))           return 'neuroinclusion';
  if (type.startsWith('coaching.') || type === 'coaching_engagement' || type === 'coaching_session') return 'coaching';
  if (type.startsWith('journal') || type.startsWith('coaching.contract')) return 'journal';
  if (type.startsWith('booking.') || type.startsWith('calendar.')) return 'booking';
  if (type.startsWith('sponsor.'))                 return 'sponsor';
  if (type.startsWith('billing.'))                 return 'billing';
  if (type.startsWith('role.'))                    return 'role';
  if (type.startsWith('org.'))                     return 'org';
  if (type.startsWith('sysadmin.'))                return 'sysadmin';
  if (type.startsWith('eqi.'))                     return 'eqi';
  return 'system';
}

const ICON_MAP: Record<string, string> = {
  auth:           'login',
  user:           'person',
  survey:         'assignment_turned_in',
  conflict:       'warning_amber',
  succession:     'trending_up',
  neuroinclusion: 'psychology',
  coaching:       'psychology_alt',
  booking:        'event_available',
  sponsor:        'account_balance',
  billing:        'receipt_long',
  role:           'admin_panel_settings',
  org:            'corporate_fare',
  sysadmin:       'shield',
  eqi:            'insights',
  journal:        'auto_stories',
  system:         'circle',
};

@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule,
    MatIconModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatSelectModule, MatInputModule,
    MatDatepickerModule, MatNativeDateModule, MatButtonModule,
    TranslateModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>{{ "ADMIN.activityLog" | translate }}</h1>
          <p>{{ 'ADMIN.activityLogDesc' | translate }}</p>
        </div>
        <div class="filters">
          <mat-form-field appearance="outline" class="date-filter">
            <mat-label>From</mat-label>
            <input matInput [matDatepicker]="fromPicker"
                   [ngModel]="fromDate()" (ngModelChange)="fromDate.set($event); reload()" />
            <mat-datepicker-toggle matIconSuffix [for]="fromPicker" />
            <mat-datepicker #fromPicker />
          </mat-form-field>
          <mat-form-field appearance="outline" class="date-filter">
            <mat-label>To</mat-label>
            <input matInput [matDatepicker]="toPicker"
                   [ngModel]="toDate()" (ngModelChange)="toDate.set($event); reload()" />
            <mat-datepicker-toggle matIconSuffix [for]="toPicker" />
            <mat-datepicker #toPicker />
          </mat-form-field>
          <mat-form-field appearance="outline" class="type-filter">
            <mat-label>Type</mat-label>
            <mat-select [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event); reload()">
              <mat-option value="all">{{ "ADMIN.allTypes" | translate }}</mat-option>
              @for (t of availableTypes(); track t.key) {
                <mat-option [value]="t.key">{{ t.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (fromDate() || toDate() || typeFilter() !== 'all') {
            <button mat-stroked-button class="clear-btn" (click)="clearFilters()">
              <mat-icon>close</mat-icon> Clear
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="36" /></div>
      } @else if (!filtered().length) {
        <div class="empty">
          <mat-icon>history</mat-icon>
          <h3>{{ 'ADMIN.noActivityTitle' | translate }}</h3>
          <p>{{ 'ADMIN.noActivityDesc' | translate }}</p>
        </div>
      } @else {
        <div class="activity-list">
          @for (item of filtered(); track $index) {
            <div class="activity-item">
              <mat-icon class="activity-icon" [class]="categoryFor(item.type)">
                {{ icon(item.type) }}
              </mat-icon>
              <div class="activity-content">
                <strong>{{ item.label }}</strong>
                @if (item.detail) { <span>{{ item.detail }}</span> }
              </div>
              <span class="activity-time">{{ item.createdAt | date:'MMM d, y · h:mm a' }}</span>
            </div>
          }
        </div>

        <div class="footer-bar">
          @if (loadingMore()) {
            <mat-spinner diameter="22" />
          } @else if (hasMore()) {
            <button mat-stroked-button color="primary" (click)="loadMore()">
              <mat-icon>expand_more</mat-icon> Load more
            </button>
          } @else if (activity().length > 0) {
            <span class="end-marker">— End of activity log —</span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 24px 32px; width: 100%; max-width: 100%; box-sizing: border-box; }
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
      margin-bottom: 20px; flex-wrap: wrap;
      h1 { margin: 0 0 4px; font-size: 24px; color: var(--artes-primary); }
      p  { margin: 0; color: #6b7c93; }
    }
    .filters {
      display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap;
      ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    }
    .date-filter { width: 160px; }
    .type-filter { width: 200px; }
    .clear-btn { height: 56px; }
    .loading { display: flex; justify-content: center; padding: 60px 0; }
    .empty {
      text-align: center; padding: 48px 24px; color: #6b7c93;
      background: #fff; border-radius: 12px; border: 1px solid #eef2f7;
      mat-icon { font-size: 42px; width: 42px; height: 42px; color: #c8d3df; display: block; margin: 0 auto 10px; }
      h3 { margin: 0 0 4px; color: var(--artes-primary); }
    }
    .activity-list {
      background: #fff; border: 1px solid #eef2f7; border-radius: 12px; overflow: hidden;
    }
    .activity-item {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 14px 18px; border-bottom: 1px solid #f4f6fa;
      &:last-child { border-bottom: none; }
      &:hover { background: #fafbfd; }
    }
    .activity-icon {
      width: 36px; height: 36px; min-width: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; color: #fff; background: #9aa5b4;
      &.auth          { background: #5a6a7e; }
      &.user          { background: #5e74a0; }
      &.survey        { background: var(--artes-accent); }
      &.conflict      { background: #e86c3a; }
      &.succession    { background: #7c5cbf; }
      &.neuroinclusion { background: #27C4A0; }
      &.coaching      { background: #27A0C4; }
      &.booking       { background: #4f9d77; }
      &.sponsor       { background: #c4882c; }
      &.billing       { background: #d6c427; color: #1a1a2e; }
      &.role          { background: #6c5ce7; }
      &.org           { background: #1B2A47; }
      &.sysadmin      { background: #1a1a2e; }
      &.eqi           { background: #b04a8a; }
      &.journal       { background: #b07800; }
      &.system        { background: #9aa5b4; }
    }
    .activity-content {
      display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;
      strong { color: var(--artes-primary); font-size: 14px; }
      span   { color: #5a6a7e; font-size: 13px; }
    }
    .activity-time { font-size: 12px; color: #9aa5b4; white-space: nowrap; flex-shrink: 0; }
    .footer-bar {
      display: flex; justify-content: center; align-items: center;
      padding: 20px 0 4px;
      .end-marker { font-size: 12px; color: #9aa5b4; font-style: italic; }
    }
  `],
})
export class ActivityLogComponent implements OnInit {
  private api = inject(ApiService);
  private orgCtx = inject(OrgContextService);

  loading = signal(true);
  loadingMore = signal(false);
  activity = signal<ActivityItem[]>([]);
  hasMore = signal(true);

  typeFilter = signal<string>('all');
  fromDate = signal<Date | null>(null);
  toDate = signal<Date | null>(null);

  availableTypes = computed(() => {
    // Build the type-filter dropdown from the labels we see in the list.
    // Distinct set, alphabetised for the UI.
    const seen = new Map<string, string>();
    for (const item of this.activity()) {
      if (!seen.has(item.type)) seen.set(item.type, this.humanizeType(item.type));
    }
    const out = Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  });

  filtered = computed(() => {
    // Frontend filter only hides items in disabled modules (server already
    // filtered by type and date range). The disabled-module filter can't
    // round-trip cleanly so it stays client-side.
    const items = this.activity();
    const modules = this.orgCtx.modules();
    return items.filter((item) => {
      const mod = TYPE_MODULE[item.type];
      if (!mod) return true;
      return modules.includes(mod);
    });
  });

  icon(type: string): string {
    return ICON_MAP[categoryFor(type)] ?? 'circle';
  }
  categoryFor(type: string): string {
    return categoryFor(type);
  }

  ngOnInit(): void {
    this.reload();
  }

  /** Re-fetch the first page from scratch — called when any filter changes. */
  reload(): void {
    this.loading.set(true);
    this.activity.set([]);
    this.hasMore.set(true);
    this.fetchPage(null);
  }

  loadMore(): void {
    const items = this.activity();
    if (!items.length) return;
    const oldest = items[items.length - 1].createdAt;
    this.loadingMore.set(true);
    this.fetchPage(oldest);
  }

  clearFilters(): void {
    this.fromDate.set(null);
    this.toDate.set(null);
    this.typeFilter.set('all');
    this.reload();
  }

  /** Fetch a single page. `since` = ISO cursor (oldest createdAt) for pagination, null for first page. */
  private fetchPage(since: string | null): void {
    const params: Record<string, string> = { limit: String(PAGE_SIZE) };
    if (since)              params['since'] = since;
    if (this.fromDate())    params['from']  = this.fromDate()!.toISOString();
    if (this.toDate())      params['to']    = this.toDate()!.toISOString();
    if (this.typeFilter() !== 'all') params['type'] = this.typeFilter();

    const qs = new URLSearchParams(params).toString();
    this.api.get<ActivityItem[]>(`/dashboard/activity?${qs}`).subscribe({
      next: (items) => {
        if (since) {
          this.activity.update((prev) => [...prev, ...items]);
          this.loadingMore.set(false);
        } else {
          this.activity.set(items);
          this.loading.set(false);
        }
        // If the server returned fewer than a full page, we've reached the end.
        if (items.length < PAGE_SIZE) this.hasMore.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadingMore.set(false);
      },
    });
  }

  private humanizeType(type: string): string {
    // Convert e.g. 'auth.login.passkey' → 'Auth · Login · Passkey'
    return type
      .split(/[._]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' · ');
  }
}
