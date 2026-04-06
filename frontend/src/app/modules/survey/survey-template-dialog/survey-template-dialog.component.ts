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
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../../core/api.service';

interface SurveyTemplate {
  _id: string;
  title: string;
  moduleType: 'conflict' | 'neuroinclusion' | 'succession';
  intakeType: 'survey' | 'interview' | 'assessment';
  isActive: boolean;
  isGlobal?: boolean;
  instrumentId?: string;
  instrumentVersion?: string;
  description?: string;
  instructions?: string;
  relationship_target?: string;
  single_construct?: boolean;
  rater_pool?: { min: number; max: number; role_types?: string[] };
  level_of_analysis?: string;
  aggregation_method?: string;
  minimum_respondents_per_team?: number;
  scoring?: {
    method: string;
    subscales?: string[];
    subscale_config?: Record<string, unknown>;
    items_per_subscale?: number;
    total_items?: number;
    score_range_per_subscale?: { min: number; max: number };
    reverse_scored_items?: string[];
    aggregation_threshold?: {
      rwg_minimum?: number;
      below_threshold_action?: string;
      below_threshold_message?: string;
    };
    benchmarks?: Record<string, unknown>;
    note?: string;
  };
  rater_type?: string;
  questions: {
    id: string;
    text: string;
    type: string;
    category: string;
    subscale?: string;
    pair_id?: number;
    scale_descriptor?: string;
    modes_contrasted?: string[];
    options?: { value: string; text: string; subscale: string }[];
    reverse_scored?: boolean;
    reverse_score_formula?: string;
    scale_range?: { min: number; max: number; labels?: Record<string, string> };
    behavior_temperature?: string;
    behavior_cluster?: string;
    reference_period?: string;
  }[];
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
    MatTabsModule,
    MatSlideToggleModule,
    MatChipsModule,
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
        <mat-tab-group animationDuration="150ms" class="main-tabs">

          <!-- ══════════════════ TAB 1: IDENTITY ══════════════════ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">info</mat-icon> Identity
            </ng-template>

            <div class="tab-content">

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Template Title</mat-label>
                <input matInput formControlName="title"
                  placeholder="e.g. Thomas-Kilmann Conflict Mode Instrument (TKI)" />
              </mat-form-field>

              <div class="form-row">
                <mat-form-field appearance="outline" class="grow">
                  <mat-label>Instrument ID</mat-label>
                  <input matInput formControlName="instrumentId"
                    placeholder="e.g. TKI, ROCI-II, PSS-Edmondson, CDP-I, WCQ-deDreu" />
                  <mat-hint>Standardised instrument identifier</mat-hint>
                </mat-form-field>
                <mat-form-field appearance="outline" style="width:150px; flex-shrink:0">
                  <mat-label>Version</mat-label>
                  <input matInput formControlName="instrumentVersion" placeholder="e.g. 2007" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Description</mat-label>
                <textarea matInput formControlName="description" rows="3"
                  placeholder="Brief description of what this instrument measures and its validated use case…"></textarea>
                <mat-hint>Shown on the intake cover page to respondents</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Respondent Instructions</mat-label>
                <textarea matInput formControlName="instructions" rows="4"
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

              <div class="toggle-row">
                <mat-slide-toggle formControlName="isActive" color="primary">
                  Template is active
                </mat-slide-toggle>
                <span class="toggle-hint">Inactive templates are hidden from respondents and coach lists</span>
              </div>

            </div>
          </mat-tab>

          <!-- ══════════════════ TAB 2: MEASUREMENT ══════════════════ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">analytics</mat-icon> Measurement
            </ng-template>

            <div class="tab-content">

              <!-- ── Scoring ─────────────────────────────────────────── -->
              <div class="sub-section-label">Scoring</div>

