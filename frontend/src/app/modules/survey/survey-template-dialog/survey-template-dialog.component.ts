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
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface SurveyTemplate {
  _id: string;
  title: string;
  moduleType: 'conflict' | 'neuroinclusion' | 'succession' | 'coaching';
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
  minResponsesForAnalysis?: number;
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
  analysisPrompt?: string;
  language?: string;
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
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ isEdit() ? 'edit' : 'add_circle' }}</mat-icon>
      {{ isEdit() ? ("SURVEY.editIntakeTemplate" | translate) : ("SURVEY.newIntakeTemplate" | translate) }}
    </h2>

    <mat-dialog-content>
      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <form [formGroup]="form" style="flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden">
        <mat-tab-group animationDuration="150ms" class="main-tabs">

          <!-- ══════════════════ TAB 1: IDENTITY ══════════════════ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">info</mat-icon> {{ "SURVEY.tabIdentity" | translate }}
            </ng-template>

            <div class="tab-content">

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ "SURVEY.templateTitleLabel" | translate }}</mat-label>
                <input matInput formControlName="title"
                  [placeholder]="'SURVEY.titlePlaceholder' | translate" />
              </mat-form-field>

              <div class="form-row">
                <mat-form-field appearance="outline" class="grow">
                  <mat-label>{{ 'SURVEY.instrumentId' | translate }}</mat-label>
                  <input matInput formControlName="instrumentId"
                    [placeholder]="'SURVEY.instrumentIdPlaceholder' | translate" />
                  <mat-hint>{{ 'SURVEY.instrumentIdHint' | translate }}</mat-hint>
                </mat-form-field>
                <mat-form-field appearance="outline" style="width:150px; flex-shrink:0">
                  <mat-label>{{ 'SURVEY.version' | translate }}</mat-label>
                  <input matInput formControlName="instrumentVersion" placeholder="e.g. 2007" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'COMMON.description' | translate }}</mat-label>
                <textarea matInput formControlName="description" rows="3"
                  [placeholder]="'SURVEY.descriptionPlaceholder' | translate"></textarea>
                <mat-hint>{{ 'SURVEY.descriptionHint' | translate }}</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'SURVEY.respondentInstructions' | translate }}</mat-label>
                <textarea matInput formControlName="instructions" rows="4"
                  [placeholder]="'SURVEY.instructionsPlaceholder' | translate"></textarea>
                <mat-hint>{{ 'SURVEY.instructionsHint' | translate }}</mat-hint>
              </mat-form-field>

              <div class="form-row">
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>{{ 'SURVEY.moduleLabel' | translate }}</mat-label>
                  <mat-select formControlName="moduleType">
                    <mat-option value="conflict">{{ "SURVEY.conflictIntelligence" | translate }}</mat-option>
                    <mat-option value="neuroinclusion">{{ "SURVEY.neuroInclusionCompass" | translate }}</mat-option>
                    <mat-option value="succession">{{ "SURVEY.leadershipSuccession" | translate }}</mat-option>
                    <mat-option value="coaching">{{ "SURVEY.coaching" | translate }}</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>{{ 'SURVEY.intakeTypeLabel' | translate }}</mat-label>
                  <mat-select formControlName="intakeType" (selectionChange)="onIntakeTypeChange($event.value)">
                    <mat-option value="survey">{{ "SURVEY.surveyTypeSelfCompleted" | translate }}</mat-option>
                    <mat-option value="interview">{{ "SURVEY.interviewTypeCoachLed" | translate }}</mat-option>
                    <mat-option value="assessment">{{ "SURVEY.assessmentTypeCoachAdmin" | translate }}</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="form-row form-row-with-hint">
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>{{ 'SURVEY.minResponsesLabel' | translate }}</mat-label>
                  <input matInput type="number" min="1" formControlName="minResponsesForAnalysis" />
                  <mat-hint>{{ 'SURVEY.minResponsesHint' | translate }}</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>{{ 'SURVEY.intakeLanguage' | translate }}</mat-label>
                  <mat-select formControlName="language">
                    <mat-option value="en">English</mat-option>
                    <mat-option value="fr">Français</mat-option>
                    <mat-option value="es">Español</mat-option>
                    <mat-option value="sk">Slovenčina</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              @if (isEdit()) {
                @if (siblingTranslations().length > 0) {
                  <div class="lang-nav">
                    <span class="lang-nav-label">{{ 'SURVEY.otherLanguages' | translate }}:</span>
                    @for (t of siblingTranslations(); track t._id) {
                      <button mat-stroked-button type="button" class="lang-nav-btn"
                              (click)="openTranslation(t._id)">
                        {{ langLabel(t.language) }}
                      </button>
                    }
                  </div>
                }

                @if (availableTranslateLangs().length > 0) {
                  <div class="translate-row">
                    <mat-form-field appearance="outline" class="translate-lang-select">
                      <mat-label>{{ 'SURVEY.translateTo' | translate }}</mat-label>
                      <mat-select [(value)]="translateTargetLang">
                        @for (lang of availableTranslateLangs(); track lang.value) {
                          <mat-option [value]="lang.value">{{ lang.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <button mat-stroked-button type="button"
                            (click)="translateIntake()"
                            [disabled]="translating() || !translateTargetLang">
                      @if (translating()) { <mat-spinner diameter="16" /> }
                      @else { <mat-icon>translate</mat-icon> }
                      {{ 'SURVEY.translateIntake' | translate }}
                    </button>
                  </div>
                }
              }

              <div class="toggle-row">
                <mat-slide-toggle formControlName="isActive" color="primary">
                  {{ "SURVEY.templateIsActive" | translate }}
                </mat-slide-toggle>
                <span class="toggle-hint">{{ "SURVEY.templateIsActiveHint" | translate }}</span>
              </div>

            </div>
          </mat-tab>

          <!-- ══════════════════ TAB 2: MEASUREMENT ══════════════════ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">analytics</mat-icon> {{ "SURVEY.tabMeasurement" | translate }}
            </ng-template>

            <div class="tab-content">

              <!-- ── Scoring ─────────────────────────────────────────── -->
              <div class="sub-section-label">{{ 'SURVEY.scoring' | translate }}</div>

              <div class="form-row">
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>{{ 'SURVEY.scoringMethod' | translate }}</mat-label>
                  <mat-select formControlName="scoringMethod">
                    <mat-option value="">{{ 'SURVEY.notSpecified' | translate }}</mat-option>
                    <mat-option value="normative">{{ 'SURVEY.scoringNormative' | translate }}</mat-option>
                    <mat-option value="ipsative">{{ 'SURVEY.scoringIpsative' | translate }}</mat-option>
                  </mat-select>
                  <mat-hint>{{ 'SURVEY.scoringMethodHint' | translate }}</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>{{ 'SURVEY.raterType' | translate }}</mat-label>
                  <mat-select formControlName="raterType">
                    <mat-option value="">{{ 'SURVEY.notSpecified' | translate }}</mat-option>
                    <mat-option value="self">{{ 'SURVEY.raterSelfReport' | translate }}</mat-option>
                    <mat-option value="multi_rater">{{ 'SURVEY.raterMulti360' | translate }}</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'SURVEY.subscalesLabel' | translate }}</mat-label>
                <input matInput formControlName="scoringSubscales"
                  placeholder="e.g. competing, collaborating, compromising, avoiding, accommodating" />
                <mat-hint>{{ 'SURVEY.subscalesHint' | translate }}</mat-hint>
              </mat-form-field>

              <div class="form-row">
                <mat-form-field appearance="outline" style="width:160px">
                  <mat-label>{{ 'SURVEY.itemsPerSubscale' | translate }}</mat-label>
                  <input matInput type="number" formControlName="scoringItemsPerSubscale" min="1" />
                </mat-form-field>
                <mat-form-field appearance="outline" style="width:130px">
                  <mat-label>{{ 'SURVEY.totalItems' | translate }}</mat-label>
                  <input matInput type="number" formControlName="scoringTotalItems" min="1" />
                </mat-form-field>
                <mat-form-field appearance="outline" style="width:110px">
                  <mat-label>{{ 'SURVEY.scoreMin' | translate }}</mat-label>
                  <input matInput type="number" formControlName="scoringRangeMin" />
                </mat-form-field>
                <mat-form-field appearance="outline" style="width:110px">
                  <mat-label>{{ 'SURVEY.scoreMax' | translate }}</mat-label>
                  <input matInput type="number" formControlName="scoringRangeMax" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'SURVEY.reverseScoredItemIds' | translate }}</mat-label>
                <input matInput formControlName="reverseScoreItems"
                  placeholder="e.g. q1, q3, q5" />
                <mat-hint>{{ 'SURVEY.reverseScoredItemIdsHint' | translate }}</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'SURVEY.scoringNote' | translate }}</mat-label>
                <textarea matInput formControlName="scoringNote" rows="2"
                  [placeholder]="'SURVEY.scoringNotePlaceholder' | translate"></textarea>
              </mat-form-field>

              <mat-divider></mat-divider>

              <!-- ── Construct & Rater ───────────────────────────────── -->
              <div class="sub-section-label" style="margin-top:16px">{{ 'SURVEY.constructAndRater' | translate }}</div>

              <div class="form-row">
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>{{ 'SURVEY.levelOfAnalysis' | translate }}</mat-label>
                  <mat-select formControlName="levelOfAnalysis">
                    <mat-option value="">{{ 'SURVEY.notSpecified' | translate }}</mat-option>
                    <mat-option value="individual">{{ 'SURVEY.levelIndividual' | translate }}</mat-option>
                    <mat-option value="team">{{ 'SURVEY.levelTeam' | translate }}</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>{{ 'SURVEY.relationshipTarget' | translate }}</mat-label>
                  <mat-select formControlName="relationshipTarget">
                    <mat-option value="">{{ 'SURVEY.notApplicable' | translate }}</mat-option>
                    <mat-option value="supervisor">{{ 'SURVEY.targetSupervisor' | translate }}</mat-option>
                    <mat-option value="subordinate">{{ 'SURVEY.targetSubordinate' | translate }}</mat-option>
                    <mat-option value="peer">{{ 'SURVEY.targetPeer' | translate }}</mat-option>
                  </mat-select>
                  <mat-hint>{{ 'SURVEY.relationshipTargetHint' | translate }}</mat-hint>
                </mat-form-field>
              </div>

              <div class="checkbox-row">
                <mat-checkbox formControlName="singleConstruct" color="primary">
                  {{ 'SURVEY.singleConstruct' | translate }}
                </mat-checkbox>
                <span class="checkbox-hint">
                  {{ 'SURVEY.singleConstructHint' | translate }}
                </span>
              </div>

              <!-- ── Team Aggregation (only when level = team) ───────── -->
              @if (form.get('levelOfAnalysis')?.value === 'team') {
                <div class="inset-section">
                  <div class="inset-label">{{ 'SURVEY.teamAggregation' | translate }}</div>
                  <div class="form-row">
                    <mat-form-field appearance="outline" class="half-width">
                      <mat-label>{{ 'SURVEY.aggregationMethod' | translate }}</mat-label>
                      <mat-select formControlName="aggregationMethod">
                        <mat-option value="team_mean">{{ 'SURVEY.aggTeamMean' | translate }}</mat-option>
                        <mat-option value="rwg">{{ 'SURVEY.aggRwg' | translate }}</mat-option>
                        <mat-option value="icc1">{{ 'SURVEY.aggIcc1' | translate }}</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" style="width:190px">
                      <mat-label>{{ 'SURVEY.minRespondentsPerTeam' | translate }}</mat-label>
                      <input matInput type="number" formControlName="minRespondentsPerTeam" min="1" />
                    </mat-form-field>
                  </div>

                  <div class="form-row">
                    <mat-form-field appearance="outline" style="width:140px">
                      <mat-label>{{ 'SURVEY.rwgMinimum' | translate }}</mat-label>
                      <input matInput type="number" formControlName="aggregationRwgMin"
                        step="0.01" min="0" max="1" placeholder="e.g. 0.70" />
                      <mat-hint>{{ 'SURVEY.rwgMinimumHint' | translate }}</mat-hint>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="grow">
                      <mat-label>{{ 'SURVEY.belowThresholdAction' | translate }}</mat-label>
                      <input matInput formControlName="aggregationBelowAction"
                        placeholder="e.g. flag_for_individual_analysis" />
                    </mat-form-field>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'SURVEY.belowThresholdMessage' | translate }}</mat-label>
                    <textarea matInput formControlName="aggregationBelowMessage" rows="2"
                      [placeholder]="'SURVEY.belowThresholdPlaceholder' | translate"></textarea>
                  </mat-form-field>
                </div>
              }

              <!-- ── Rater Pool (only when rater_type = multi_rater) ─── -->
              @if (form.get('raterType')?.value === 'multi_rater') {
                <div class="inset-section">
                  <div class="inset-label">{{ 'SURVEY.raterPool360' | translate }}</div>
                  <div class="form-row">
                    <mat-form-field appearance="outline" style="width:110px">
                      <mat-label>{{ 'SURVEY.poolMin' | translate }}</mat-label>
                      <input matInput type="number" formControlName="raterPoolMin" min="1" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" style="width:110px">
                      <mat-label>{{ 'SURVEY.poolMax' | translate }}</mat-label>
                      <input matInput type="number" formControlName="raterPoolMax" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="grow">
                      <mat-label>{{ 'SURVEY.roleTypes' | translate }}</mat-label>
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
                    <mat-icon>code</mat-icon> {{ 'SURVEY.advancedJsonPanel' | translate }}
                  </mat-panel-title>
                </mat-expansion-panel-header>

                <div class="adv-json-section">
                  <div class="json-label">
                    <span>{{ 'SURVEY.subscaleConfig' | translate }}</span>
                    <span class="json-hint">{{ 'SURVEY.subscaleConfigHint' | translate }}</span>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'SURVEY.subscaleConfigJsonLabel' | translate }}</mat-label>
                    <textarea matInput formControlName="subscaleConfigJson" rows="8"
                      class="mono"
                      placeholder='{&#10;  "integrating": { "items": ["q1","q2"], "item_count": 2, "description": "..." }&#10;}'></textarea>
                  </mat-form-field>

                  <div class="json-label" style="margin-top:8px">
                    <span>{{ 'SURVEY.benchmarks' | translate }}</span>
                    <span class="json-hint">{{ 'SURVEY.benchmarksHint' | translate }}</span>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'SURVEY.benchmarksJsonLabel' | translate }}</mat-label>
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
              {{ 'SURVEY.tabQuestions' | translate }} <span class="tab-count">{{ questionsArray.length }}</span>
            </ng-template>

            <div class="tab-content questions-tab">

              <div class="questions-header">
                <span class="qs-count">{{ questionsArray.length }} {{ (questionsArray.length !== 1 ? 'SURVEY.questionsPlural' : 'SURVEY.questionSingular') | translate }}</span>
                <button mat-stroked-button type="button" (click)="addQuestion()">
                  <mat-icon>add</mat-icon> {{ "SURVEY.addQuestion" | translate }}
                </button>
              </div>

              <div formArrayName="questions" class="questions-list">
                @for (q of questionsArray.controls; track q; let i = $index) {
                  <div [formGroupName]="i" class="question-row">

                    <div class="q-number">{{ i + 1 }}</div>

                    <div class="q-fields">

                      <!-- Question text (required on all types) -->
                      <mat-form-field appearance="outline" class="full-width">
                        <mat-label>{{ 'SURVEY.questionTextStem' | translate }}</mat-label>
                        <textarea matInput formControlName="text" rows="2"
                          [placeholder]="'SURVEY.questionTextPlaceholder' | translate"></textarea>
                        <mat-hint>{{ 'SURVEY.questionTextHint' | translate }}</mat-hint>
                      </mat-form-field>

                      <!-- Type + Category -->
                      <div class="q-meta-row">
                        <mat-form-field appearance="outline">
                          <mat-label>{{ 'COMMON.type' | translate }}</mat-label>
                          <mat-select formControlName="type">
                            <mat-option value="scale">{{ 'SURVEY.typeScaleLikert' | translate }}</mat-option>
                            <mat-option value="boolean">{{ 'SURVEY.typeYesNo' | translate }}</mat-option>
                            <mat-option value="text">{{ 'SURVEY.typeOpenText' | translate }}</mat-option>
                            <mat-option value="forced_choice">{{ 'SURVEY.typeForcedChoice' | translate }}</mat-option>
                          </mat-select>
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>{{ 'SURVEY.category' | translate }}</mat-label>
                          <input matInput formControlName="category"
                            placeholder="e.g. conflict_mode" />
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>{{ 'SURVEY.subscale' | translate }}</mat-label>
                          <input matInput formControlName="subscale"
                            placeholder="e.g. collaborating" />
                          <mat-hint>{{ 'SURVEY.scoringBucket' | translate }}</mat-hint>
                        </mat-form-field>
                      </div>

                      <!-- ── Forced-choice A/B ── -->
                      @if (q.get('type')?.value === 'forced_choice') {
                        <div class="fc-options">
                          <div class="fc-header">
                            <span class="fc-option-label">{{ 'SURVEY.forcedChoiceOptions' | translate }}</span>
                            <div class="fc-meta">
                              <mat-form-field appearance="outline" style="width:110px">
                                <mat-label>{{ 'SURVEY.pairId' | translate }}</mat-label>
                                <input matInput type="number" formControlName="pairId" />
                                <mat-hint>{{ 'SURVEY.pairIdHint' | translate }}</mat-hint>
                              </mat-form-field>
                              <mat-form-field appearance="outline" style="width:180px">
                                <mat-label>{{ 'SURVEY.scaleDescriptor' | translate }}</mat-label>
                                <input matInput formControlName="scaleDescriptor"
                                  placeholder="forced_choice_dyad" />
                              </mat-form-field>
                              <mat-form-field appearance="outline" class="grow">
                                <mat-label>{{ 'SURVEY.modesContrasted' | translate }}</mat-label>
                                <input matInput formControlName="modesContrasted"
                                  placeholder="e.g. competing, avoiding" />
                                <mat-hint>{{ 'SURVEY.modesContrastedHint' | translate }}</mat-hint>
                              </mat-form-field>
                            </div>
                          </div>

                          <div class="fc-row">
                            <span class="fc-badge">A</span>
                            <mat-form-field appearance="outline" class="fc-text">
                              <mat-label>{{ 'SURVEY.optionAStatement' | translate }}</mat-label>
                              <textarea matInput formControlName="optionAText" rows="2"></textarea>
                            </mat-form-field>
                            <mat-form-field appearance="outline" style="width:160px">
                              <mat-label>{{ 'SURVEY.toSubscale' | translate }}</mat-label>
                              <input matInput formControlName="optionASubscale"
                                placeholder="e.g. competing" />
                            </mat-form-field>
                          </div>
                          <div class="fc-row">
                            <span class="fc-badge">B</span>
                            <mat-form-field appearance="outline" class="fc-text">
                              <mat-label>{{ 'SURVEY.optionBStatement' | translate }}</mat-label>
                              <textarea matInput formControlName="optionBText" rows="2"></textarea>
                            </mat-form-field>
                            <mat-form-field appearance="outline" style="width:160px">
                              <mat-label>{{ 'SURVEY.toSubscale' | translate }}</mat-label>
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
                              <mat-icon>tune</mat-icon> {{ 'SURVEY.scoringAndScaleOptions' | translate }}
                            </mat-panel-title>
                          </mat-expansion-panel-header>

                          <div class="adv-q-fields">

                            @if (q.get('type')?.value === 'scale') {
                              <!-- Scale range -->
                              <div class="scale-range-block">
                                <div class="form-row">
                                  <mat-form-field appearance="outline" style="width:110px">
                                    <mat-label>{{ 'SURVEY.scaleMin' | translate }}</mat-label>
                                    <input matInput type="number" formControlName="scaleMin" />
                                  </mat-form-field>
                                  <mat-form-field appearance="outline" style="width:110px">
                                    <mat-label>{{ 'SURVEY.scaleMax' | translate }}</mat-label>
                                    <input matInput type="number" formControlName="scaleMax" />
                                  </mat-form-field>
                                  <button mat-stroked-button type="button"
                                          class="gen-labels-btn"
                                          [matTooltip]="'SURVEY.generateLabelsTooltip' | translate"
                                          (click)="generateLabelTemplate(i)">
                                    <mat-icon>auto_fix_high</mat-icon> {{ 'SURVEY.generateLabels' | translate }}
                                  </button>
                                </div>
                                <mat-form-field appearance="outline" class="full-width">
                                  <mat-label>{{ 'SURVEY.scaleLabelsJson' | translate }}</mat-label>
                                  <textarea matInput formControlName="scaleLabels" rows="4"
                                    class="mono"
                                    placeholder='{&#10;  "1": "Strongly Disagree",&#10;  "5": "Strongly Agree"&#10;}'></textarea>
                                  <mat-hint>{{ 'SURVEY.scaleLabelsHint' | translate }}</mat-hint>
                                </mat-form-field>
                              </div>

                              <!-- Reverse scoring -->
                              <div class="checkbox-row">
                                <mat-checkbox formControlName="reverseScored" color="primary">
                                  {{ 'SURVEY.reverseScoredItem' | translate }}
                                </mat-checkbox>
                              </div>
                              @if (q.get('reverseScored')?.value) {
                                <mat-form-field appearance="outline" class="full-width">
                                  <mat-label>{{ 'SURVEY.reverseScoreFormula' | translate }}</mat-label>
                                  <input matInput formControlName="reverseScoreFormula"
                                    placeholder="max_plus_one_minus_raw" />
                                  <mat-hint>{{ 'SURVEY.reverseScoreFormulaHint' | translate }}</mat-hint>
                                </mat-form-field>
                              }
                            }

                            <!-- Temporal anchor -->
                            <mat-form-field appearance="outline" class="full-width">
                              <mat-label>{{ 'SURVEY.referencePeriod' | translate }}</mat-label>
                              <input matInput formControlName="referencePeriod"
                                placeholder="e.g. past_month, past_quarter" />
                              <mat-hint>{{ 'SURVEY.referencePeriodHint' | translate }}</mat-hint>
                            </mat-form-field>

                            <!-- CDP fields -->
                            <div class="form-row">
                              <mat-form-field appearance="outline" class="half-width">
                                <mat-label>{{ 'SURVEY.behaviorTemperature' | translate }}</mat-label>
                                <mat-select formControlName="behaviorTemperature">
                                  <mat-option value="">—</mat-option>
                                  <mat-option value="hot">{{ 'SURVEY.tempHot' | translate }}</mat-option>
                                  <mat-option value="cool">{{ 'SURVEY.tempCool' | translate }}</mat-option>
                                </mat-select>
                              </mat-form-field>
                              <mat-form-field appearance="outline" class="half-width">
                                <mat-label>{{ 'SURVEY.behaviorCluster' | translate }}</mat-label>
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
                            [matTooltip]="'SURVEY.removeQuestion' | translate"
                            (click)="removeQuestion(i)"
                            [disabled]="questionsArray.length <= 1">
                      <mat-icon>close</mat-icon>
                    </button>

                  </div><!-- /question-row -->
                }
              </div>

              <button mat-stroked-button type="button" class="add-q-btn" (click)="addQuestion()">
                <mat-icon>add</mat-icon> {{ "SURVEY.addAnotherQuestion" | translate }}
              </button>

            </div>
          </mat-tab>

          <!-- ══════════════════ TAB 4: AI PROMPT ══════════════════ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">auto_awesome</mat-icon> {{ "SURVEY.tabAIPrompt" | translate }}
            </ng-template>

            <div class="tab-content">
              <p class="prompt-hint">{{ 'SURVEY.analysisPromptHint' | translate }}</p>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'SURVEY.analysisPromptLabel' | translate }}</mat-label>
                <textarea matInput formControlName="analysisPrompt"
                  rows="16"
                  style="font-family: monospace; font-size: 13px; line-height: 1.5"
                  [placeholder]="'SURVEY.analysisPromptPlaceholder' | translate"></textarea>
                <mat-hint>{{ 'SURVEY.analysisPromptDefault' | translate }}</mat-hint>
              </mat-form-field>
            </div>
          </mat-tab>

        </mat-tab-group>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">{{ "COMMON.cancel" | translate }}</button>
      <button mat-raised-button color="primary"
              (click)="save()" [disabled]="form.invalid || saving()">
        @if (saving()) {
          <mat-spinner diameter="18" />
        } @else {
          <mat-icon>{{ isEdit() ? 'save' : 'add_circle' }}</mat-icon>
          {{ isEdit() ? ("SURVEY.saveChanges" | translate) : ("SURVEY.createTemplate" | translate) }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex; align-items: center; gap: 8px; color: var(--artes-primary);
      mat-icon { color: var(--artes-accent); }
    }

    mat-dialog-content {
      min-width: 920px; max-width: 1080px;
      height: 72vh; max-height: 72vh;
      padding: 8px 0 0 !important;
      overflow: hidden;
      display: flex; flex-direction: column;
    }

    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 14px;
    }

    /* Tabs — fill the dialog content height so all tabs are the same size */
    .main-tabs {
      flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0;
      ::ng-deep .mat-mdc-tab-header { flex-shrink: 0; margin: 0 -4px; }
      ::ng-deep .mat-mdc-tab-body-wrapper { flex: 1; overflow: hidden; min-height: 0; }
      ::ng-deep .mat-mdc-tab-body { height: 100%; }
      ::ng-deep .mat-mdc-tab-body-content { height: 100%; overflow-y: auto; }
    }
    .tab-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; vertical-align: middle; }
    .tab-count {
      margin-left: 6px; background: var(--artes-bg); color: var(--artes-accent);
      padding: 1px 7px; border-radius: 999px; font-size: 11px;
    }

    /* Tab content — each tab scrolls internally */
    .tab-content {
      padding: 20px 8px 24px;
      display: flex; flex-direction: column; gap: 10px;
      box-sizing: border-box;
    }

    .prompt-hint {
      font-size: 13px; color: #5a6a7e; line-height: 1.5;
      margin: 0 0 8px; padding: 10px 14px;
      background: rgba(124,58,237,0.06); border-radius: 8px;
      border-left: 3px solid #7c3aed;
    }

    /* Layout helpers */
    .full-width { width: 100%; }
    .half-width { flex: 1; min-width: 0; }
    .grow { flex: 1; min-width: 0; }
    .form-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
    .form-row-with-hint { margin-bottom: 35px; }

    /* Toggle */
    .toggle-row {
      display: flex; align-items: center; gap: 12px; padding: 6px 0;
    }
    .toggle-hint { font-size: 12px; color: #9aa5b4; }

    .translate-row {
      display: flex; align-items: center; gap: 12px;
      padding: 2px 0; flex-shrink: 0;
      button {
        display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
        mat-spinner { display: inline-block; }
      }
    }
    .translate-lang-select { width: 160px; flex-shrink: 0; }
    .lang-nav {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 2px 0;
    }
    .lang-nav-label { font-size: 12px; color: #5a6a7e; font-weight: 600; }
    .lang-nav-btn { font-size: 13px; min-width: unset; padding: 0 12px; }

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
      font-size: 12px; font-weight: 600; color: var(--artes-accent); margin-bottom: 2px;
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
      background: var(--artes-primary); color: white;
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
      letter-spacing: 0.5px; color: var(--artes-accent);
    }
    .fc-meta { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; }
    .fc-row { display: flex; align-items: center; gap: 8px; }
    .fc-badge {
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--artes-primary); color: white;
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
      height: 56px; align-self: flex-start; color: var(--artes-accent);
      border-color: var(--artes-accent); font-size: 12px;
    }

    .remove-btn { color: #9aa5b4; flex-shrink: 0; margin-top: 6px; }
    .add-q-btn { width: 100%; margin-top: 4px; color: var(--artes-accent); border-color: var(--artes-accent); }
  `],
})
export class SurveyTemplateDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<SurveyTemplateDialogComponent>);
  private existingData = inject<SurveyTemplate | null>(MAT_DIALOG_DATA, { optional: true });
  private translate = inject(TranslateService);

  form!: FormGroup;
  saving = signal(false);
  translating = signal(false);
  translateTargetLang = '';
  error = signal('');

  siblingTranslations = signal<{ _id: string; title: string; language: string }[]>([]);
  availableTranslateLangs = signal<{ value: string; label: string }[]>([]);

  private readonly ALL_LANGS = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
    { value: 'es', label: 'Español' },
    { value: 'sk', label: 'Slovenčina' },
  ];

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
      language:          [d?.language ?? 'en'],
      minResponsesForAnalysis: [
        d?.minResponsesForAnalysis
          ?? (d?.intakeType && d.intakeType !== 'survey' ? 1 : 5),
        [Validators.required, Validators.min(1)],
      ],

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

      // AI Analysis Prompt
      analysisPrompt: [d?.analysisPrompt ?? ''],

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

    if (d?._id) {
      this.loadTranslations(d._id, d.language || 'en');
    }
  }

  private loadTranslations(templateId: string, currentLang: string): void {
    this.api.get<{ _id: string; title: string; language: string }[]>(
      `/surveys/templates/${templateId}/translations`
    ).subscribe({
      next: (siblings) => {
        this.siblingTranslations.set(siblings);
        const takenLangs = new Set([currentLang, ...siblings.map((s) => s.language)]);
        this.availableTranslateLangs.set(
          this.ALL_LANGS.filter((l) => !takenLangs.has(l.value))
        );
      },
      error: () => {},
    });
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

  /** Reset the min-responses default when the intake type changes, but only
   *  if the field is still at a previous default (don't clobber custom values). */
  onIntakeTypeChange(newType: 'survey' | 'interview' | 'assessment'): void {
    const ctrl = this.form.get('minResponsesForAnalysis');
    if (!ctrl) return;
    const current = Number(ctrl.value);
    if (current === 1 || current === 5) {
      ctrl.setValue(newType === 'survey' ? 5 : 1);
    }
  }

  langLabel(code: string): string {
    return this.ALL_LANGS.find((l) => l.value === code)?.label || code;
  }

  openTranslation(templateId: string): void {
    this.api.get<SurveyTemplate>(`/surveys/templates/${templateId}`).subscribe({
      next: (template) => {
        this.dialogRef.close({ openTemplate: template });
      },
    });
  }

  translateIntake(): void {
    if (!this.translateTargetLang || !this.existingData) return;
    this.translating.set(true);
    this.error.set('');
    this.api.post<SurveyTemplate>(`/surveys/templates/${this.existingData._id}/translate`, {
      targetLanguage: this.translateTargetLang,
    }).subscribe({
      next: () => {
        this.translating.set(false);
        this.dialogRef.close('translated');
      },
      error: (err) => {
        this.translating.set(false);
        this.error.set(err.error?.error || this.translate.instant('SURVEY.translateFailed'));
      },
    });
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
      language:   v.language || 'en',
      minResponsesForAnalysis: Number(v.minResponsesForAnalysis) || 1,
      questions,
    };

    if (v.instrumentId)      payload['instrumentId']      = v.instrumentId;
    if (v.instrumentVersion) payload['instrumentVersion'] = v.instrumentVersion;
    if (v.description)       payload['description']       = v.description;
    if (v.instructions)      payload['instructions']      = v.instructions;
    if (v.analysisPrompt)    payload['analysisPrompt']    = v.analysisPrompt;
    else                     payload['analysisPrompt']    = '';  // allow clearing
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
        this.error.set(err.error?.error || this.translate.instant('SURVEY.saveFailed'));
        this.saving.set(false);
      },
    });
  }
}
