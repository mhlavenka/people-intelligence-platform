import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/api.service';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
const GROW_PHASES = [
  { key: 'goal',    label: 'Goal',    icon: 'flag' },
  { key: 'reality', label: 'Reality', icon: 'explore' },
  { key: 'options', label: 'Options', icon: 'lightbulb' },
  { key: 'will',    label: 'Will',    icon: 'bolt' },
];

const FRAMEWORKS = [
  'GROW', 'LUMINA Spark', 'Solution-Focused', 'Cognitive-Behavioral', 'Positive Psychology',
  'Gestalt', 'Narrative', 'Systemic', 'Transactional Analysis',
];

@Component({
  selector: 'app-session-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatDatepickerModule, MatNativeDateModule, MatCheckboxModule, MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>event_note</mat-icon>
      {{ isEdit ? ('COACHING.editSession' | translate) : ('COACHING.newSession' | translate) }}
    </h2>
    <mat-dialog-content>
      @if (isLocked()) {
        <div class="locked-banner">
          <mat-icon>lock</mat-icon>
          <div>
            <div class="locked-title">{{ 'COACHING.sessionLockedTitle' | translate }}</div>
            <div class="locked-sub">{{ 'COACHING.sessionLockedDesc' | translate }}</div>
          </div>
        </div>
      }

      <div class="form-section" [class.locked]="isLocked()">
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.date' | translate }}</mat-label>
            <input matInput [matDatepicker]="dp" [(ngModel)]="form.date" [disabled]="isLocked()" />
            <mat-datepicker-toggle matIconSuffix [for]="dp" /><mat-datepicker #dp />
          </mat-form-field>
          <mat-form-field appearance="outline" class="time-field">
            <mat-label>{{ 'COACHING.startTime' | translate }}</mat-label>
            <input matInput type="time" [(ngModel)]="startTime" [disabled]="isLocked()" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="dur-field">
            <mat-label>{{ 'COACHING.durationMin' | translate }}</mat-label>
            <input matInput type="number" [(ngModel)]="form.duration" min="15" max="180" [disabled]="isLocked()" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.formatLabel' | translate }}</mat-label>
            <mat-select [(ngModel)]="form.format" [disabled]="isLocked()">
              <mat-option value="video">{{ 'COACHING.video' | translate }}</mat-option>
              <mat-option value="phone">{{ 'COACHING.phone' | translate }}</mat-option>
              <mat-option value="in_person">{{ 'COACHING.inPerson' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.statusLabel' | translate }}</mat-label>
            <mat-select [(ngModel)]="form.status" [disabled]="isLocked()">
              <mat-option value="scheduled">{{ 'COACHING.scheduled' | translate }}</mat-option>
              <mat-option value="completed" [disabled]="!isLocked()">{{ 'COACHING.completed' | translate }}</mat-option>
              <mat-option value="cancelled">{{ 'COACHING.cancelled' | translate }}</mat-option>
              <mat-option value="no_show">{{ 'COACHING.noShow' | translate }}</mat-option>
            </mat-select>
            @if (!isLocked() && form.status === 'scheduled') {
              <mat-hint>{{ 'COACHING.useMarkCompleteHint' | translate }}</mat-hint>
            }
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'COACHING.topicsDiscussed' | translate }}</mat-label>
          <input matInput [(ngModel)]="topicsRaw" [placeholder]="'COACHING.topicsPlaceholder' | translate" [disabled]="isLocked()" />
          <mat-hint>{{ 'COACHING.commaSeparated' | translate }}</mat-hint>
        </mat-form-field>

        <div class="section-label">{{ 'COACHING.growFocus' | translate }}</div>
        <div class="grow-checks">
          @for (g of growPhases; track g.key) {
            <label class="grow-check" [class.checked]="isGrowChecked(g.key)" [class.disabled]="isLocked()">
              <mat-checkbox [checked]="isGrowChecked(g.key)" (change)="toggleGrow(g.key)" color="primary" [disabled]="isLocked()" />
              <mat-icon>{{ g.icon }}</mat-icon> {{ g.label }}
            </label>
          }
        </div>

        <div class="section-label">{{ 'COACHING.preSessionIntake' | translate }}</div>
        <div class="intake-hint">
          <mat-icon>assignment_turned_in</mat-icon>
          <span>{{ 'COACHING.attachAssessmentHint' | translate }}</span>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'COACHING.preSessionAssessment' | translate }}</mat-label>
          <mat-select [(ngModel)]="form.preSessionIntakeTemplateId"
                      [disabled]="intakeStatus() === 'completed' || isLocked()">
            <mat-option [value]="null">— {{ 'COACHING.none' | translate }} —</mat-option>
            @for (t of assessmentTemplates(); track t._id) {
              <mat-option [value]="t._id">{{ t.title }}</mat-option>
            }
          </mat-select>
          <mat-hint>
            {{ intakeStatus() === 'completed'
                ? ('COACHING.intakeLocked' | translate)
                : ('COACHING.assessmentOnlyHint' | translate) }}
          </mat-hint>
        </mat-form-field>
        @if (intakeStatus() === 'completed') {
          <div class="intake-status completed">
            <mat-icon>check_circle</mat-icon>
            <span>{{ 'COACHING.intakeCompletedMsg' | translate }}</span>
          </div>
        } @else if (intakeStatus() === 'pending') {
          <div class="intake-status">
            <mat-icon>schedule</mat-icon>
            <span>{{ 'COACHING.intakePendingMsg' | translate }}</span>
          </div>
        }

        <div class="section-label">{{ 'COACHING.postSessionIntake' | translate }}</div>
        <div class="intake-hint post">
          <mat-icon>rate_review</mat-icon>
          <span>{{ 'COACHING.attachPostAssessmentHint' | translate }}</span>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'COACHING.postSessionAssessment' | translate }}</mat-label>
          <mat-select [(ngModel)]="form.postSessionIntakeTemplateId"
                      [disabled]="postIntakeStatus() === 'sent' || isLocked()">
            <mat-option [value]="null">— {{ 'COACHING.useAIFallback' | translate }} —</mat-option>
            @for (t of assessmentTemplates(); track t._id) {
              <mat-option [value]="t._id">{{ t.title }}</mat-option>
            }
          </mat-select>
          <mat-hint>
            {{ postIntakeStatus() === 'sent'
                ? ('COACHING.postIntakeLocked' | translate)
                : ('COACHING.postAssessmentHint' | translate) }}
          </mat-hint>
        </mat-form-field>
        @if (postIntakeStatus() === 'completed') {
          <div class="intake-status completed">
            <mat-icon>check_circle</mat-icon>
            <span>{{ 'COACHING.postIntakeCompletedMsg' | translate }}</span>
          </div>
        } @else if (postIntakeStatus() === 'sent') {
          <div class="intake-status">
            <mat-icon>schedule</mat-icon>
            <span>{{ 'COACHING.postIntakeSentMsg' | translate }}</span>
          </div>
        }

        <div class="section-label">{{ 'COACHING.notes' | translate }}</div>
        <div class="notes-warning">
          <mat-icon>visibility</mat-icon>
          <span>{{ 'COACHING.sharedNotesVisibleHint' | translate }}</span>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'COACHING.sharedNotes' | translate }}</mat-label>
          <textarea matInput [(ngModel)]="form.sharedNotes" rows="3"
                    [placeholder]="'COACHING.sharedNotesPlaceholder' | translate"
                    [disabled]="isLocked()"></textarea>
        </mat-form-field>

        <div class="notes-private-warning">
          <mat-icon>lock</mat-icon>
          <span>{{ 'COACHING.privateNotesStayHint' | translate }}</span>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'COACHING.privateCoachNotes' | translate }}</mat-label>
          <textarea matInput [(ngModel)]="form.coachNotes" rows="3"
                    [placeholder]="'COACHING.privateNotesPlaceholder' | translate"
                    [disabled]="isLocked()"></textarea>
        </mat-form-field>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">{{ 'COMMON.cancel' | translate }}</button>
      @if (!isLocked()) {
        <button mat-raised-button color="primary" (click)="save()" [disabled]="saving()">
          @if (saving()) { <mat-spinner diameter="18" /> }
          @else { <mat-icon>{{ isEdit ? 'save' : 'add' }}</mat-icon> }
          {{ isEdit ? ('COMMON.save' | translate) : ('COACHING.createSession' | translate) }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] { display: flex; align-items: center; gap: 8px; color: var(--artes-primary); mat-icon { color: var(--artes-accent); } }
    mat-dialog-content { min-width: 540px; max-height: 75vh; overflow-y: auto; padding-top: 8px !important; }
    .form-section { padding: 8px 0; display: flex; flex-direction: column; gap: 8px; }
    .full-width { width: 100%; }
    .form-row { display: flex; gap: 12px; mat-form-field { flex: 1; } }
    .time-field { max-width: 140px; }
    .dur-field { max-width: 120px; }
    .section-label { font-size: 12px; font-weight: 600; color: #5a6a7e; text-transform: uppercase; letter-spacing: 0.5px; margin: 4px 0; }

    .grow-checks { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
    .grow-check {
      display: flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 8px;
      border: 1.5px solid #e8edf4; font-size: 13px; cursor: pointer; transition: all 0.15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.checked { background: var(--artes-bg); border-color: var(--artes-accent); color: var(--artes-primary); }
      &:hover { border-color: var(--artes-accent); }
    }

    .star-section { margin-bottom: 12px; }
    .star-label { font-size: 12px; font-weight: 600; color: #5a6a7e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .star-row {
      display: flex; align-items: center; gap: 2px;
      &.ten .star { font-size: 24px; width: 24px; height: 24px; }
    }
    .star {
      font-size: 24px; width: 24px; height: 24px; cursor: pointer;
      color: #d1d5db; transition: color 0.1s;
      &.filled { color: #f59e0b; }
      &.hovered { color: #fbbf24; }
    }
    .star-value { font-size: 13px; color: #5a6a7e; font-weight: 600; margin-left: 8px; }

    .intake-hint {
      display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px;
      background: rgba(124,92,191,0.08); border: 1px solid rgba(124,92,191,0.24);
      margin-bottom: 8px; font-size: 12px; color: #5e3fa8;
      mat-icon { font-size: 16px; color: #7c5cbf; }
    }
    .intake-status {
      display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 8px;
      background: #fff8f0; border: 1px solid #fde0c2; font-size: 12px; color: #b07800;
      margin: -4px 0 8px;
      mat-icon { font-size: 16px; color: #f0a500; }
      &.completed { background: #f0f9f4; border-color: #b9e6d0; color: #1a9678;
        mat-icon { color: #27C4A0; } }
    }

    .notes-warning {
      display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px;
      background: #f0f9ff; border: 1px solid #bae6fd; margin-bottom: 8px;
      font-size: 12px; color: #2080b0;
      mat-icon { font-size: 16px; color: var(--artes-accent); }
    }
    .notes-private-warning {
      display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px;
      background: #fff8f0; border: 1px solid #fde0c2; margin-bottom: 8px; margin-top: 8px;
      font-size: 12px; color: #b07800;
      mat-icon { font-size: 16px; color: #f0a500; }
    }

    .intake-hint.post {
      background: rgba(39,196,160,0.08); border-color: rgba(39,196,160,0.24); color: #1a9678;
      mat-icon { color: #27C4A0; }
    }

    .locked-banner {
      display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px;
      background: linear-gradient(135deg, #f5f0e8 0%, #ede4d3 100%);
      border: 1px solid #d4c5a8; border-radius: 10px; margin-bottom: 16px;
      mat-icon { color: #8b6f3a; flex-shrink: 0; margin-top: 2px; }
      .locked-title { font-size: 14px; font-weight: 700; color: #6b5430; margin-bottom: 2px; }
      .locked-sub { font-size: 12px; color: #8b7349; line-height: 1.5; }
    }

    .form-section.locked {
      opacity: 0.85;
      mat-form-field { pointer-events: none; }
    }
    .grow-check.disabled { opacity: 0.5; cursor: not-allowed; }
  `],
})
export class SessionDialogComponent implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private dialogRef = inject(MatDialogRef<SessionDialogComponent>);
  data = inject<any>(MAT_DIALOG_DATA);

  saving = signal(false);
  isEdit = false;
  topicsRaw = '';
  startTime = '09:00';
  growPhases = GROW_PHASES;
  frameworks = FRAMEWORKS;
  moodStars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  ratingStars = [1, 2, 3, 4, 5];
  moodHover = 0;
  ratingHover = 0;

  form = {
    date: new Date() as Date, duration: 60, format: 'video', status: 'scheduled',
    growFocus: [] as string[], frameworks: [] as string[], coachNotes: '', sharedNotes: '',
    preSessionRating: null as number | null, postSessionRating: null as number | null,
    topics: [] as string[], engagementId: '', coacheeId: '',
    preSessionIntakeTemplateId: null as string | null,
    postSessionIntakeTemplateId: null as string | null,
  };

  assessmentTemplates = signal<{ _id: string; title: string; moduleType: string }[]>([]);
  intakeStatus = signal<'pending' | 'completed' | null>(null);
  postIntakeStatus = signal<'sent' | 'completed' | null>(null);

  /** Once a session is completed the journal locks — fields read-only,
   *  status frozen, save button hidden. */
  isLocked = computed(() => this.form.status === 'completed');

  ngOnInit(): void {
    if (this.data?._id) {
      this.isEdit = true;
      Object.assign(this.form, this.data);
      this.form.date = new Date(this.data.date);
      const h = this.form.date.getHours().toString().padStart(2, '0');
      const m = this.form.date.getMinutes().toString().padStart(2, '0');
      this.startTime = `${h}:${m}`;

      // pre/postSessionIntakeTemplateId may arrive populated — normalise to id string
      this.form.preSessionIntakeTemplateId = this.normaliseId(this.data?.preSessionIntakeTemplateId);
      this.form.postSessionIntakeTemplateId = this.normaliseId(this.data?.postSessionIntakeTemplateId);

      if (this.form.preSessionIntakeTemplateId) {
        const d = this.data as {
          preSessionIntakeResponse?: unknown;
          preSessionIntakeCompleted?: boolean;
        };
        const completed = !!d.preSessionIntakeResponse || d.preSessionIntakeCompleted === true;
        this.intakeStatus.set(completed ? 'completed' : 'pending');
      }
      if (this.form.postSessionIntakeTemplateId) {
        const d = this.data as {
          postSessionIntakeCompleted?: boolean;
          postSessionIntakeSentAt?: unknown;
        };
        if (d.postSessionIntakeCompleted) this.postIntakeStatus.set('completed');
        else if (d.postSessionIntakeSentAt) this.postIntakeStatus.set('sent');
      }
    }
    this.topicsRaw = (this.form.topics || []).join(', ');
    this.loadAssessmentTemplates();
  }

  private normaliseId(raw: unknown): string | null {
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw !== null && '_id' in raw) {
      return String((raw as { _id: unknown })._id);
    }
    return null;
  }

  private loadAssessmentTemplates(): void {
    this.api.get<{ _id: string; title: string; moduleType: string; intakeType?: string; isActive?: boolean }[]>('/surveys/templates')
      .subscribe((list) => {
        const filtered = (list || [])
          .filter((t) => t.isActive !== false && t.intakeType === 'assessment')
          .map((t) => ({ _id: t._id, title: t.title, moduleType: t.moduleType }))
          // coaching templates first
          .sort((a, b) => (a.moduleType === 'coaching' ? -1 : 0) - (b.moduleType === 'coaching' ? -1 : 0));
        this.assessmentTemplates.set(filtered);
      });
  }

  isGrowChecked(key: string): boolean { return (this.form.growFocus || []).includes(key); }

  toggleGrow(key: string): void {
    const arr = this.form.growFocus || [];
    this.form.growFocus = arr.includes(key) ? arr.filter((g: string) => g !== key) : [...arr, key];
  }

  save(targetStatus?: 'scheduled' | 'completed' | 'cancelled' | 'no_show'): void {
    if (this.isLocked() && !targetStatus) return;
    this.saving.set(true);
    this.form.topics = this.topicsRaw.split(',').map((t: string) => t.trim()).filter(Boolean);
    this.form.engagementId = this.data.engagementId;
    this.form.coacheeId = this.data.coacheeId;
    if (targetStatus) this.form.status = targetStatus;

    // Merge startTime into date
    if (this.startTime && this.form.date) {
      const [hours, minutes] = this.startTime.split(':').map(Number);
      const d = new Date(this.form.date);
      d.setHours(hours, minutes, 0, 0);
      this.form.date = d;
    }

    const req = this.isEdit
      ? this.api.put(`/coaching/sessions/${this.data._id}`, this.form)
      : this.api.post('/coaching/sessions', this.form);

    req.subscribe({
      next: (r) => {
        this.saving.set(false);
        this.dialogRef.close(r);
      },
      error: (err) => {
        this.saving.set(false);
        if (targetStatus === 'completed') {
          // revert optimistic status flip so the dialog isn't stuck in locked state
          this.form.status = 'scheduled';
        }
        const msg = err?.error?.error || this.translate.instant('COACHING.failedSaveSession');
        this.snack.open(msg, this.translate.instant('COMMON.ok'), { duration: 4000 });
      },
    });
  }

}