              <div class="form-row">
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>Scoring Method</mat-label>
                  <mat-select formControlName="scoringMethod">
                    <mat-option value="">— Not specified —</mat-option>
                    <mat-option value="normative">Normative (ROCI-II, PSS, CDP, WCQ)</mat-option>
                    <mat-option value="ipsative">Ipsative / Forced-choice (TKI)</mat-option>
                  </mat-select>
                  <mat-hint>Ipsative = fixed point total across subscales</mat-hint>
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
                <mat-form-field appearance="outline" style="width:110px">
                  <mat-label>Score min</mat-label>
                  <input matInput type="number" formControlName="scoringRangeMin" />
                </mat-form-field>
                <mat-form-field appearance="outline" style="width:110px">
                  <mat-label>Score max</mat-label>
                  <input matInput type="number" formControlName="scoringRangeMax" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Reverse-scored item IDs (comma-separated)</mat-label>
                <input matInput formControlName="reverseScoreItems"
                  placeholder="e.g. q1, q3, q5" />
                <mat-hint>Item IDs where the engine applies reverse_score_formula before averaging (e.g. PSS)</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Scoring note</mat-label>
                <textarea matInput formControlName="scoringNote" rows="2"
                  placeholder="e.g. Scores are relative. All subscale scores sum to 30."></textarea>
              </mat-form-field>

              <mat-divider></mat-divider>

              <!-- ── Construct & Rater ───────────────────────────────── -->
              <div class="sub-section-label" style="margin-top:16px">Construct &amp; Rater</div>

              <div class="form-row">
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>Level of Analysis</mat-label>
                  <mat-select formControlName="levelOfAnalysis">
                    <mat-option value="">— Not specified —</mat-option>
                    <mat-option value="individual">Individual</mat-option>
                    <mat-option value="team">Team</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>Relationship Target</mat-label>
                  <mat-select formControlName="relationshipTarget">
                    <mat-option value="">— Not applicable —</mat-option>
                    <mat-option value="supervisor">Supervisor (upward)</mat-option>
                    <mat-option value="subordinate">Subordinate (downward)</mat-option>
                    <mat-option value="peer">Peer (lateral)</mat-option>
                  </mat-select>
                  <mat-hint>ROCI-II: determines which norm table is applied</mat-hint>
                </mat-form-field>
              </div>

              <div class="checkbox-row">
                <mat-checkbox formControlName="singleConstruct" color="primary">
                  Single-construct instrument
                </mat-checkbox>
                <span class="checkbox-hint">
                  A single aggregate score is the primary output (e.g. PSS). No subscale routing needed.
                </span>
              </div>

              <!-- ── Team Aggregation (only when level = team) ───────── -->
              @if (form.get('levelOfAnalysis')?.value === 'team') {
                <div class="inset-section">
                  <div class="inset-label">Team Aggregation</div>
                  <div class="form-row">
                    <mat-form-field appearance="outline" class="half-width">
                      <mat-label>Aggregation Method</mat-label>
                      <mat-select formControlName="aggregationMethod">
                        <mat-option value="team_mean">Team Mean</mat-option>
                        <mat-option value="rwg">r(wg) — Within-group Agreement</mat-option>
                        <mat-option value="icc1">ICC(1) — Intraclass Correlation</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" style="width:190px">
                      <mat-label>Min Respondents per Team</mat-label>
                      <input matInput type="number" formControlName="minRespondentsPerTeam" min="1" />
                    </mat-form-field>
                  </div>

                  <div class="form-row">
                    <mat-form-field appearance="outline" style="width:140px">
                      <mat-label>r(wg) Minimum</mat-label>
                      <input matInput type="number" formControlName="aggregationRwgMin"
                        step="0.01" min="0" max="1" placeholder="e.g. 0.70" />
                      <mat-hint>Aggregation gate (WCQ)</mat-hint>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="grow">
                      <mat-label>Below-threshold action</mat-label>
                      <input matInput formControlName="aggregationBelowAction"
                        placeholder="e.g. flag_for_individual_analysis" />
                    </mat-form-field>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Below-threshold message</mat-label>
                    <textarea matInput formControlName="aggregationBelowMessage" rows="2"
                      placeholder="Message shown when r(wg) is below threshold…"></textarea>
                  </mat-form-field>
                </div>
              }

