import { Component, OnInit, signal, inject } from '@angular/core';
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
import { MatTabsModule } from '@angular/material/tabs';
import { ApiService } from '../../../core/api.service';

const GROW_PHASES = [
  { key: 'goal',    label: 'Goal',    icon: 'flag' },
  { key: 'reality', label: 'Reality', icon: 'explore' },
  { key: 'options', label: 'Options', icon: 'lightbulb' },
  { key: 'will',    label: 'Will',    icon: 'bolt' },
];

const FRAMEWORKS = [
  'GROW', 'Solution-Focused', 'Cognitive-Behavioral', 'Positive Psychology',
  'Gestalt', 'Narrative', 'Systemic', 'Transactional Analysis',
];

@Component({
  selector: 'app-session-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatDatepickerModule, MatNativeDateModule, MatCheckboxModule, MatTabsModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>event_note</mat-icon>
      {{ isEdit ? 'Edit Session' : 'New Session' }}
    </h2>
    <mat-dialog-content>
      <mat-tab-group>
        <!-- Details tab -->
        <mat-tab label="Details">
          <div class="tab-content">
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Date</mat-label>
                <input matInput [matDatepicker]="dp" [(ngModel)]="form.date" />
                <mat-datepicker-toggle matIconSuffix [for]="dp" /><mat-datepicker #dp />
              </mat-form-field>
              <mat-form-field appearance="outline" class="time-field">
                <mat-label>Start Time</mat-label>
                <input matInput type="time" [(ngModel)]="startTime" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="dur-field">
                <mat-label>Duration (min)</mat-label>
                <input matInput type="number" [(ngModel)]="form.duration" min="15" max="180" />
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Format</mat-label>
                <mat-select [(ngModel)]="form.format">
                  <mat-option value="video">Video</mat-option>
                  <mat-option value="phone">Phone</mat-option>
                  <mat-option value="in_person">In Person</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Status</mat-label>
                <mat-select [(ngModel)]="form.status">
                  <mat-option value="scheduled">Scheduled</mat-option>
                  <mat-option value="completed">Completed</mat-option>
                  <mat-option value="cancelled">Cancelled</mat-option>
                  <mat-option value="no_show">No Show</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Topics discussed</mat-label>
              <input matInput [(ngModel)]="topicsRaw" placeholder="e.g. Leadership style, Team dynamics, Communication" />
              <mat-hint>Comma separated</mat-hint>
            </mat-form-field>

            <!-- GROW Focus -->
            <div class="section-label">GROW Focus</div>
            <div class="grow-checks">
              @for (g of growPhases; track g.key) {
                <label class="grow-check" [class.checked]="isGrowChecked(g.key)">
                  <mat-checkbox [checked]="isGrowChecked(g.key)" (change)="toggleGrow(g.key)" color="primary" />
                  <mat-icon>{{ g.icon }}</mat-icon> {{ g.label }}
                </label>
              }
            </div>

            <!-- Frameworks -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Frameworks used</mat-label>
              <mat-select [(ngModel)]="form.frameworks" multiple>
                @for (f of frameworks; track f) { <mat-option [value]="f">{{ f }}</mat-option> }
              </mat-select>
            </mat-form-field>

            <!-- Pre-session mood (1-10 stars) -->
            <div class="star-section">
              <div class="star-label">Pre-session Mood</div>
              <div class="star-row ten">
                @for (i of moodStars; track i) {
                  <mat-icon
                    class="star"
                    [class.filled]="form.preSessionRating !== null && i <= form.preSessionRating!"
                    (click)="form.preSessionRating = form.preSessionRating === i ? null : i"
                    (mouseenter)="moodHover = i"
                    (mouseleave)="moodHover = 0"
                    [class.hovered]="moodHover >= i">
                    {{ (form.preSessionRating !== null && i <= form.preSessionRating!) || moodHover >= i ? 'star' : 'star_border' }}
                  </mat-icon>
                }
                <span class="star-value">{{ form.preSessionRating ?? '—' }}/10</span>
              </div>
            </div>

            <!-- Session rating (1-5 stars) -->
            <div class="star-section">
              <div class="star-label">Session Rating</div>
              <div class="star-row">
                @for (i of ratingStars; track i) {
                  <mat-icon
                    class="star"
                    [class.filled]="form.postSessionRating !== null && i <= form.postSessionRating!"
                    (click)="form.postSessionRating = form.postSessionRating === i ? null : i"
                    (mouseenter)="ratingHover = i"
                    (mouseleave)="ratingHover = 0"
                    [class.hovered]="ratingHover >= i">
                    {{ (form.postSessionRating !== null && i <= form.postSessionRating!) || ratingHover >= i ? 'star' : 'star_border' }}
                  </mat-icon>
                }
                <span class="star-value">{{ form.postSessionRating ?? '—' }}/5</span>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Notes tab -->
        <mat-tab label="Notes">
          <div class="tab-content">
            <div class="notes-warning">
              <mat-icon>visibility</mat-icon>
              <span><strong>Shared Notes</strong> are visible to the coachee in their portal.</span>
            </div>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Shared Notes (visible to coachee)</mat-label>
              <textarea matInput [(ngModel)]="form.sharedNotes" rows="5" placeholder="Key takeaways and insights to share with the coachee..."></textarea>
            </mat-form-field>

            <div class="notes-private-warning">
              <mat-icon>lock</mat-icon>
              <span><strong>Private Notes</strong> are for your eyes only — never shown to the coachee.</span>
            </div>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Private Coach Notes</mat-label>
              <textarea matInput [(ngModel)]="form.coachNotes" rows="5" placeholder="Your observations, hypotheses, and patterns noticed..."></textarea>
            </mat-form-field>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="saving()">
        @if (saving()) { <mat-spinner diameter="18" /> }
        @else { <mat-icon>{{ isEdit ? 'save' : 'add' }}</mat-icon> }
        {{ isEdit ? 'Save' : 'Create Session' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] { display: flex; align-items: center; gap: 8px; color: #1B2A47; mat-icon { color: #3A9FD6; } }
    mat-dialog-content { min-width: 540px; max-height: 75vh; overflow-y: auto; padding-top: 8px !important; }
    .tab-content { padding: 16px 0; display: flex; flex-direction: column; gap: 8px; }
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
      &.checked { background: #EBF5FB; border-color: #3A9FD6; color: #1B2A47; }
      &:hover { border-color: #3A9FD6; }
    }

    .star-section { margin-bottom: 12px; }
    .star-label { font-size: 12px; font-weight: 600; color: #5a6a7e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .star-row {
      display: flex; align-items: center; gap: 2px;
      &.ten .star { font-size: 20px; width: 20px; height: 20px; }
    }
    .star {
      font-size: 26px; width: 26px; height: 26px; cursor: pointer;
      color: #d1d5db; transition: color 0.1s;
      &.filled { color: #f59e0b; }
      &.hovered { color: #fbbf24; }
    }
    .star-value { font-size: 13px; color: #5a6a7e; font-weight: 600; margin-left: 8px; }

    .notes-warning {
      display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px;
      background: #f0f9ff; border: 1px solid #bae6fd; margin-bottom: 8px;
      font-size: 12px; color: #2080b0;
      mat-icon { font-size: 16px; color: #3A9FD6; }
    }
    .notes-private-warning {
      display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px;
      background: #fff8f0; border: 1px solid #fde0c2; margin-bottom: 8px; margin-top: 8px;
      font-size: 12px; color: #b07800;
      mat-icon { font-size: 16px; color: #f0a500; }
    }
  `],
})
export class SessionDialogComponent implements OnInit {
  private api = inject(ApiService);
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
  };

  ngOnInit(): void {
    if (this.data?._id) {
      this.isEdit = true;
      Object.assign(this.form, this.data);
      this.form.date = new Date(this.data.date);
      const h = this.form.date.getHours().toString().padStart(2, '0');
      const m = this.form.date.getMinutes().toString().padStart(2, '0');
      this.startTime = `${h}:${m}`;
    }
    this.topicsRaw = (this.form.topics || []).join(', ');
  }

  isGrowChecked(key: string): boolean { return (this.form.growFocus || []).includes(key); }

  toggleGrow(key: string): void {
    const arr = this.form.growFocus || [];
    this.form.growFocus = arr.includes(key) ? arr.filter((g: string) => g !== key) : [...arr, key];
  }

  save(): void {
    this.saving.set(true);
    this.form.topics = this.topicsRaw.split(',').map((t: string) => t.trim()).filter(Boolean);
    this.form.engagementId = this.data.engagementId;
    this.form.coacheeId = this.data.coacheeId;

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
      next: (r) => { this.saving.set(false); this.dialogRef.close(r); },
      error: () => this.saving.set(false),
    });
  }
}
