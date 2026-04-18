import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
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

const TYPE_MODULE: Record<string, string> = {
  conflict_analysis: 'conflict',
  neuroinclusion: 'neuroinclusion',
  idp: 'succession',
  coaching_engagement: 'coaching',
  coaching_session: 'coaching',
  journal_note: 'coaching',
  journal_reflective: 'coaching',
};

const ICON_MAP: Record<string, string> = {
  survey_response:     'assignment_turned_in',
  conflict_analysis:   'warning_amber',
  idp:                 'trending_up',
  neuroinclusion:      'psychology',
  coaching_engagement: 'psychology_alt',
  coaching_session:    'event_note',
  journal_note:        'auto_stories',
  journal_reflective:  'edit_note',
};

const CLASS_MAP: Record<string, string> = {
  survey_response:     'survey',
  conflict_analysis:   'conflict',
  idp:                 'succession',
  neuroinclusion:      'neuroinclusion',
  coaching_engagement: 'coaching',
  coaching_session:    'coaching',
  journal_note:        'journal',
  journal_reflective:  'journal',
};

@Component({
  selector: 'app-activity-log',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule,
    MatIconModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatSelectModule,
    TranslateModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>{{ "ADMIN.activityLog" | translate }}</h1>
          <p>Everything that's happened across your organization's modules.</p>
        </div>
        <mat-form-field appearance="outline" class="type-filter">
          <mat-label>Type</mat-label>
          <mat-select [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event)">
            <mat-option value="all">{{ "ADMIN.allTypes" | translate }}</mat-option>
            @for (t of availableTypes(); track t.key) {
              <mat-option [value]="t.key">{{ t.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="36" /></div>
      } @else if (!filtered().length) {
        <div class="empty">
          <mat-icon>history</mat-icon>
          <h3>No activity yet</h3>
          <p>Activity from surveys, conflict analyses, coaching, and more will show up here.</p>
        </div>
      } @else {
        <div class="activity-list">
          @for (item of filtered(); track $index) {
            <div class="activity-item">
              <mat-icon class="activity-icon" [class]="iconClass(item.type)">{{ icon(item.type) }}</mat-icon>
              <div class="activity-content">
                <strong>{{ item.label }}</strong>
                <span>{{ item.detail }}</span>
              </div>
              <span class="activity-time">{{ item.createdAt | date:'MMM d, y · h:mm a' }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 24px 32px; width: 100%; max-width: 100%; box-sizing: border-box; }
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
      margin-bottom: 20px;
      h1 { margin: 0 0 4px; font-size: 24px; color: var(--artes-primary); }
      p  { margin: 0; color: #6b7c93; }
    }
    .type-filter { width: 200px; }
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
      &.survey        { background: var(--artes-accent); }
      &.conflict      { background: #e86c3a; }
      &.succession    { background: #7c5cbf; }
      &.neuroinclusion { background: #27C4A0; }
      &.coaching      { background: #27A0C4; }
      &.journal       { background: #b07800; }
    }
    .activity-content {
      display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;
      strong { color: var(--artes-primary); font-size: 14px; }
      span   { color: #5a6a7e; font-size: 13px; }
    }
    .activity-time { font-size: 12px; color: #9aa5b4; white-space: nowrap; flex-shrink: 0; }
  `],
})
export class ActivityLogComponent implements OnInit {
  private api = inject(ApiService);
  private orgCtx = inject(OrgContextService);

  loading = signal(true);
  activity = signal<ActivityItem[]>([]);
  typeFilter = signal<string>('all');

  availableTypes = computed(() => {
    const types = new Set(this.activity().map((a) => a.type));
    const labels: Record<string, string> = {
      survey_response:     'Survey response',
      conflict_analysis:   'Conflict analysis',
      idp:                 'IDP',
      neuroinclusion:      'Neuro-inclusion',
      coaching_engagement: 'Coaching engagement',
      coaching_session:    'Coaching session',
      journal_note:        'Journal note',
      journal_reflective:  'Journal reflection',
    };
    return [...types].map((k) => ({ key: k, label: labels[k] ?? k }));
  });

  filtered = computed(() => {
    const items = this.activity();
    const modules = this.orgCtx.modules();
    const f = this.typeFilter();
    return items.filter((item) => {
      if (f !== 'all' && item.type !== f) return false;
      const mod = TYPE_MODULE[item.type];
      if (!mod) return true;
      return modules.includes(mod);
    });
  });

  icon(type: string): string { return ICON_MAP[type] ?? 'circle'; }
  iconClass(type: string): string { return CLASS_MAP[type] ?? ''; }

  ngOnInit(): void {
    this.api.get<ActivityItem[]>('/dashboard/activity').subscribe({
      next: (items) => { this.activity.set(items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