              <!-- ── Rater Pool (only when rater_type = multi_rater) ─── -->
              @if (form.get('raterType')?.value === 'multi_rater') {
                <div class="inset-section">
                  <div class="inset-label">Rater Pool (360)</div>
                  <div class="form-row">
                    <mat-form-field appearance="outline" style="width:110px">
                      <mat-label>Pool min</mat-label>
                      <input matInput type="number" formControlName="raterPoolMin" min="1" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" style="width:110px">
                      <mat-label>Pool max</mat-label>
                      <input matInput type="number" formControlName="raterPoolMax" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="grow">
                      <mat-label>Role types (comma-separated)</mat-label>
                      <input matInput formControlName="raterPoolRoleTypes"
                        placeholder="e.g. peer, manager, direct_report" />
                    </mat-form-field>
                  </div>
                </div>
              }

              <!-- ── Advanced ─────────────────────────────────────────── -->
              <mat-divider style="margin-top:8px"></mat-divider>

              <mat-expansion-panel class="advanced-panel" hideToggle style="margin-top:12px">
                <mat-expansion-panel-header>
                  <mat-panel-title class="adv-title">
                    <mat-icon>code</mat-icon> Advanced — Subscale Config &amp; Benchmarks (JSON)
                  </mat-panel-title>
                </mat-expansion-panel-header>

                <div class="adv-json-section">
                  <div class="json-label">
                    <span>Subscale Config</span>
                    <span class="json-hint">Rich per-subscale metadata (CDP, WCQ). Keyed by subscale name.</span>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>scoring.subscale_config (JSON)</mat-label>
                    <textarea matInput formControlName="subscaleConfigJson" rows="8"
                      class="mono"
                      placeholder='{&#10;  "integrating": { "items": ["q1","q2"], "item_count": 2, "description": "..." }&#10;}'></textarea>
                  </mat-form-field>

                  <div class="json-label" style="margin-top:8px">
                    <span>Benchmarks</span>
                    <span class="json-hint">Norm-referenced interpretive bands for coaching reports (PSS). Keyed by band name.</span>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>scoring.benchmarks (JSON)</mat-label>
                    <textarea matInput formControlName="benchmarksJson" rows="8"
                      class="mono"
                      placeholder='{&#10;  "low": { "range": [1.0, 3.5], "label": "Unsafe", "interpretation": "..." }&#10;}'></textarea>
                  </mat-form-field>
                </div>
              </mat-expansion-panel>

            </div>
          </mat-tab>

          <!-- ══════════════════ TAB 3: QUESTIONS ══════════════════ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">quiz</mat-icon>
              Questions <span class="tab-count">{{ questionsArray.length }}</span>
            </ng-template>

            <div class="tab-content questions-tab">

              <div class="questions-header">
                <span class="qs-count">{{ questionsArray.length }} question{{ questionsArray.length !== 1 ? 's' : '' }}</span>
                <button mat-stroked-button type="button" (click)="addQuestion()">
                  <mat-icon>add</mat-icon> Add Question
                </button>
              </div>

