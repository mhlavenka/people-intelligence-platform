import { Component, Inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';

interface UserOption {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  selected: boolean;
}

@Component({
  selector: 'app-intake-assign-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule, MatTabsModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDividerModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>send</mat-icon>
      {{ 'SURVEY.assignAssessment' | translate }}
    </h2>
    <p class="subtitle">{{ data.title }}</p>

    <mat-dialog-content>
      @if (activeSchedule(); as s) {
        <div class="schedule-banner" [class.paused]="s.recurrence?.paused">
          <mat-icon>{{ s.recurrence?.paused ? 'pause_circle' : 'schedule' }}</mat-icon>
          <div class="schedule-info">
            <strong>
              {{ (s.recurrence?.paused ? 'SURVEY.scheduleActivePaused' : 'SURVEY.scheduleActive') | translate }}
            </strong>
            <span>{{ scheduleSummary(s) }}</span>
          </div>
          <div class="schedule-actions">
            <button mat-stroked-button (click)="togglePause(s)">
              <mat-icon>{{ s.recurrence?.paused ? 'play_arrow' : 'pause' }}</mat-icon>
              {{ (s.recurrence?.paused ? 'COMMON.resume' : 'COMMON.pause') | translate }}
            </button>
            <button mat-stroked-button color="warn" (click)="cancelSchedule(s)">
              <mat-icon>cancel</mat-icon>
              {{ 'SURVEY.scheduleCancel' | translate }}
            </button>
          </div>
        </div>
      }
      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="32" /></div>
      } @else {
        <mat-tab-group animationDuration="200ms" color="primary">
          <!-- Departments tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>business</mat-icon>
              {{ 'SURVEY.assignToDepartments' | translate }}
              @if (selectedDepts().size) {
                <span class="tab-badge">{{ selectedDepts().size }}</span>
              }
            </ng-template>

            <div class="tab-body">
              @if (departments().length === 0) {
                <p class="no-results">{{ 'SURVEY.noDepartments' | translate }}</p>
              } @else {
                <div class="chips-wrap">
                  @for (dept of departments(); track dept) {
                    <button
                      class="dept-chip"
                      [class.selected]="selectedDepts().has(dept)"
                      (click)="toggleDept(dept)"
                    >
                      <mat-icon>{{ selectedDepts().has(dept) ? 'check_circle' : 'circle' }}</mat-icon>
                      {{ dept }}
                      <span class="dept-count">({{ deptUserCount(dept) }})</span>
                    </button>
                  }
                </div>
              }
            </div>
          </mat-tab>

          <!-- Individual users tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>person</mat-icon>
              {{ 'SURVEY.assignToUsers' | translate }}
              @if (selectedUserCount()) {
                <span class="tab-badge">{{ selectedUserCount() }}</span>
              }
            </ng-template>

            <div class="tab-body">
              <mat-form-field appearance="outline" class="search-field">
                <mat-icon matPrefix>search</mat-icon>
                <input matInput [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)" [placeholder]="'SURVEY.searchUsers' | translate">
              </mat-form-field>
              <div class="users-list">
                @for (user of filteredUsers(); track user._id) {
                  <label class="user-row">
                    <mat-checkbox
                      [checked]="user.selected"
                      (change)="toggleUser(user)"
                      color="primary"
                    />
                    <span class="user-info">
                      <span class="user-name">{{ user.firstName }} {{ user.lastName }}</span>
                      <span class="user-email">{{ user.email }}</span>
                    </span>
                    @if (user.department) {
                      <span class="user-dept">{{ user.department }}</span>
                    }
                  </label>
                }
                @if (filteredUsers().length === 0) {
                  <p class="no-results">{{ 'SURVEY.noUsersFound' | translate }}</p>
                }
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>

        <mat-divider />

        <!-- Optional message -->
        <section>
          <h3>{{ 'SURVEY.assignMessage' | translate }}</h3>
          <mat-form-field appearance="outline" class="full-width">
            <textarea matInput [(ngModel)]="message" rows="2"
                      [placeholder]="'SURVEY.assignMessagePlaceholder' | translate"></textarea>
          </mat-form-field>
        </section>

        <!-- Recurring schedule -->
        <section>
          <label class="schedule-toggle">
            <mat-checkbox [(ngModel)]="recurring" color="primary" />
            <span>
              <strong>{{ 'SURVEY.assignRepeat' | translate }}</strong>
              <em>{{ 'SURVEY.assignRepeatHint' | translate }}</em>
            </span>
          </label>

          @if (recurring) {
            <div class="schedule-grid">
              <mat-form-field appearance="outline">
                <mat-label>{{ 'SURVEY.scheduleEvery' | translate }}</mat-label>
                <input matInput type="number" min="1" max="52" [(ngModel)]="intervalWeeks" />
                <span matSuffix>&nbsp;{{ 'SURVEY.scheduleWeeks' | translate }}</span>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ 'SURVEY.scheduleDayOfWeek' | translate }}</mat-label>
                <select matNativeControl [(ngModel)]="dayOfWeek">
                  <option [ngValue]="null">{{ 'SURVEY.scheduleAnyDay' | translate }}</option>
                  <option [ngValue]="1">{{ 'SURVEY.dowMon' | translate }}</option>
                  <option [ngValue]="2">{{ 'SURVEY.dowTue' | translate }}</option>
                  <option [ngValue]="3">{{ 'SURVEY.dowWed' | translate }}</option>
                  <option [ngValue]="4">{{ 'SURVEY.dowThu' | translate }}</option>
                  <option [ngValue]="5">{{ 'SURVEY.dowFri' | translate }}</option>
                  <option [ngValue]="6">{{ 'SURVEY.dowSat' | translate }}</option>
                  <option [ngValue]="0">{{ 'SURVEY.dowSun' | translate }}</option>
                </select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ 'SURVEY.scheduleHour' | translate }}</mat-label>
                <input matInput type="number" min="0" max="23" [(ngModel)]="hourOfDay" />
                <mat-hint>{{ 'SURVEY.scheduleHourHint' | translate }}</mat-hint>
              </mat-form-field>
            </div>

            <div class="schedule-grid">
              <mat-form-field appearance="outline">
                <mat-label>{{ 'SURVEY.scheduleMaxOccurrences' | translate }}</mat-label>
                <input matInput type="number" min="1" max="500" [(ngModel)]="maxOccurrences"
                       [placeholder]="'SURVEY.scheduleUnlimited' | translate" />
                <mat-hint>{{ 'SURVEY.scheduleMaxHint' | translate }}</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ 'SURVEY.scheduleEndsAt' | translate }}</mat-label>
                <input matInput type="date" [(ngModel)]="endsAt" />
                <mat-hint>{{ 'SURVEY.scheduleEndsHint' | translate }}</mat-hint>
              </mat-form-field>
            </div>
          }
        </section>

        <!-- Summary -->
        @if (totalRecipients() > 0) {
          <div class="summary">
            <mat-icon>group</mat-icon>
            @if (selectedDepts().size > 0) {
              {{ 'SURVEY.assignSummaryWithDepts' | translate: { count: totalRecipients(), deptCount: selectedDepts().size } }}
            } @else {
              {{ 'SURVEY.assignSummary' | translate: { count: totalRecipients() } }}
            }
          </div>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'COMMON.cancel' | translate }}</button>
      <button mat-raised-button color="primary"
              [disabled]="totalRecipients() === 0 || submitting()"
              (click)="assign()">
        @if (submitting()) {
          <mat-spinner diameter="20" />
        } @else {
          <mat-icon>send</mat-icon>
          {{ 'SURVEY.assignSend' | translate }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
    .subtitle { color: #5a6a7e; font-size: 13px; margin: -8px 0 8px 0; padding: 0 24px; }
    mat-dialog-content { max-height: 60vh; }
    section { margin: 16px 0; }
    h3 { font-size: 14px; font-weight: 600; color: var(--artes-primary, #1B2A47); margin: 0 0 10px; }

    .schedule-toggle {
      display: flex; align-items: flex-start; gap: 10px; cursor: pointer;
      padding: 12px 14px; background: #fafbfd; border: 1px solid #e6ecf2; border-radius: 8px;
      strong { display: block; font-size: 14px; color: var(--artes-primary, #1B2A47); }
      em { font-size: 12px; color: #5a6a7e; font-style: normal; }
    }
    .schedule-banner {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; margin: 0 0 16px;
      background: #eff6ff; border: 1px solid #b3d4f5; border-radius: 8px;
      mat-icon { color: #2080b0; flex-shrink: 0; }
      .schedule-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
      .schedule-info strong { color: #1B2A47; font-size: 13px; }
      .schedule-info span { color: #5a6a7e; font-size: 12px; }
      .schedule-actions { display: flex; gap: 6px; flex-shrink: 0; }
    }
    .schedule-banner.paused {
      background: #fff8f0; border-color: #f0d4a0;
      mat-icon { color: #b27300; }
    }
    .schedule-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
      margin-top: 12px;
    }
    .schedule-grid mat-form-field { width: 100%; }
    @media (max-width: 720px) { .schedule-grid { grid-template-columns: 1fr; } }

    ::ng-deep .mat-mdc-tab .mdc-tab__text-label {
      display: flex; align-items: center; gap: 6px;
    }
    .tab-badge {
      background: var(--artes-accent, #3A9FD6); color: white;
      font-size: 11px; font-weight: 700; min-width: 18px; height: 18px;
      border-radius: 999px; display: inline-flex; align-items: center;
      justify-content: center; padding: 0 5px; line-height: 1;
    }
    .tab-body { padding: 16px 0; min-height: 200px; }

    .chips-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
    .dept-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 14px; border-radius: 999px;
      border: 1px solid #dce6f0; background: #f8fafc;
      font-size: 13px; cursor: pointer; color: #5a6a7e;
      transition: all 0.15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      .dept-count { font-size: 11px; color: #9aa5b4; }
      &.selected {
        background: var(--artes-accent, #3A9FD6); color: white; border-color: transparent;
        .dept-count { color: rgba(255,255,255,0.7); }
      }
    }

    .search-field { width: 100%; }
    .users-list { max-height: 260px; overflow-y: auto; }
    .user-row {
      display: flex; align-items: center; gap: 8px; padding: 6px 4px;
      border-radius: 8px; cursor: pointer;
      &:hover { background: #f4f7fa; }
    }
    .user-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .user-name { font-size: 13px; font-weight: 500; color: #1B2A47; }
    .user-email { font-size: 11px; color: #9aa5b4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-dept {
      font-size: 11px; padding: 2px 8px; border-radius: 999px;
      background: #f0f4f8; color: #5a6a7e; white-space: nowrap;
    }
    .no-results { color: #9aa5b4; font-size: 13px; text-align: center; padding: 16px; }
    .full-width { width: 100%; }
    .summary {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 14px; border-radius: 8px;
      background: rgba(39,196,160,0.08); color: #1a9678;
      font-size: 13px; font-weight: 500;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .loading-center { display: flex; justify-content: center; padding: 40px; }
    mat-divider { margin: 16px 0; }
  `],
})
export class IntakeAssignDialogComponent implements OnInit {
  loading = signal(true);
  submitting = signal(false);
  departments = signal<string[]>([]);
  users = signal<UserOption[]>([]);
  selectedDepts = signal<Set<string>>(new Set());
  searchTerm = signal('');
  message = '';

  // Recurring-schedule fields (only sent when `recurring` is true).
  recurring = false;
  intervalWeeks = 2;
  dayOfWeek: number | null = null;
  hourOfDay = 9;
  maxOccurrences: number | null = null;
  endsAt = '';

  /** The most recent recurring assignment for this template, surfaced as
   *  the "active schedule" banner so the coach can pause/resume/cancel
   *  without re-creating it. */
  activeSchedule = signal<any | null>(null);

  filteredUsers = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.users().filter((u) =>
      !term || u.firstName.toLowerCase().includes(term)
            || u.lastName.toLowerCase().includes(term)
            || u.email.toLowerCase().includes(term)
    );
  });

  selectedUserCount = computed(() => this.users().filter((u) => u.selected).length);

  totalRecipients = computed(() => {
    const deptUsers = new Set<string>();
    const depts = this.selectedDepts();
    if (depts.size) {
      for (const u of this.users()) {
        if (u.department && depts.has(u.department)) deptUsers.add(u._id);
      }
    }
    const selected = this.users().filter((u) => u.selected).map((u) => u._id);
    const all = new Set([...deptUsers, ...selected]);
    return all.size;
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { _id: string; title: string },
    private dialogRef: MatDialogRef<IntakeAssignDialogComponent>,
    private api: ApiService,
    private snackBar: MatSnackBar,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    let orgDone = false, usersDone = false, assignDone = false;
    let previouslyAssignedUserIds = new Set<string>();
    let previouslyAssignedDepts = new Set<string>();

    const checkReady = () => {
      if (!orgDone || !usersDone || !assignDone) return;
      // Pre-select users from previous assignments
      if (previouslyAssignedUserIds.size) {
        this.users.update((list) =>
          list.map((u) => previouslyAssignedUserIds.has(u._id) ? { ...u, selected: true } : u)
        );
      }
      if (previouslyAssignedDepts.size) {
        this.selectedDepts.set(previouslyAssignedDepts);
      }
      this.loading.set(false);
    };

    this.api.get<{ departments: string[] }>('/organizations/me').subscribe({
      next: (org) => { this.departments.set(org.departments ?? []); orgDone = true; checkReady(); },
      error: () => { orgDone = true; checkReady(); },
    });

    this.api.get<UserOption[]>('/users').subscribe({
      next: (users) => { this.users.set(users.map((u) => ({ ...u, selected: false }))); usersDone = true; checkReady(); },
      error: () => { usersDone = true; checkReady(); },
    });

    this.api.get<any[]>(`/surveys/templates/${this.data._id}/assignments`).subscribe({
      next: (assignments) => {
        for (const a of assignments) {
          if (a.userIds) for (const uid of a.userIds) previouslyAssignedUserIds.add(uid);
          if (a.departments) for (const d of a.departments) previouslyAssignedDepts.add(d);
        }
        // Find the most recent recurring assignment that is still scheduled
        // (has a future nextFireAt or hasn't hit an end condition yet).
        const recurring = assignments
          .filter((a) => a.recurrence?.intervalWeeks)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const stillScheduled = recurring.find((a) =>
          a.recurrence?.nextFireAt || a.recurrence?.paused,
        ) ?? recurring[0];
        if (stillScheduled) this.activeSchedule.set(stillScheduled);
        assignDone = true;
        checkReady();
      },
      error: () => { assignDone = true; checkReady(); },
    });
  }

  scheduleSummary(a: any): string {
    const r = a?.recurrence; if (!r) return '';
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const parts: string[] = [];
    parts.push(`Every ${r.intervalWeeks} week${r.intervalWeeks > 1 ? 's' : ''}`);
    if (typeof r.dayOfWeek === 'number') {
      parts.push(`${dow[r.dayOfWeek]}${typeof r.hourOfDay === 'number' ? ' at ' + String(r.hourOfDay).padStart(2, '0') + ':00' : ''}`);
    }
    if (r.occurrencesFired || r.maxOccurrences) {
      parts.push(`${r.occurrencesFired ?? 0}${r.maxOccurrences ? '/' + r.maxOccurrences : ''} cycles`);
    }
    if (r.nextFireAt && !r.paused) {
      parts.push('next: ' + new Date(r.nextFireAt).toLocaleDateString());
    }
    return parts.join(' · ');
  }

  togglePause(a: any): void {
    const newPaused = !a.recurrence?.paused;
    this.api.patch(`/surveys/templates/${this.data._id}/assignments/${a._id}`, { paused: newPaused }).subscribe({
      next: (updated) => this.activeSchedule.set(updated),
      error: () => this.snackBar.open(this.translate.instant('SURVEY.scheduleUpdateFailed'), 'OK', { duration: 3000 }),
    });
  }

  cancelSchedule(a: any): void {
    if (!confirm(this.translate.instant('SURVEY.scheduleCancelConfirm'))) return;
    // Stop the cron from firing again by clearing nextFireAt + pausing.
    // We could also DELETE the assignment but that wipes its dispatch
    // history; pausing keeps the audit trail.
    this.api.patch(`/surveys/templates/${this.data._id}/assignments/${a._id}`, {
      paused: true,
      endsAt: new Date().toISOString(),
    }).subscribe({
      next: (updated) => {
        this.activeSchedule.set(updated);
        this.snackBar.open(this.translate.instant('SURVEY.scheduleCancelled'), 'OK', { duration: 2500 });
      },
      error: () => this.snackBar.open(this.translate.instant('SURVEY.scheduleUpdateFailed'), 'OK', { duration: 3000 }),
    });
  }

  toggleDept(dept: string): void {
    this.selectedDepts.update((set) => {
      const next = new Set(set);
      next.has(dept) ? next.delete(dept) : next.add(dept);
      return next;
    });
  }

  toggleUser(user: UserOption): void {
    this.users.update((list) =>
      list.map((u) => u._id === user._id ? { ...u, selected: !u.selected } : u)
    );
  }

  deptUserCount(dept: string): number {
    return this.users().filter((u) => u.department === dept).length;
  }

  assign(): void {
    this.submitting.set(true);
    const userIds = this.users().filter((u) => u.selected).map((u) => u._id);
    const departments = Array.from(this.selectedDepts());

    const recurrence = this.recurring && this.intervalWeeks >= 1
      ? {
          intervalWeeks: this.intervalWeeks,
          ...(this.dayOfWeek !== null ? { dayOfWeek: this.dayOfWeek } : {}),
          ...(this.hourOfDay !== null && this.hourOfDay !== undefined ? { hourOfDay: this.hourOfDay } : {}),
          ...(this.maxOccurrences ? { maxOccurrences: this.maxOccurrences } : {}),
          ...(this.endsAt ? { endsAt: this.endsAt } : {}),
        }
      : undefined;

    this.api.post(`/surveys/templates/${this.data._id}/assign`, {
      userIds,
      departments,
      message: this.message || undefined,
      ...(recurrence ? { recurrence } : {}),
    }).subscribe({
      next: (res: any) => {
        this.submitting.set(false);
        this.snackBar.open(
          this.translate.instant('SURVEY.assignSuccess', { count: res.notifiedCount ?? 0 }),
          this.translate.instant('COMMON.close'),
          { duration: 3500 },
        );
        this.dialogRef.close(true);
      },
      error: () => {
        this.submitting.set(false);
        this.snackBar.open(
          this.translate.instant('SURVEY.assignFailed'),
          this.translate.instant('COMMON.close'),
          { duration: 3000 },
        );
      },
    });
  }
}
