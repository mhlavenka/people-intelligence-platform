import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { ApiService } from '../../../core/api.service';

interface SurveyTemplate {
  _id: string;
  title: string;
  moduleType: 'conflict' | 'neuroinclusion' | 'succession';
  intakeType: 'survey' | 'interview' | 'assessment';
  questions: {
    id: string; text: string; type: string; category: string;
    subscale?: string;
    pair_id?: number; scale_descriptor?: string;
    options?: { value: string; text: string; subscale: string }[];
    reverse_scored?: boolean; reverse_score_formula?: string;
    scale_range?: { min: number; max: number; labels?: string[] };
    behavior_temperature?: string; behavior_cluster?: string;
    reference_period?: string;
  }[];
  isActive: boolean;
  instrumentId?: string;
  instrumentVersion?: string;
  description?: string;
  instructions?: string;
  level_of_analysis?: string;
  aggregation_method?: string;
  minimum_respondents_per_team?: number;
  scoring?: {
    method: string;
    subscales?: string[];
    items_per_subscale?: number;
    total_items?: number;
    score_range_per_subscale?: { min: number; max: number };
    note?: string;
  };
  rater_type?: string;
}

@Component({
  selector: 'app-survey-template-dialog',
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
    MatDividerModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatExpansionModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ isEdit() ? 'edit' : 'add_circle' }}</mat-icon>
      {{ isEdit() ? 'Edit Intake Template' : 'New Intake Template' }}
    </h2>

    <mat-dialog-content>
      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <form [formGroup]="form">

        <!-- ── Basic info ─────────────────────────────────────────────── -->
        <div class="section">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Template Title</mat-label>
            <input matInput formControlName="title"
              placeholder="e.g. TKI Conflict Mode Instrument" />
          </mat-form-field>

          <div class="form-row">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Instrument ID</mat-label>
              <input matInput formControlName="instrumentId"
                placeholder="e.g. TKI, ROCI-II, PSS, CDP" />
              <mat-hint>Standardised instrument identifier</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline" style="width:160px">
              <mat-label>Version</mat-label>
              <input matInput formControlName="instrumentVersion"
                placeholder="e.g. 2007" />
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description</mat-label>
            <textarea matInput formControlName="description" rows="2"
              placeholder="Brief description of what this instrument measures…"></textarea>
            <mat-hint>Shown on the intake cover page</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Respondent instructions</mat-label>
            <textarea matInput formControlName="instructions" rows="3"
              placeholder="Think about situations in which your wishes differ from those of another person…"></textarea>
            <mat-hint>Displayed to the respondent before question 1</mat-hint>
          </mat-form-field>

          <div class="form-row">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Module</mat-label>
              <mat-select formControlName="moduleType">
                <mat-option value="conflict">Conflict Intelligence</mat-option>
                <mat-option value="neuroinclusion">Neuro-Inclusion Compass</mat-option>
                <mat-option value="succession">Leadership &amp; Succession</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Intake Type</mat-label>
              <mat-select formControlName="intakeType">
                <mat-option value="survey">Survey — self-completed</mat-option>
                <mat-option value="interview">Interview — coach-led</mat-option>
                <mat-option value="assessment">Assessment — coach-administered</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- ── Measurement Settings ───────────────────────────────────── -->
        <div class="section">
          <div class="section-label">Measurement Settings</div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Scoring Method</mat-label>
              <mat-select formControlName="scoringMethod">
                <mat-option value="">— Not specified —</mat-option>
                <mat-option value="normative">Normative (ROCI-II, PSS, CDP)</mat-option>
                <mat-option value="ipsative">Ipsative / Forced-choice (TKI)</mat-option>
              </mat-select>
              <mat-hint>Ipsative = fixed total across subscales</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Rater Type</mat-label>
              <mat-select formControlName="raterType">
                <mat-option value="">— Not specified —</mat-option>
                <mat-option value="self">Self-report</mat-option>
                <mat-option value="multi_rater">Multi-rater / 360</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Subscales (comma-separated)</mat-label>
            <input matInput formControlName="scoringSubscales"
              placeholder="e.g. competing, collaborating, compromising, avoiding, accommodating" />
            <mat-hint>Scoring buckets — must match subscale values on questions</mat-hint>
          </mat-form-field>

          <div class="form-row">
            <mat-form-field appearance="outline" style="width:160px">
              <mat-label>Items per subscale</mat-label>
              <input matInput type="number" formControlName="scoringItemsPerSubscale" min="1" />
            </mat-form-field>
            <mat-form-field appearance="outline" style="width:130px">
              <mat-label>Total items</mat-label>
              <input matInput type="number" formControlName="scoringTotalItems" min="1" />
            </mat-form-field>
            <mat-form-field appearance="outline" style="width:100px">
              <mat-label>Score min</mat-label>
              <input matInput type="number" formControlName="scoringRangeMin" />
            </mat-form-field>
            <mat-form-field appearance="outline" style="width:100px">
              <mat-label>Score max</mat-label>
              <input matInput type="number" formControlName="scoringRangeMax" />
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Scoring note</mat-label>
            <textarea matInput formControlName="scoringNote" rows="2"
              placeholder="e.g. Scores are relative. All subscale scores sum to 30."></textarea>
          </mat-form-field>

          <div class="form-row">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Level of Analysis</mat-label>
              <mat-select formControlName="levelOfAnalysis">
                <mat-option value="">— Not specified —</mat-option>
                <mat-option value="individual">Individual</mat-option>
                <mat-option value="team">Team</mat-option>
              </mat-select>
            </mat-form-field>

            @if (form.get('levelOfAnalysis')?.value === 'team') {
              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Team Aggregation Method</mat-label>
                <mat-select formControlName="aggregationMethod">
                  <mat-option value="team_mean">Team Mean</mat-option>
                  <mat-option value="rwg">r(wg) — Within-group Agreement</mat-option>
                  <mat-option value="icc1">ICC(1) — Intraclass Correlation</mat-option>
                </mat-select>
              </mat-form-field>
            }
          </div>

          @if (form.get('levelOfAnalysis')?.value === 'team') {
            <mat-form-field appearance="outline" style="width: 220px">
              <mat-label>Min Respondents per Team</mat-label>
              <input matInput type="number" formControlName="minRespondentsPerTeam" min="1" />
              <mat-hint>Gate before team scores are calculated</mat-hint>
            </mat-form-field>
          }
        </div>

        <mat-divider></mat-divider>

        <!-- ── Questions ──────────────────────────────────────────────── -->
        <div class="section questions-section">
          <div class="section-header">
            <h3>Questions <span class="count">{{ questionsArray.length }}</span></h3>
            <button mat-stroked-button type="button" (click)="addQuestion()">
              <mat-icon>add</mat-icon> Add Question
            </button>
          </div>

          <div formArrayName="questions" class="questions-list">
            @for (q of questionsArray.controls; track q; let i = $index) {
              <div [formGroupName]="i" class="question-row">
                <div class="q-number">{{ i + 1 }}</div>

                <div class="q-fields">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Question text</mat-label>
                    <input matInput formControlName="text"
                      placeholder="e.g. I try to satisfy the other party's wishes" />
                  </mat-form-field>

                  <div class="q-meta-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Type</mat-label>
                      <mat-select formControlName="type">
                        <mat-option value="scale">Scale</mat-option>
                        <mat-option value="boolean">Yes / No</mat-option>
                        <mat-option value="text">Open Text</mat-option>
                        <mat-option value="forced_choice">Forced Choice (A/B)</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Category</mat-label>
                      <input matInput formControlName="category"
                        placeholder="e.g. collaborating" />
                    </mat-form-field>
                  </div>

                  <!-- Forced-choice A/B options -->
                  @if (q.get('type')?.value === 'forced_choice') {
                    <div class="fc-options">
                      <div class="fc-option-label">Forced-choice options</div>
                      <div class="fc-row">
                        <span class="fc-badge">A</span>
                        <mat-form-field appearance="outline" class="fc-text">
                          <mat-label>Option A text</mat-label>
                          <textarea matInput formControlName="optionAText" rows="2"></textarea>
                        </mat-form-field>
                        <mat-form-field appearance="outline" class="fc-sub">
                          <mat-label>→ Subscale</mat-label>
                          <input matInput formControlName="optionASubscale"
                            placeholder="e.g. competing" />
                        </mat-form-field>
                      </div>
                      <div class="fc-row">
                        <span class="fc-badge">B</span>
                        <mat-form-field appearance="outline" class="fc-text">
                          <mat-label>Option B text</mat-label>
                          <textarea matInput formControlName="optionBText" rows="2"></textarea>
                        </mat-form-field>
                        <mat-form-field appearance="outline" class="fc-sub">
                          <mat-label>→ Subscale</mat-label>
                          <input matInput formControlName="optionBSubscale"
                            placeholder="e.g. avoiding" />
                        </mat-form-field>
                      </div>
                      <div class="form-row" style="margin-top:4px">
                        <mat-form-field appearance="outline" style="width:100px">
                          <mat-label>Pair ID</mat-label>
                          <input matInput type="number" formControlName="pairId" />
                          <mat-hint>TKI item #</mat-hint>
                        </mat-form-field>
                        <mat-form-field appearance="outline" class="grow">
                          <mat-label>Scale descriptor</mat-label>
                          <input matInput formControlName="scaleDescriptor"
                            placeholder="e.g. forced_choice_dyad" />
                        </mat-form-field>
                      </div>
                    </div>
                  }

                  <!-- Advanced fields (scale / boolean) -->
                  @if (q.get('type')?.value !== 'forced_choice' && q.get('type')?.value !== 'text') {
                    <mat-expansion-panel class="advanced-panel" hideToggle>
                      <mat-expansion-panel-header>
                        <mat-panel-title class="adv-title">
                          <mat-icon>tune</mat-icon> Advanced scoring options
                        </mat-panel-title>
                      </mat-expansion-panel-header>

                      <div class="adv-fields">
                        <mat-form-field appearance="outline">
                          <mat-label>Subscale</mat-label>
                          <input matInput formControlName="subscale"
                            placeholder="e.g. Accommodating" />
                          <mat-hint>Scoring bucket this item routes to</mat-hint>
                        </mat-form-field>

                        @if (q.get('type')?.value === 'scale') {
                          <div class="form-row scale-range-row">
                            <mat-form-field appearance="outline" style="width:80px">
                              <mat-label>Scale min</mat-label>
                              <input matInput type="number" formControlName="scaleMin" />
                            </mat-form-field>
                            <mat-form-field appearance="outline" style="width:80px">
                              <mat-label>Scale max</mat-label>
                              <input matInput type="number" formControlName="scaleMax" />
                            </mat-form-field>
                            <mat-form-field appearance="outline" class="grow">
                              <mat-label>Pole labels (comma-separated)</mat-label>
                              <input matInput formControlName="scaleLabels"
                                placeholder="Never, Rarely, Sometimes, Often, Always" />
                            </mat-form-field>
                          </div>

                          <div class="checkbox-row">
                            <mat-checkbox formControlName="reverseScored" color="primary">
                              Reverse-scored item
                            </mat-checkbox>
                          </div>

                          @if (q.get('reverseScored')?.value) {
                            <mat-form-field appearance="outline" class="full-width">
                              <mat-label>Reverse score formula</mat-label>
                              <input matInput formControlName="reverseScoreFormula"
                                placeholder="e.g. (max + 1) - x" />
                              <mat-hint>x = raw value; max = scale maximum</mat-hint>
                            </mat-form-field>
                          }
                        }

                        <mat-form-field appearance="outline" class="full-width">
                          <mat-label>Reference period</mat-label>
                          <input matInput formControlName="referencePeriod"
                            placeholder="e.g. over the past month" />
                        </mat-form-field>

                        <div class="form-row">
                          <mat-form-field appearance="outline" class="half-width">
                            <mat-label>Behaviour temperature (CDP)</mat-label>
                            <mat-select formControlName="behaviorTemperature">
                              <mat-option value="">—</mat-option>
                              <mat-option value="hot">Hot</mat-option>
                              <mat-option value="cool">Cool</mat-option>
                            </mat-select>
                          </mat-form-field>
                          <mat-form-field appearance="outline" class="half-width">
                            <mat-label>Behaviour cluster (CDP)</mat-label>
                            <input matInput formControlName="behaviorCluster"
                              placeholder="e.g. Attacking" />
                          </mat-form-field>
                        </div>
                      </div>
                    </mat-expansion-panel>
                  }
                </div>

                <button mat-icon-button type="button"
                        class="remove-btn"
                        matTooltip="Remove question"
                        (click)="removeQuestion(i)"
                        [disabled]="questionsArray.length <= 1">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            }
          </div>

          <button mat-stroked-button type="button" class="add-q-btn" (click)="addQuestion()">
            <mat-icon>add</mat-icon> Add Another Question
          </button>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
      <button mat-raised-button color="primary"
              (click)="save()" [disabled]="form.invalid || saving()">
        @if (saving()) {
          <mat-spinner diameter="18" />
        } @else {
          <mat-icon>{{ isEdit() ? 'save' : 'add_circle' }}</mat-icon>
          {{ isEdit() ? 'Save Changes' : 'Create Template' }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex; align-items: center; gap: 8px; color: #1B2A47;
      mat-icon { color: #3A9FD6; }
    }

    mat-dialog-content {
      min-width: 620px; max-width: 720px;
      padding-top: 8px !important;
      overflow-y: auto;
    }

    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;
    }

    .section { padding: 16px 0; display: flex; flex-direction: column; gap: 8px; }
    .section-label {
      font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.6px; color: #9aa5b4; margin-bottom: 4px;
    }
    .full-width { width: 100%; }
    .half-width { flex: 1; min-width: 0; }
    .grow { flex: 1; min-width: 0; }
    .form-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
    .scale-range-row { align-items: flex-start; }

    .questions-section { gap: 12px; }

    .section-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;
      h3 {
        font-size: 15px; color: #1B2A47; margin: 0;
        .count {
          background: #EBF5FB; color: #3A9FD6;
          padding: 1px 8px; border-radius: 999px; font-size: 12px; margin-left: 6px;
        }
      }
    }

    .questions-list { display: flex; flex-direction: column; gap: 12px; }

    .question-row {
      display: flex; gap: 12px; align-items: flex-start;
      background: #f8fafc; border-radius: 12px; padding: 12px;
    }

    .q-number {
      width: 28px; height: 28px; border-radius: 50%;
      background: #1B2A47; color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; flex-shrink: 0; margin-top: 10px;
    }

    .q-fields { flex: 1; display: flex; flex-direction: column; gap: 4px; }

    .q-meta-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    }

    /* Forced choice */
    .fc-options {
      background: rgba(58,159,214,0.06); border-radius: 8px;
      padding: 10px 12px; display: flex; flex-direction: column; gap: 8px;
      border: 1px dashed #b3d9ef;
    }
    .fc-option-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: #3A9FD6; margin-bottom: 2px;
    }
    .fc-row { display: flex; align-items: center; gap: 8px; }
    .fc-badge {
      width: 24px; height: 24px; border-radius: 50%;
      background: #1B2A47; color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; flex-shrink: 0;
    }
    .fc-text { flex: 2; min-width: 0; }
    .fc-sub  { flex: 1; min-width: 0; }

    /* Advanced panel */
    .advanced-panel {
      background: transparent !important;
      box-shadow: none !important;
      border: 1px solid #dce6f0;
      border-radius: 8px !important;
      margin-top: 4px;
    }
    .adv-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #5a6a7e;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .adv-fields {
      display: flex; flex-direction: column; gap: 8px; padding-top: 4px;
    }
    .checkbox-row { padding: 4px 0; }

    .remove-btn { color: #9aa5b4; flex-shrink: 0; margin-top: 4px; }
    .add-q-btn { width: 100%; margin-top: 4px; color: #3A9FD6; border-color: #3A9FD6; }
  `],
})
export class SurveyTemplateDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<SurveyTemplateDialogComponent>);
  private existingData = inject<SurveyTemplate | null>(MAT_DIALOG_DATA, { optional: true });

  form!: FormGroup;
  saving = signal(false);
  error = signal('');

  isEdit = () => !!this.existingData;

  get questionsArray(): FormArray {
    return this.form.get('questions') as FormArray;
  }

  ngOnInit(): void {
    const d = this.existingData;
    this.form = this.fb.group({
      title:                    [d?.title ?? '', Validators.required],
      instrumentId:             [d?.instrumentId ?? ''],
      instrumentVersion:        [d?.instrumentVersion ?? ''],
      description:              [d?.description ?? ''],
      instructions:             [d?.instructions ?? ''],
      moduleType:               [d?.moduleType ?? 'conflict', Validators.required],
      intakeType:               [d?.intakeType ?? 'survey', Validators.required],
      scoringMethod:            [d?.scoring?.method ?? ''],
      scoringSubscales:         [(d?.scoring?.subscales ?? []).join(', ')],
      scoringItemsPerSubscale:  [d?.scoring?.items_per_subscale ?? null],
      scoringTotalItems:        [d?.scoring?.total_items ?? null],
      scoringRangeMin:          [d?.scoring?.score_range_per_subscale?.min ?? null],
      scoringRangeMax:          [d?.scoring?.score_range_per_subscale?.max ?? null],
      scoringNote:              [d?.scoring?.note ?? ''],
      raterType:                [d?.rater_type ?? ''],
      levelOfAnalysis:          [d?.level_of_analysis ?? ''],
      aggregationMethod:        [d?.aggregation_method ?? ''],
      minRespondentsPerTeam:    [d?.minimum_respondents_per_team ?? null],
      questions:                this.fb.array([]),
    });

    if (d?.questions?.length) {
      d.questions.forEach((q) => this.addQuestion(q));
    } else {
      this.addQuestion();
      this.addQuestion();
      this.addQuestion();
    }
  }

  addQuestion(data?: SurveyTemplate['questions'][0]): void {
    const opts = data?.options ?? [];
    this.questionsArray.push(
      this.fb.group({
        id:                   [data?.id ?? `q${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, Validators.required],
        text:                 [data?.text ?? ''],
        type:                 [data?.type ?? 'scale', Validators.required],
        category:             [data?.category ?? '', Validators.required],
        pairId:               [data?.pair_id ?? null],
        scaleDescriptor:      [data?.scale_descriptor ?? ''],
        subscale:             [data?.subscale ?? ''],
        // Forced-choice A/B (flattened; value is auto-set to "A"/"B")
        optionAText:          [opts[0]?.text ?? ''],
        optionASubscale:      [opts[0]?.subscale ?? ''],
        optionBText:          [opts[1]?.text ?? ''],
        optionBSubscale:      [opts[1]?.subscale ?? ''],
        // Reverse scoring
        reverseScored:        [data?.reverse_scored ?? false],
        reverseScoreFormula:  [data?.reverse_score_formula ?? ''],
        // Scale range
        scaleMin:             [data?.scale_range?.min ?? null],
        scaleMax:             [data?.scale_range?.max ?? null],
        scaleLabels:          [(data?.scale_range?.labels ?? []).join(', ')],
        // CDP-specific
        behaviorTemperature:  [data?.behavior_temperature ?? ''],
        behaviorCluster:      [data?.behavior_cluster ?? ''],
        // Temporal anchor
        referencePeriod:      [data?.reference_period ?? ''],
      })
    );
  }

  removeQuestion(index: number): void {
    this.questionsArray.removeAt(index);
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error.set('');

    const v = this.form.value;

    // Transform flat form values back to the API schema
    const questions = (v.questions as ReturnType<typeof this.form.value.questions>[0][]).map((q: any) => {
      const base: Record<string, unknown> = {
        id:       q.id,
        text:     q.text,
        type:     q.type,
        category: q.category,
      };

      if (q.pairId != null)        base['pair_id']          = Number(q.pairId);
      if (q.scaleDescriptor)       base['scale_descriptor']  = q.scaleDescriptor;

      if (q.type === 'forced_choice') {
        base['options'] = [
          { value: 'A', text: q.optionAText, subscale: q.optionASubscale },
          { value: 'B', text: q.optionBText, subscale: q.optionBSubscale },
        ];
      } else {
        if (q.subscale)            base['subscale']           = q.subscale;
        if (q.reverseScored)       base['reverse_scored']     = true;
        if (q.reverseScoreFormula) base['reverse_score_formula'] = q.reverseScoreFormula;
        if (q.scaleMin != null && q.scaleMax != null) {
          base['scale_range'] = {
            min: Number(q.scaleMin),
            max: Number(q.scaleMax),
            labels: q.scaleLabels
              ? q.scaleLabels.split(',').map((s: string) => s.trim()).filter(Boolean)
              : [],
          };
        }
        if (q.behaviorTemperature) base['behavior_temperature'] = q.behaviorTemperature;
        if (q.behaviorCluster)     base['behavior_cluster']     = q.behaviorCluster;
        if (q.referencePeriod)     base['reference_period']     = q.referencePeriod;
      }
      return base;
    });

    const payload: Record<string, unknown> = {
      title:      v.title,
      moduleType: v.moduleType,
      intakeType: v.intakeType,
      questions,
    };

    if (v.instrumentId)        payload['instrumentId']        = v.instrumentId;
    if (v.instrumentVersion)   payload['instrumentVersion']   = v.instrumentVersion;
    if (v.description)         payload['description']         = v.description;
    if (v.instructions)        payload['instructions']        = v.instructions;

    if (v.scoringMethod) {
      const scoring: Record<string, unknown> = { method: v.scoringMethod };
      if (v.scoringSubscales) {
        scoring['subscales'] = v.scoringSubscales.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (v.scoringItemsPerSubscale != null && v.scoringItemsPerSubscale !== '') {
        scoring['items_per_subscale'] = Number(v.scoringItemsPerSubscale);
      }
      if (v.scoringTotalItems != null && v.scoringTotalItems !== '') {
        scoring['total_items'] = Number(v.scoringTotalItems);
      }
      if (v.scoringRangeMin != null && v.scoringRangeMax != null &&
          v.scoringRangeMin !== '' && v.scoringRangeMax !== '') {
        scoring['score_range_per_subscale'] = {
          min: Number(v.scoringRangeMin),
          max: Number(v.scoringRangeMax),
        };
      }
      if (v.scoringNote)  scoring['note'] = v.scoringNote;
      payload['scoring'] = scoring;
    }

    if (v.raterType)              payload['rater_type']                   = v.raterType;
    if (v.levelOfAnalysis)        payload['level_of_analysis']            = v.levelOfAnalysis;
    if (v.aggregationMethod)      payload['aggregation_method']           = v.aggregationMethod;
    if (v.minRespondentsPerTeam)  payload['minimum_respondents_per_team'] = Number(v.minRespondentsPerTeam);

    const request = this.isEdit()
      ? this.api.put(`/surveys/templates/${this.existingData!._id}`, payload)
      : this.api.post('/surveys/templates', payload);

    request.subscribe({
      next: (result) => { this.saving.set(false); this.dialogRef.close(result); },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to save template.');
        this.saving.set(false);
      },
    });
  }
}