              <div formArrayName="questions" class="questions-list">
                @for (q of questionsArray.controls; track q; let i = $index) {
                  <div [formGroupName]="i" class="question-row">

                    <div class="q-number">{{ i + 1 }}</div>

                    <div class="q-fields">

                      <!-- Question text (required on all types) -->
                      <mat-form-field appearance="outline" class="full-width">
                        <mat-label>Question text / stem</mat-label>
                        <textarea matInput formControlName="text" rows="2"
                          placeholder="e.g. When a conflict arises, how do you typically handle it?"></textarea>
                        <mat-hint>For forced_choice: frames the behavioural dilemma; statements live in options below</mat-hint>
                      </mat-form-field>

                      <!-- Type + Category -->
                      <div class="q-meta-row">
                        <mat-form-field appearance="outline">
                          <mat-label>Type</mat-label>
                          <mat-select formControlName="type">
                            <mat-option value="scale">Scale (Likert)</mat-option>
                            <mat-option value="boolean">Yes / No</mat-option>
                            <mat-option value="text">Open Text</mat-option>
                            <mat-option value="forced_choice">Forced Choice A/B (TKI-style)</mat-option>
                          </mat-select>
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>Category</mat-label>
                          <input matInput formControlName="category"
                            placeholder="e.g. conflict_mode" />
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>Subscale</mat-label>
                          <input matInput formControlName="subscale"
                            placeholder="e.g. collaborating" />
                          <mat-hint>Scoring bucket</mat-hint>
                        </mat-form-field>
                      </div>

                      <!-- ── Forced-choice A/B ── -->
                      @if (q.get('type')?.value === 'forced_choice') {
                        <div class="fc-options">
                          <div class="fc-header">
                            <span class="fc-option-label">Forced-choice options</span>
                            <div class="fc-meta">
                              <mat-form-field appearance="outline" style="width:110px">
                                <mat-label>Pair ID</mat-label>
                                <input matInput type="number" formControlName="pairId" />
                                <mat-hint>TKI item #</mat-hint>
                              </mat-form-field>
                              <mat-form-field appearance="outline" style="width:180px">
                                <mat-label>Scale descriptor</mat-label>
                                <input matInput formControlName="scaleDescriptor"
                                  placeholder="forced_choice_dyad" />
                              </mat-form-field>
                              <mat-form-field appearance="outline" class="grow">
                                <mat-label>Modes contrasted (comma-sep)</mat-label>
                                <input matInput formControlName="modesContrasted"
                                  placeholder="e.g. competing, avoiding" />
                                <mat-hint>TKI matrix validation helper</mat-hint>
                              </mat-form-field>
                            </div>
                          </div>

                          <div class="fc-row">
                            <span class="fc-badge">A</span>
                            <mat-form-field appearance="outline" class="fc-text">
                              <mat-label>Option A statement</mat-label>
                              <textarea matInput formControlName="optionAText" rows="2"></textarea>
                            </mat-form-field>
                            <mat-form-field appearance="outline" style="width:160px">
                              <mat-label>→ Subscale</mat-label>
                              <input matInput formControlName="optionASubscale"
                                placeholder="e.g. competing" />
                            </mat-form-field>
                          </div>
                          <div class="fc-row">
                            <span class="fc-badge">B</span>
                            <mat-form-field appearance="outline" class="fc-text">
                              <mat-label>Option B statement</mat-label>
                              <textarea matInput formControlName="optionBText" rows="2"></textarea>
                            </mat-form-field>
                            <mat-form-field appearance="outline" style="width:160px">
                              <mat-label>→ Subscale</mat-label>
                              <input matInput formControlName="optionBSubscale"
                                placeholder="e.g. avoiding" />
                            </mat-form-field>
                          </div>
                        </div>
                      }

                      <!-- ── Scale / Boolean advanced fields ── -->
                      @if (q.get('type')?.value === 'scale' || q.get('type')?.value === 'boolean') {
                        <mat-expansion-panel class="adv-q-panel" hideToggle>
                          <mat-expansion-panel-header>
                            <mat-panel-title class="adv-q-title">
                              <mat-icon>tune</mat-icon> Scoring &amp; scale options
                            </mat-panel-title>
                          </mat-expansion-panel-header>

                          <div class="adv-q-fields">

                            @if (q.get('type')?.value === 'scale') {
                              <!-- Scale range -->
                              <div class="scale-range-block">
                                <div class="form-row">
                                  <mat-form-field appearance="outline" style="width:110px">
                                    <mat-label>Scale min</mat-label>
                                    <input matInput type="number" formControlName="scaleMin" />
                                  </mat-form-field>
                                  <mat-form-field appearance="outline" style="width:110px">
                                    <mat-label>Scale max</mat-label>
                                    <input matInput type="number" formControlName="scaleMax" />
                                  </mat-form-field>
                                  <button mat-stroked-button type="button"
                                          class="gen-labels-btn"
                                          matTooltip="Generate label keys from min/max"
                                          (click)="generateLabelTemplate(i)">
                                    <mat-icon>auto_fix_high</mat-icon> Generate labels
                                  </button>
                                </div>
                                <mat-form-field appearance="outline" class="full-width">
                                  <mat-label>Scale labels (JSON — keyed by scale point)</mat-label>
                                  <textarea matInput formControlName="scaleLabels" rows="4"
                                    class="mono"
                                    placeholder='{&#10;  "1": "Strongly Disagree",&#10;  "5": "Strongly Agree"&#10;}'></textarea>
                                  <mat-hint>Keys are numeric strings matching scale points, e.g. "1", "2", …</mat-hint>
                                </mat-form-field>
                              </div>

                              <!-- Reverse scoring -->
                              <div class="checkbox-row">
                                <mat-checkbox formControlName="reverseScored" color="primary">
                                  Reverse-scored item
                                </mat-checkbox>
                              </div>
                              @if (q.get('reverseScored')?.value) {
                                <mat-form-field appearance="outline" class="full-width">
                                  <mat-label>Reverse score formula</mat-label>
                                  <input matInput formControlName="reverseScoreFormula"
                                    placeholder="max_plus_one_minus_raw" />
                                  <mat-hint>Standard: (scale_range.max + 1) - raw</mat-hint>
                                </mat-form-field>
                              }
                            }

                            <!-- Temporal anchor -->
                            <mat-form-field appearance="outline" class="full-width">
                              <mat-label>Reference period</mat-label>
                              <input matInput formControlName="referencePeriod"
                                placeholder="e.g. past_month, past_quarter" />
                              <mat-hint>Temporal anchor for frequency-based items (WCQ, ROCI-II)</mat-hint>
                            </mat-form-field>

                            <!-- CDP fields -->
                            <div class="form-row">
                              <mat-form-field appearance="outline" class="half-width">
                                <mat-label>Behaviour temperature (CDP)</mat-label>
                                <mat-select formControlName="behaviorTemperature">
                                  <mat-option value="">—</mat-option>
                                  <mat-option value="hot">Hot — active / escalating</mat-option>
                                  <mat-option value="cool">Cool — passive / de-escalating</mat-option>
                                </mat-select>
                              </mat-form-field>
                              <mat-form-field appearance="outline" class="half-width">
                                <mat-label>Behaviour cluster (CDP)</mat-label>
                                <input matInput formControlName="behaviorCluster"
                                  placeholder="e.g. perspective_taking" />
                              </mat-form-field>
                            </div>

                          </div>
                        </mat-expansion-panel>
                      }

                    </div><!-- /q-fields -->

                    <button mat-icon-button type="button"
                            class="remove-btn"
                            matTooltip="Remove question"
                            (click)="removeQuestion(i)"
                            [disabled]="questionsArray.length <= 1">
                      <mat-icon>close</mat-icon>
                    </button>

                  </div><!-- /question-row -->
                }
              </div>

