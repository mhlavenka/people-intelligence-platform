import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatStepperModule } from '@angular/material/stepper';
import { ApiService } from '../../../core/api.service';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const EQI_DIMENSIONS = [
  'Self-Regard',
  'Self-Actualization',
  'Emotional Self-Awareness',
  'Emotional Expression',
  'Independence',
  'Interpersonal Relationships',
  'Empathy',
  'Social Responsibility',
  'Problem Solving',
  'Reality Testing',
  'Impulse Control',
  'Flexibility',
  'Stress Tolerance',
  'Optimism',
];

const COMMON_GAPS = [
  'Strategic thinking',
  'Executive presence',
  'Conflict resolution',
  'Delegation',
  'Emotional regulation',
  'Public speaking',
  'Data-driven decision making',
  'Change management',
  'Coaching others',
  'Cross-functional collaboration',
];

@Component({
  selector: 'app-idp-generate-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatStepperModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>auto_awesome</mat-icon>
      Generate AI Development Plan
    </h2>

    <mat-dialog-content>
      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <mat-stepper orientation="vertical" [linear]="true" #stepper>

        <!-- Step 1: Coachee -->
        <mat-step label="Select Coachee" [stepControl]="coacheeGroup">
          <div class="step-body" [formGroup]="coacheeGroup">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Coachee</mat-label>
              <mat-select formControlName="coacheeId">
                @for (u of coachees(); track u._id) {
                  <mat-option [value]="u._id">
                    {{ u.firstName }} {{ u.lastName }} — {{ u.role | titlecase }}
                  </mat-option>
                }
              </mat-select>
              @if (loadingUsers()) {
                <mat-hint>Loading users...</mat-hint>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Coach (optional)</mat-label>
              <mat-select formControlName="coachId">
                <mat-option [value]="null">— None —</mat-option>
                @for (u of coaches(); track u._id) {
                  <mat-option [value]="u._id">
                    {{ u.firstName }} {{ u.lastName }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <button mat-raised-button color="primary" matStepperNext
                    [disabled]="coacheeGroup.invalid" type="button">
              Next →
            </button>
          </div>
        </mat-step>

        <!-- Step 2: Goals & Gaps -->
        <mat-step label="Goals & Competency Gaps" [stepControl]="goalsGroup">
          <div class="step-body" [formGroup]="goalsGroup">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Development Goal</mat-label>
              <textarea matInput formControlName="goals" rows="3"
                placeholder="e.g. Transition from individual contributor to people manager within 12 months"></textarea>
            </mat-form-field>

            <div class="field-label">Competency Gaps (select all that apply)</div>
            <div class="chip-grid">
              @for (gap of commonGaps; track gap) {
                <button
                  type="button"
                  class="gap-chip"
                  [class.selected]="selectedGaps().includes(gap)"
                  (click)="toggleGap(gap)"
                >
                  {{ gap }}
                </button>
              }
            </div>

            <mat-form-field appearance="outline" class="full-width" style="margin-top: 12px">
              <mat-label>Add custom gap</mat-label>
              <input matInput #customGapInput
                placeholder="Type and press Enter"
                (keydown.enter)="addCustomGap(customGapInput.value); customGapInput.value = ''" />
              <mat-hint>Press Enter to add</mat-hint>
            </mat-form-field>

            @if (selectedGaps().length) {
              <div class="selected-gaps">
                <strong>Selected:</strong>
                @for (gap of selectedGaps(); track gap) {
                  <span class="gap-tag">
                    {{ gap }}
                    <button type="button" (click)="toggleGap(gap)">×</button>
                  </span>
                }
              </div>
            }

            <div class="step-actions">
              <button mat-button matStepperPrevious type="button">Back</button>
              <button mat-raised-button color="primary" matStepperNext
                      [disabled]="goalsGroup.invalid" type="button">Next →</button>
            </div>
          </div>
        </mat-step>

        <!-- Step 3: EQ-i Scores -->
        <mat-step label="EQ-i Scores (optional)">
          <div class="step-body">
            <p class="step-hint">Enter scores from 1–130. Leave at 100 if not assessed.</p>
            <div class="eqi-grid">
              @for (dim of eqiDimensions; track dim) {
                <div class="eqi-row">
                  <label>{{ dim }}</label>
                  <input
                    type="number"
                    min="1" max="130"
                    [value]="eqiScores()[dim]"
                    (change)="setEqi(dim, $event)"
                    class="eqi-input"
                  />
                </div>
              }
            </div>
            <div class="step-actions">
              <button mat-button matStepperPrevious type="button">Back</button>
              <button mat-raised-button color="primary" matStepperNext type="button">
                Review →
              </button>
            </div>
          </div>
        </mat-step>

        <!-- Step 4: Review -->
        <mat-step label="Review & Generate">
          <div class="step-body review-step">
            <div class="review-row">
              <span>Coachee</span>
              <strong>{{ selectedCoacheceName() }}</strong>
            </div>
            <div class="review-row">
              <span>Goal</span>
              <strong>{{ goalsGroup.value.goals }}</strong>
            </div>
            <div class="review-row">
              <span>Gaps</span>
              <strong>{{ selectedGaps().join(', ') || '—' }}</strong>
            </div>
            <div class="review-row">
              <span>EQ-i dimensions</span>
              <strong>{{ eqiDimensions.length }} scored</strong>
            </div>

            <p class="ai-note">
              <mat-icon>auto_awesome</mat-icon>
              Claude AI will generate a full GROW-model IDP with milestones.
              This takes about 10–15 seconds.
            </p>

            <div class="step-actions">
              <button mat-button matStepperPrevious type="button">Back</button>
              <button mat-raised-button color="primary"
                      (click)="generate()" [disabled]="generating()" type="button">
                @if (generating()) {
                  <mat-spinner diameter="18" />
                  &nbsp; Generating...
                } @else {
                  <mat-icon>auto_awesome</mat-icon> Generate IDP
                }
              </button>
            </div>
          </div>
        </mat-step>

      </mat-stepper>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="generating()">Cancel</button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex; align-items: center; gap: 8px; color: var(--artes-primary);
      mat-icon { color: var(--artes-accent); }
    }

    mat-dialog-content { min-width: 520px; max-width: 600px; padding-top: 8px !important; }

    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 14px;
    }

    .step-body { padding-top: 12px; display: flex; flex-direction: column; gap: 8px; }
    .step-hint { font-size: 13px; color: #5a6a7e; margin: 0 0 12px; }
    .full-width { width: 100%; }
    .step-actions { display: flex; gap: 10px; align-items: center; margin-top: 8px; }

    .field-label { font-size: 13px; color: #5a6a7e; margin-bottom: 6px; }

    .chip-grid { display: flex; flex-wrap: wrap; gap: 6px; }

    .gap-chip {
      padding: 4px 12px; border-radius: 999px; border: 1px solid #dce6f0;
      background: white; font-size: 12px; cursor: pointer; color: #5a6a7e;
      transition: all 0.15s;
      &.selected { background: var(--artes-primary); color: white; border-color: var(--artes-primary); }
      &:hover:not(.selected) { border-color: var(--artes-accent); color: var(--artes-accent); }
    }

    .selected-gaps {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      font-size: 13px; color: #5a6a7e; margin-top: 4px;
      .gap-tag {
        background: rgba(39,196,160,0.15); color: #1a9678;
        padding: 2px 8px; border-radius: 999px; font-size: 12px;
        display: flex; align-items: center; gap: 4px;
        button { background: none; border: none; cursor: pointer; color: #1a9678; font-size: 14px; padding: 0; line-height: 1; }
      }
    }

    .eqi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .eqi-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 10px; background: #f8fafc; border-radius: 6px;
      label { font-size: 12px; color: #5a6a7e; }
      .eqi-input {
        width: 60px; text-align: center; border: 1px solid #dce6f0;
        border-radius: 4px; padding: 4px; font-size: 13px; font-weight: 600;
        &:focus { outline: none; border-color: var(--artes-accent); }
      }
    }

    .review-step {
      .review-row {
        display: flex; justify-content: space-between; align-items: flex-start;
        padding: 8px 0; border-bottom: 1px solid #f0f4f8; font-size: 14px;
        span { color: #5a6a7e; flex-shrink: 0; margin-right: 12px; }
        strong { color: var(--artes-primary); text-align: right; }
      }
    }

    .ai-note {
      display: flex; align-items: center; gap: 8px; margin-top: 16px;
      background: rgba(58,159,214,0.08); border-radius: 8px; padding: 10px 14px;
      font-size: 13px; color: #2080b0;
      mat-icon { color: var(--artes-accent); font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    }
  `],
})
export class IdpGenerateDialogComponent implements OnInit {
  coacheeGroup: FormGroup;
  goalsGroup: FormGroup;

  coachees = signal<User[]>([]);
  coaches = signal<User[]>([]);
  loadingUsers = signal(true);
  generating = signal(false);
  error = signal('');
  selectedGaps = signal<string[]>([]);
  eqiScores = signal<Record<string, number>>({});

  commonGaps = COMMON_GAPS;
  eqiDimensions = EQI_DIMENSIONS;

  selectedCoacheceName = signal('');

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private dialogRef: MatDialogRef<IdpGenerateDialogComponent>
  ) {
    this.coacheeGroup = this.fb.group({ coacheeId: ['', Validators.required], coachId: [null] });
    this.goalsGroup = this.fb.group({ goals: ['', Validators.required] });

    // Init EQ-i scores at 100
    const defaults: Record<string, number> = {};
    EQI_DIMENSIONS.forEach((d) => (defaults[d] = 100));
    this.eqiScores.set(defaults);
  }

  ngOnInit(): void {
    this.api.get<User[]>('/users').subscribe({
      next: (users) => {
        this.coachees.set(users.filter((u) => ['coachee', 'manager', 'hr_manager'].includes(u.role)));
        this.coaches.set(users.filter((u) => u.role === 'coach'));
        this.loadingUsers.set(false);
      },
      error: () => this.loadingUsers.set(false),
    });

    this.coacheeGroup.get('coacheeId')?.valueChanges.subscribe((id) => {
      const user = this.coachees().find((u) => u._id === id);
      if (user) this.selectedCoacheceName.set(`${user.firstName} ${user.lastName}`);
    });
  }

  toggleGap(gap: string): void {
    const current = this.selectedGaps();
    this.selectedGaps.set(
      current.includes(gap) ? current.filter((g) => g !== gap) : [...current, gap]
    );
  }

  addCustomGap(value: string): void {
    const trimmed = value.trim();
    if (trimmed && !this.selectedGaps().includes(trimmed)) {
      this.selectedGaps.set([...this.selectedGaps(), trimmed]);
    }
  }

  setEqi(dim: string, event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.eqiScores.set({ ...this.eqiScores(), [dim]: isNaN(val) ? 100 : val });
  }

  generate(): void {
    this.generating.set(true);
    this.error.set('');

    const payload = {
      coacheeId: this.coacheeGroup.value.coacheeId,
      coachId: this.coacheeGroup.value.coachId || undefined,
      goals: this.goalsGroup.value.goals,
      competencyGaps: this.selectedGaps(),
      eqiScores: this.eqiScores(),
    };

    this.api.post('/succession/idp/generate', payload).subscribe({
      next: (idp) => {
        this.generating.set(false);
        this.dialogRef.close(idp);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to generate IDP. Please try again.');
        this.generating.set(false);
      },
    });
  }
}