              <button mat-stroked-button type="button" class="add-q-btn" (click)="addQuestion()">
                <mat-icon>add</mat-icon> Add Another Question
              </button>

            </div>
          </mat-tab>

        </mat-tab-group>
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
      min-width: 860px; max-width: 1000px;
      padding-top: 8px !important;
      overflow-y: auto;
    }

    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 14px;
    }

    /* Tabs */
    .main-tabs {
      ::ng-deep .mat-mdc-tab-header { margin: 0 -4px; }
    }
    .tab-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; vertical-align: middle; }
    .tab-count {
      margin-left: 6px; background: #EBF5FB; color: #3A9FD6;
      padding: 1px 7px; border-radius: 999px; font-size: 11px;
    }

    /* Tab content */
    .tab-content {
      padding: 20px 4px 8px;
      display: flex; flex-direction: column; gap: 10px;
    }

    /* Layout helpers */
    .full-width { width: 100%; }
    .half-width { flex: 1; min-width: 0; }
    .grow { flex: 1; min-width: 0; }
    .form-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }

    /* Toggle */
    .toggle-row {
      display: flex; align-items: center; gap: 12px; padding: 6px 0;
    }
    .toggle-hint { font-size: 12px; color: #9aa5b4; }

    /* Sub-section labels */
    .sub-section-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.6px; color: #9aa5b4; margin-bottom: 2px;
    }

    /* Inset section (team / rater pool) */
    .inset-section {
      background: #f8fafc; border-radius: 10px; padding: 14px 16px;
      border: 1px solid #e2eaf2; display: flex; flex-direction: column; gap: 8px;
    }
    .inset-label {
      font-size: 12px; font-weight: 600; color: #3A9FD6; margin-bottom: 2px;
    }

    /* Checkboxes */
    .checkbox-row { padding: 4px 0; display: flex; align-items: center; gap: 12px; }
    .checkbox-hint { font-size: 12px; color: #9aa5b4; max-width: 440px; line-height: 1.4; }

    /* Advanced JSON panel */
    .advanced-panel {
      background: transparent !important;
      box-shadow: none !important;
      border: 1px solid #dce6f0;
      border-radius: 8px !important;
    }
    .adv-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #5a6a7e;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .adv-json-section { display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }
    .json-label {
      display: flex; align-items: baseline; gap: 10px;
      span { font-size: 12px; font-weight: 600; color: #374151; }
      .json-hint { font-size: 11px; color: #9aa5b4; }
    }

    /* Mono textarea */
    ::ng-deep textarea.mono { font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; }

    /* Questions tab */
    .questions-tab { gap: 12px; }
    .questions-header {
      display: flex; align-items: center; justify-content: space-between;
      .qs-count { font-size: 13px; color: #9aa5b4; }
    }
    .questions-list { display: flex; flex-direction: column; gap: 12px; }

    .question-row {
      display: flex; gap: 12px; align-items: flex-start;
      background: #f8fafc; border-radius: 12px; padding: 14px;
      border: 1px solid #e8f0f8;
    }
    .q-number {
      width: 28px; height: 28px; border-radius: 50%;
      background: #1B2A47; color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; flex-shrink: 0; margin-top: 12px;
    }
    .q-fields { flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .q-meta-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

    /* Forced choice */
    .fc-options {
      background: rgba(58,159,214,0.05); border-radius: 8px;
      padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
      border: 1px dashed #b3d9ef;
    }
    .fc-header { display: flex; flex-direction: column; gap: 8px; }
    .fc-option-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: #3A9FD6;
    }
    .fc-meta { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; }
    .fc-row { display: flex; align-items: center; gap: 8px; }
    .fc-badge {
      width: 26px; height: 26px; border-radius: 50%;
      background: #1B2A47; color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; flex-shrink: 0;
    }
    .fc-text { flex: 1; min-width: 0; }

    /* Adv question panel */
    .adv-q-panel {
      background: transparent !important;
      box-shadow: none !important;
      border: 1px solid #dce6f0;
      border-radius: 8px !important;
      margin-top: 2px;
    }
    .adv-q-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #5a6a7e;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .adv-q-fields { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
    .scale-range-block { display: flex; flex-direction: column; gap: 6px; }
    .gen-labels-btn {
      height: 56px; align-self: flex-start; color: #3A9FD6;
      border-color: #3A9FD6; font-size: 12px;
    }

    .remove-btn { color: #9aa5b4; flex-shrink: 0; margin-top: 6px; }
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
      // Identity
      title:             [d?.title ?? '', Validators.required],
      instrumentId:      [d?.instrumentId ?? ''],
      instrumentVersion: [d?.instrumentVersion ?? ''],
      description:       [d?.description ?? ''],
      instructions:      [d?.instructions ?? ''],
      moduleType:        [d?.moduleType ?? 'conflict', Validators.required],
      intakeType:        [d?.intakeType ?? 'survey', Validators.required],
      isActive:          [d?.isActive ?? true],

      // Measurement — scoring
      scoringMethod:           [d?.scoring?.method ?? ''],
      scoringSubscales:        [(d?.scoring?.subscales ?? []).join(', ')],
      scoringItemsPerSubscale: [d?.scoring?.items_per_subscale ?? null],
      scoringTotalItems:       [d?.scoring?.total_items ?? null],
      scoringRangeMin:         [d?.scoring?.score_range_per_subscale?.min ?? null],
      scoringRangeMax:         [d?.scoring?.score_range_per_subscale?.max ?? null],
      reverseScoreItems:       [(d?.scoring?.reverse_scored_items ?? []).join(', ')],
      scoringNote:             [d?.scoring?.note ?? ''],

      // Measurement — construct & rater
      levelOfAnalysis:    [d?.level_of_analysis ?? ''],
      relationshipTarget: [d?.relationship_target ?? ''],
      singleConstruct:    [d?.single_construct ?? false],
      raterType:          [d?.rater_type ?? ''],

      // Team aggregation
      aggregationMethod:       [d?.aggregation_method ?? ''],
      minRespondentsPerTeam:   [d?.minimum_respondents_per_team ?? null],
      aggregationRwgMin:       [d?.scoring?.aggregation_threshold?.rwg_minimum ?? null],
      aggregationBelowAction:  [d?.scoring?.aggregation_threshold?.below_threshold_action ?? ''],
      aggregationBelowMessage: [d?.scoring?.aggregation_threshold?.below_threshold_message ?? ''],

      // Rater pool
      raterPoolMin:       [d?.rater_pool?.min ?? null],
      raterPoolMax:       [d?.rater_pool?.max ?? null],
      raterPoolRoleTypes: [(d?.rater_pool?.role_types ?? []).join(', ')],

      // Advanced JSON
      subscaleConfigJson: [d?.scoring?.subscale_config ? JSON.stringify(d.scoring.subscale_config, null, 2) : ''],
      benchmarksJson:     [d?.scoring?.benchmarks ? JSON.stringify(d.scoring.benchmarks, null, 2) : ''],

      // Questions
      questions: this.fb.array([]),
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
        id:                  [data?.id ?? `q${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, Validators.required],
        text:                [data?.text ?? '', Validators.required],
        type:                [data?.type ?? 'scale', Validators.required],
        category:            [data?.category ?? '', Validators.required],
        subscale:            [data?.subscale ?? ''],
        // Forced choice
        pairId:              [data?.pair_id ?? null],
        scaleDescriptor:     [data?.scale_descriptor ?? ''],
        modesContrasted:     [(data?.modes_contrasted ?? []).join(', ')],
        optionAText:         [opts[0]?.text ?? ''],
        optionASubscale:     [opts[0]?.subscale ?? ''],
        optionBText:         [opts[1]?.text ?? ''],
        optionBSubscale:     [opts[1]?.subscale ?? ''],
        // Scoring
        reverseScored:       [data?.reverse_scored ?? false],
        reverseScoreFormula: [data?.reverse_score_formula ?? ''],
        // Scale range
        scaleMin:            [data?.scale_range?.min ?? null],
        scaleMax:            [data?.scale_range?.max ?? null],
        scaleLabels:         [data?.scale_range?.labels ? JSON.stringify(data.scale_range.labels) : ''],
        // CDP
        behaviorTemperature: [data?.behavior_temperature ?? ''],
        behaviorCluster:     [data?.behavior_cluster ?? ''],
        // Temporal
        referencePeriod:     [data?.reference_period ?? ''],
      })
    );
  }

  removeQuestion(index: number): void {
    this.questionsArray.removeAt(index);
  }

  generateLabelTemplate(i: number): void {
    const q = this.questionsArray.at(i);
    const min = Number(q.get('scaleMin')?.value);
    const max = Number(q.get('scaleMax')?.value);
    if (!min || !max || min >= max) return;
    const labels: Record<string, string> = {};
    for (let n = min; n <= max; n++) labels[n.toString()] = '';
    q.get('scaleLabels')?.setValue(JSON.stringify(labels, null, 2));
  }

  private parseJson(str: string): unknown | null {
    if (!str?.trim()) return null;
    try { return JSON.parse(str); } catch { return null; }
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error.set('');

    const v = this.form.value;

    // Build questions
    const questions = (v.questions as any[]).map((q: any) => {
      const base: Record<string, unknown> = {
        id:       q.id,
        text:     q.text,
        type:     q.type,
        category: q.category,
      };

      if (q.subscale) base['subscale'] = q.subscale;

      if (q.type === 'forced_choice') {
        if (q.pairId != null)       base['pair_id']         = Number(q.pairId);
        if (q.scaleDescriptor)      base['scale_descriptor'] = q.scaleDescriptor;
        if (q.modesContrasted) {
          base['modes_contrasted'] = q.modesContrasted.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
        base['options'] = [
          { value: 'A', text: q.optionAText, subscale: q.optionASubscale },
          { value: 'B', text: q.optionBText, subscale: q.optionBSubscale },
        ];
      } else {
        if (q.reverseScored)       base['reverse_scored']       = true;
        if (q.reverseScoreFormula) base['reverse_score_formula'] = q.reverseScoreFormula;
        if (q.referencePeriod)     base['reference_period']      = q.referencePeriod;
        if (q.behaviorTemperature) base['behavior_temperature']  = q.behaviorTemperature;
        if (q.behaviorCluster)     base['behavior_cluster']      = q.behaviorCluster;

        if (q.scaleMin != null && q.scaleMax != null &&
            q.scaleMin !== '' && q.scaleMax !== '') {
          const scaleRange: Record<string, unknown> = {
            min: Number(q.scaleMin),
            max: Number(q.scaleMax),
          };
          const parsedLabels = this.parseJson(q.scaleLabels);
          if (parsedLabels) scaleRange['labels'] = parsedLabels;
          base['scale_range'] = scaleRange;
        }
      }
      return base;
    });

    // Build payload
    const payload: Record<string, unknown> = {
      title:      v.title,
      moduleType: v.moduleType,
      intakeType: v.intakeType,
      isActive:   v.isActive,
      questions,
    };

    if (v.instrumentId)      payload['instrumentId']      = v.instrumentId;
    if (v.instrumentVersion) payload['instrumentVersion'] = v.instrumentVersion;
    if (v.description)       payload['description']       = v.description;
    if (v.instructions)      payload['instructions']      = v.instructions;
    if (v.levelOfAnalysis)   payload['level_of_analysis'] = v.levelOfAnalysis;
    if (v.relationshipTarget) payload['relationship_target'] = v.relationshipTarget;
    if (v.singleConstruct)   payload['single_construct']  = true;
    if (v.raterType)         payload['rater_type']        = v.raterType;
    if (v.aggregationMethod) payload['aggregation_method'] = v.aggregationMethod;
    if (v.minRespondentsPerTeam) payload['minimum_respondents_per_team'] = Number(v.minRespondentsPerTeam);

    // Rater pool
    if (v.raterPoolMin || v.raterPoolMax) {
      payload['rater_pool'] = {
        min: Number(v.raterPoolMin),
        max: Number(v.raterPoolMax),
        role_types: v.raterPoolRoleTypes
          ? v.raterPoolRoleTypes.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
      };
    }

    // Scoring
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
      if (v.reverseScoreItems) {
        scoring['reverse_scored_items'] = v.reverseScoreItems.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (v.aggregationRwgMin || v.aggregationBelowAction || v.aggregationBelowMessage) {
        const threshold: Record<string, unknown> = {};
        if (v.aggregationRwgMin)       threshold['rwg_minimum']            = Number(v.aggregationRwgMin);
        if (v.aggregationBelowAction)  threshold['below_threshold_action'] = v.aggregationBelowAction;
        if (v.aggregationBelowMessage) threshold['below_threshold_message'] = v.aggregationBelowMessage;
        scoring['aggregation_threshold'] = threshold;
      }
      const parsedSubscaleCfg = this.parseJson(v.subscaleConfigJson);
      if (parsedSubscaleCfg) scoring['subscale_config'] = parsedSubscaleCfg;

      const parsedBenchmarks = this.parseJson(v.benchmarksJson);
      if (parsedBenchmarks) scoring['benchmarks'] = parsedBenchmarks;

      if (v.scoringNote) scoring['note'] = v.scoringNote;
      payload['scoring'] = scoring;
    }

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
