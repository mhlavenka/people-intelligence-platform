import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { SurveyResponsesDialogComponent } from '../../survey/survey-responses-dialog/survey-responses-dialog.component';
import { SubAnalysisDialogComponent, SubAnalysisDialogData } from '../sub-analysis-dialog/sub-analysis-dialog.component';
import { MiniGaugeComponent } from '../../../shared/mini-gauge/mini-gauge.component';
import { RiskBadgeComponent } from '../../../shared/risk-badge/risk-badge.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

type ScriptSection =
  | { key: string; label: string; type: 'string'; value: string }
  | { key: string; label: string; type: 'list'; items: string[] }
  | { key: string; label: string; type: 'topics'; topics: { topic: string; points: string[] }[] };

interface CoachOption {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ConflictAnalysis {
  _id: string;
  intakeTemplateId?: { _id: string; title: string } | null;
  name: string;
  departmentId?: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  conflictTypes: string[];
  aiNarrative: string;
  managerScript: string;
  recommendedActions?: RecommendedActions;
  completedActions?: Record<string, number[]>;
  escalationRequested: boolean;
  escalatedToCoachId?: { _id: string; firstName: string; lastName: string } | string;
  escalationMessage?: string;
  professionalReview?: {
    status: 'pending' | 'in_progress' | 'completed';
    notes?: string;
    recommendations?: string;
    reviewedAt?: string;
  };
  generatedIntakeIds?: Record<string, string>;
  focusConflictType?: string;
  parentId?: string;
  createdAt: string;

  // Phase 1 divergence metrics (all optional — legacy analyses render fine)
  responseQuality?: {
    totalSubmitted: number;
    acceptedCount: number;
    droppedCount: number;
    droppedReasons: Record<string, number | undefined>;
  };
  itemMetrics?: ItemMetric[];
  dimensionMetrics?: DimensionMetric[];
  teamAlignmentScore?: number;
}

interface ItemMetric {
  questionId: string;
  text?: string;
  dimension?: string;
  mean: number;
  median: number;
  sd: number;
  iqr: number;
  bimodalityCoef: number;
  entropy: number;
  rwg: number;
  outlierCount: number;
  scaleMin?: number;
  scaleMax?: number;
}

interface DimensionMetric {
  dimension: string;
  itemCount: number;
  mean: number;
  rwg: number;
  disagreementScore: number;
  mostDivergentItemIds: string[];
}

interface ActionItem {
  title: string;
  description: string;
  owner: string;
  priority: 'high' | 'medium' | 'low';
  timeframe?: string;
}

interface RecommendedActions {
  immediateActions?: ActionItem[];
  shortTermActions?: ActionItem[];
  longTermActions?: ActionItem[];
  preventiveMeasures?: string[];
}

@Component({
  selector: 'app-conflict-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatTabsModule,
    MatChipsModule, MatDividerModule, MatProgressSpinnerModule,
    MatTooltipModule, MatSnackBarModule, MatDialogModule, MatExpansionModule, MatCheckboxModule,
    MatFormFieldModule, MatInputModule, MatListModule, MatMenuModule,
    MiniGaugeComponent, RiskBadgeComponent,
    TranslateModule,
  ],
  template: `
    @if (loading()) {
      <div class="loading"><mat-spinner diameter="40" /></div>
    } @else if (!analysis()) {
      <div class="not-found">
        <mat-icon>error_outline</mat-icon>
        <h2>{{ "CONFLICT.analysisNotFound" | translate }}</h2>
        <a mat-stroked-button routerLink="/conflict/analysis">
          <mat-icon>arrow_back</mat-icon> {{ 'CONFLICT.backToAnalyses' | translate }}
        </a>
      </div>
    } @else {
      <div class="detail-page">
        <!-- Header -->
        <div class="page-header">
          <a mat-icon-button routerLink="/conflict/analysis" [matTooltip]="'CONFLICT.backToAnalyses' | translate">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <div class="header-content">
            <h1>{{ analysis()!.name }}</h1>
            <div class="header-meta">
              <span class="meta-chip">
                <mat-icon>event</mat-icon>
                {{ analysis()!.createdAt | date:'MMM d, y' }}
              </span>
              <span class="meta-chip">
                <mat-icon>corporate_fare</mat-icon>
                {{ analysis()!.departmentId || 'All Departments' }}
              </span>
              @if (analysis()!.intakeTemplateId; as tpl) {
                <a class="meta-chip meta-link" (click)="viewIntakeResponses(tpl._id)">
                  <mat-icon>assignment</mat-icon>
                  {{ tpl.title }}
                  <mat-icon class="link-arrow">open_in_new</mat-icon>
                </a>
              }
            </div>
          </div>
          <div class="header-right">
            <div class="score-block" [class]="analysis()!.riskLevel">
              <div class="score-num">{{ analysis()!.riskScore }}</div>
              <div class="score-label">{{ "CONFLICT.riskScore" | translate }}</div>
            </div>
            <app-risk-badge [level]="analysis()!.riskLevel" [label]="(analysis()!.riskLevel | titlecase) + ' Risk'" />
          </div>
        </div>

        <!-- Conflict type chips -->
        @if (analysis()!.conflictTypes.length) {
          <div class="chips-row">
            @for (t of analysis()!.conflictTypes; track t) {
              <span class="chip">{{ t }}</span>
            }
          </div>
        }

        <!-- Tabs -->
        <mat-tab-group animationDuration="200ms" class="detail-tabs">
          <!-- Tab 1: AI Analysis -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>auto_awesome</mat-icon>
              <span>{{ "CONFLICT.aiAnalysis" | translate }}</span>
            </ng-template>
            <div class="tab-body ai-analysis-tab">
              <!-- ── HERO: overall risk snapshot ─────────────────────── -->
              <div class="ai-hero" [class]="'risk-' + analysis()!.riskLevel">
                <div class="ai-hero-glow"></div>

                <div class="ai-hero-gauge">
                  <svg class="big-ring" viewBox="0 0 180 180">
                    <defs>
                      <linearGradient [attr.id]="'gradient-' + analysis()!._id" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" [attr.stop-color]="riskColor(analysis()!.riskLevel)" stop-opacity="0.7"/>
                        <stop offset="100%" [attr.stop-color]="riskColor(analysis()!.riskLevel)"/>
                      </linearGradient>
                    </defs>
                    <circle class="ring-bg" cx="90" cy="90" r="78" fill="none" stroke-width="14"/>
                    <circle class="ring-val" cx="90" cy="90" r="78" fill="none" stroke-width="14"
                            [attr.stroke]="'url(#gradient-' + analysis()!._id + ')'"
                            [style.stroke-dasharray]="490"
                            [style.stroke-dashoffset]="490 - (analysis()!.riskScore / 100) * 490"
                            stroke-linecap="round"/>
                  </svg>
                  <div class="big-ring-inner">
                    <div class="big-score">{{ analysis()!.riskScore }}</div>
                    <div class="big-score-of">/ 100</div>
                  </div>
                </div>

                <div class="ai-hero-center">
                  <div class="ai-hero-eyebrow">{{ "CONFLICT.overallRiskAssessment" | translate }}</div>
                  <div class="ai-hero-risk" [class]="analysis()!.riskLevel">
                    <mat-icon>{{ riskIcon(analysis()!.riskLevel) }}</mat-icon>
                    <span>{{ (analysis()!.riskLevel | titlecase) + ' Risk' }}</span>
                  </div>
                  @if (firstSentence(); as lead) {
                    <div class="ai-hero-lead">{{ lead }}</div>
                  }
                </div>

                <div class="ai-hero-stats">
                  <div class="ai-stat-card">
                    <div class="ai-stat-icon"><mat-icon>scatter_plot</mat-icon></div>
                    <div class="ai-stat-num">{{ analysis()!.conflictTypes.length }}</div>
                    <div class="ai-stat-lbl">{{ "CONFLICT.conflictTypesDetected" | translate }}</div>
                  </div>
                  <div class="ai-stat-card">
                    <div class="ai-stat-icon"><mat-icon>fact_check</mat-icon></div>
                    <div class="ai-stat-num">
                      <span class="stat-big">{{ completedSubCount() }}</span>
                      <span class="stat-of">/ {{ analysis()!.conflictTypes.length }}</span>
                    </div>
                    <div class="ai-stat-lbl">{{ "CONFLICT.deepDivesCompleted" | translate }}</div>
                  </div>
                </div>
              </div>

              <!-- ── AI NARRATIVE CARD ────────────────────────────────── -->
              <div class="ai-narrative-card">
                <div class="ai-narrative-head">
                  <div class="ai-avatar">
                    <mat-icon>auto_awesome</mat-icon>
                    <span class="pulse-ring"></span>
                  </div>
                  <div class="ai-head-text">
                    <div class="ai-head-title">{{ "CONFLICT.aiAssessment" | translate }}</div>
                    <div class="ai-head-sub">
                      <mat-icon class="tiny">event</mat-icon>
                      {{ analysis()!.createdAt | date:'MMM d, y · h:mm a' }}
                    </div>
                  </div>
                </div>

                <div class="ai-narrative-body">
                  @if (firstParagraph(); as lead) {
                    <blockquote class="ai-pullquote">
                      <mat-icon class="quote-mark">format_quote</mat-icon>
                      {{ lead }}
                    </blockquote>
                  }
                  @for (para of remainingParagraphs(); track $index) {
                    <p class="ai-para" [style.animation-delay.ms]="80 + $index * 60">{{ para }}</p>
                  }
                </div>
              </div>

              <!-- ── RISK DISTRIBUTION BAR ────────────────────────────── -->
              @if (analysis()!.conflictTypes.length >= 2 && completedSubCount() > 0) {
                <div class="risk-dist-card">
                  <div class="risk-dist-head">
                    <h4><mat-icon>equalizer</mat-icon> {{ "CONFLICT.riskDistribution" | translate }}</h4>
                    <span class="risk-dist-hint">{{ completedSubCount() }}/{{ analysis()!.conflictTypes.length }}</span>
                  </div>
                  <div class="dist-bar">
                    @for (ct of analyzedTypes(); track ct) {
                      @if (subAnalysisFor(ct); as sub) {
                        <div class="dist-segment"
                             [style.width.%]="distWeight(ct)"
                             [style.background]="riskColor(sub.riskLevel)"
                             [style.animation-delay.ms]="$index * 90"
                             [matTooltip]="ct + ' — ' + sub.riskScore + '/100'">
                        </div>
                      }
                    }
                  </div>
                  <div class="dist-legend">
                    @for (ct of analyzedTypes(); track ct) {
                      @if (subAnalysisFor(ct); as sub) {
                        <span class="legend-item">
                          <span class="legend-dot" [style.background]="riskColor(sub.riskLevel)"></span>
                          <span class="legend-label">{{ ct }}</span>
                          <span class="legend-val">{{ sub.riskScore }}</span>
                        </span>
                      }
                    }
                  </div>
                </div>
              }

              <!-- ── CONFLICT TYPE CARDS GRID ────────────────────────── -->
              @if (analysis()!.conflictTypes.length) {
                <div class="types-section">
                  <div class="types-head">
                    <h3><mat-icon>manage_search</mat-icon> {{ "CONFLICT.drillDown" | translate }}</h3>
                    <p class="drill-hint">{{ "CONFLICT.drillHint" | translate }}</p>
                  </div>

                  <div class="types-grid">
                    @for (ct of analysis()!.conflictTypes; track ct) {
                      <div class="type-card"
                           [class]="subAnalysisFor(ct)?.riskLevel || 'pending'"
                           [class.analyzed]="!!subAnalysisFor(ct)"
                           [style.animation-delay.ms]="$index * 70">

                        <div class="type-topline">
                          <div class="type-icon-wrap" [class]="subAnalysisFor(ct)?.riskLevel || 'pending'">
                            <mat-icon>{{ typeIcon(ct) }}</mat-icon>
                          </div>
                          @if (subAnalysisFor(ct); as sub) {
                            <span class="risk-pill" [class]="sub.riskLevel">{{ sub.riskLevel | titlecase }}</span>
                          } @else {
                            <span class="risk-pill pending">{{ "CONFLICT.awaitingAnalysis" | translate }}</span>
                          }
                        </div>

                        <div class="type-title">{{ ct }}</div>

                        @if (subAnalysisFor(ct); as sub) {
                          <div class="type-ring-wrap">
                            <svg class="type-ring" viewBox="0 0 96 96">
                              <circle cx="48" cy="48" r="40" fill="none" stroke-width="8" class="tr-bg"/>
                              <circle cx="48" cy="48" r="40" fill="none" stroke-width="8"
                                      [style.stroke]="riskColor(sub.riskLevel)"
                                      [style.stroke-dasharray]="251.3"
                                      [style.stroke-dashoffset]="251.3 - (sub.riskScore / 100) * 251.3"
                                      stroke-linecap="round"
                                      class="tr-val"/>
                            </svg>
                            <div class="type-ring-inner">
                              <div class="type-ring-num" [style.color]="riskColor(sub.riskLevel)">{{ sub.riskScore }}</div>
                              <div class="type-ring-lbl">{{ "CONFLICT.riskScore" | translate }}</div>
                            </div>
                          </div>

                          <button mat-stroked-button class="type-toggle" (click)="openSubAnalysis(ct)">
                            <mat-icon>open_in_full</mat-icon>
                            {{ "CONFLICT.viewAnalysis" | translate }}
                          </button>
                        } @else {
                          <div class="type-empty">
                            <div class="type-empty-icon"><mat-icon>hourglass_empty</mat-icon></div>
                            <div class="type-empty-lbl">{{ "CONFLICT.awaitingAnalysis" | translate }}</div>
                          </div>
                          <button mat-flat-button color="primary" class="type-run-btn"
                                  [disabled]="runningFor() === ct"
                                  (click)="runSubAnalysis(ct)">
                            @if (runningFor() === ct) {
                              <mat-spinner diameter="16" />
                              <span>{{ "CONFLICT.analyzing" | translate }}</span>
                            } @else {
                              <mat-icon>auto_awesome</mat-icon>
                              <span>{{ "CONFLICT.runDeepDive" | translate }}</span>
                            }
                          </button>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </mat-tab>

          <!-- Tab 2: Manager Conversation Guide -->
          <mat-tab [disabled]="!analysis()!.managerScript">
            <ng-template mat-tab-label>
              <mat-icon>record_voice_over</mat-icon>
              <span>{{ "CONFLICT.managerGuide" | translate }}</span>
            </ng-template>
            <div class="tab-body">
              @if (analysis()!.managerScript) {
                <div class="section">
                  @if (scriptSections().length > 0) {
                    <div class="script-sections">
                      @for (section of scriptSections(); track section.key) {
                        <div class="script-section">
                          <div class="script-section-title">{{ section.label }}</div>
                          @if (section.type === 'string') { <p class="script-para">{{ section.value }}</p> }
                          @if (section.type === 'list') {
                            <ul class="script-list">
                              @for (item of section.items; track $index) { <li>{{ item }}</li> }
                            </ul>
                          }
                          @if (section.type === 'topics') {
                            <table class="topics-table">
                              <thead><tr><th>{{ "CONFLICT.topic" | translate }}</th><th>{{ "CONFLICT.talkingPoints" | translate }}</th></tr></thead>
                              <tbody>
                                @for (row of section.topics; track $index) {
                                  <tr>
                                    <td class="topic-name">{{ row.topic }}</td>
                                    <td><ul class="script-list tight">@for (pt of row.points; track $index) { <li>{{ pt }}</li> }</ul></td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          }
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="script-box"><pre class="script-text">{{ analysis()!.managerScript }}</pre></div>
                  }
                </div>
              } @else {
                <div class="placeholder-state">
                  <mat-icon>record_voice_over</mat-icon>
                  <h3>{{ "CONFLICT.managerGuide" | translate }}</h3>
                  <p>No manager conversation guide available for this analysis yet.</p>
                </div>
              }
            </div>
          </mat-tab>

          <!-- Tab 3: AI Recommended Actions -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>lightbulb</mat-icon>
              <span>{{ "CONFLICT.aiRecommendedActions" | translate }}</span>
            </ng-template>
            <div class="tab-body">
              @if (!recommendedActions() && !generatingActions()) {
                <div class="generate-state">
                  <mat-icon>lightbulb</mat-icon>
                  <h3>{{ "CONFLICT.aiRecommendedActions" | translate }}</h3>
                  <p>
                    Generate concrete, prioritized action items based on this analysis.
                    Actions are grouped by timeframe — immediate, short-term, and long-term.
                  </p>
                  <button mat-flat-button color="primary" (click)="generateActions()">
                    <mat-icon>auto_awesome</mat-icon> {{ "CONFLICT.generateRecommendedActions" | translate }}
                  </button>
                </div>
              }

              @if (generatingActions()) {
                <div class="generate-state">
                  <mat-spinner diameter="36" />
                  <p>Generating recommended actions…</p>
                  <span class="gen-hint">This usually takes 10–20 seconds.</span>
                </div>
              }

              @if (recommendedActions(); as ra) {
                <mat-accordion class="actions-accordion">
                  @if (ra.immediateActions?.length) {
                    <mat-expansion-panel [expanded]="expandedPanel() === 'immediate'" (opened)="expandedPanel.set('immediate')">
                      <mat-expansion-panel-header>
                        <mat-panel-title>
                          <mat-icon>priority_high</mat-icon>
                          Immediate Actions
                          <span class="timeframe-tag urgent">This week</span>
                          <span class="completion-count">{{ completedCount('immediate', ra.immediateActions!) }}/{{ ra.immediateActions!.length }}</span>
                        </mat-panel-title>
                      </mat-expansion-panel-header>
                      <div class="action-cards">
                        @for (a of ra.immediateActions; track $index) {
                          <div class="action-card" [class]="'priority-' + a.priority" [class.completed]="isCompleted('immediate', $index)">
                            @if (generatingIntakeFor() === $index) {
                              <div class="intake-overlay">
                                <mat-spinner diameter="28" />
                                <span>{{ 'CONFLICT.generatingAssessment' | translate }}</span>
                              </div>
                            }
                            @if (intakeGeneratedFor() === $index) {
                              <div class="intake-overlay done">
                                <mat-icon>check_circle</mat-icon>
                                <span>{{ 'CONFLICT.assessmentReady' | translate }}</span>
                              </div>
                            }
                            <div class="action-header">
                              <mat-checkbox [checked]="isCompleted('immediate', $index)" (change)="toggleCompleted('immediate', $index)" />
                              <span class="action-title">{{ a.title }}</span>
                              <span class="priority-badge" [class]="a.priority">{{ a.priority }}</span>
                            </div>
                            <p class="action-desc">{{ a.description }}</p>
                            <div class="action-footer">
                              <span class="action-owner"><mat-icon>person</mat-icon> {{ a.owner }}</span>
                              @if (hasGeneratedIntake($index)) {
                                <button mat-stroked-button class="gen-intake-btn done"
                                        (click)="openGeneratedIntake($index)"
                                        [matTooltip]="'CONFLICT.viewGeneratedAssessment' | translate">
                                  <mat-icon>open_in_new</mat-icon> {{ 'CONFLICT.viewAssessment' | translate }}
                                </button>
                              } @else {
                                <button mat-stroked-button class="gen-intake-btn"
                                        (click)="generateActionIntake(a, $index)"
                                        [disabled]="generatingIntakeFor() !== null"
                                        [matTooltip]="'CONFLICT.generateAssessmentTooltip' | translate">
                                  <mat-icon>assignment</mat-icon> {{ 'CONFLICT.generateAssessment' | translate }}
                                </button>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    </mat-expansion-panel>
                  }

                  @if (ra.shortTermActions?.length) {
                    <mat-expansion-panel [expanded]="expandedPanel() === 'short'" (opened)="expandedPanel.set('short')">
                      <mat-expansion-panel-header>
                        <mat-panel-title>
                          <mat-icon>schedule</mat-icon>
                          Short-Term Actions
                          <span class="timeframe-tag">2–4 weeks</span>
                          <span class="completion-count">{{ completedCount('short', ra.shortTermActions!) }}/{{ ra.shortTermActions!.length }}</span>
                        </mat-panel-title>
                      </mat-expansion-panel-header>
                      <div class="action-cards">
                        @for (a of ra.shortTermActions; track $index) {
                          <div class="action-card" [class]="'priority-' + a.priority" [class.completed]="isCompleted('short', $index)">
                            <div class="action-header">
                              <mat-checkbox [checked]="isCompleted('short', $index)" (change)="toggleCompleted('short', $index)" />
                              <span class="action-title">{{ a.title }}</span>
                              <span class="priority-badge" [class]="a.priority">{{ a.priority }}</span>
                            </div>
                            <p class="action-desc">{{ a.description }}</p>
                            <div class="action-footer">
                              <span class="action-owner"><mat-icon>person</mat-icon> {{ a.owner }}</span>
                              @if (a.timeframe) { <span class="action-timeframe"><mat-icon>event</mat-icon> {{ a.timeframe }}</span> }
                            </div>
                          </div>
                        }
                      </div>
                    </mat-expansion-panel>
                  }

                  @if (ra.longTermActions?.length) {
                    <mat-expansion-panel [expanded]="expandedPanel() === 'long'" (opened)="expandedPanel.set('long')">
                      <mat-expansion-panel-header>
                        <mat-panel-title>
                          <mat-icon>trending_up</mat-icon>
                          Long-Term Actions
                          <span class="timeframe-tag">1–3 months</span>
                          <span class="completion-count">{{ completedCount('long', ra.longTermActions!) }}/{{ ra.longTermActions!.length }}</span>
                        </mat-panel-title>
                      </mat-expansion-panel-header>
                      <div class="action-cards">
                        @for (a of ra.longTermActions; track $index) {
                          <div class="action-card" [class]="'priority-' + a.priority" [class.completed]="isCompleted('long', $index)">
                            <div class="action-header">
                              <mat-checkbox [checked]="isCompleted('long', $index)" (change)="toggleCompleted('long', $index)" />
                              <span class="action-title">{{ a.title }}</span>
                              <span class="priority-badge" [class]="a.priority">{{ a.priority }}</span>
                            </div>
                            <p class="action-desc">{{ a.description }}</p>
                            <div class="action-footer">
                              <span class="action-owner"><mat-icon>person</mat-icon> {{ a.owner }}</span>
                              @if (a.timeframe) { <span class="action-timeframe"><mat-icon>event</mat-icon> {{ a.timeframe }}</span> }
                            </div>
                          </div>
                        }
                      </div>
                    </mat-expansion-panel>
                  }
                </mat-accordion>

                @if (ra.preventiveMeasures?.length) {
                  <div class="actions-section preventive-section">
                    <h3><mat-icon>shield</mat-icon> Preventive Measures</h3>
                    <ul class="preventive-list">
                      @for (m of ra.preventiveMeasures; track $index) {
                        <li>{{ m }}</li>
                      }
                    </ul>
                  </div>
                }

                <div class="regen-row">
                  <button mat-stroked-button (click)="generateActions()">
                    <mat-icon>refresh</mat-icon> {{ 'CONFLICT.regenerate' | translate }}
                  </button>
                  @if (!analysis()!.escalationRequested) {
                    <button mat-flat-button color="warn" [matMenuTriggerFor]="coachMenu" (click)="loadCoaches()">
                      <mat-icon>escalator_warning</mat-icon> {{ 'CONFLICT.escalateToProfessional' | translate }}
                    </button>
                    <mat-menu #coachMenu="matMenu" class="coach-select-menu">
                      @if (loadingCoaches()) {
                        <div class="menu-loading"><mat-spinner diameter="24" /></div>
                      } @else if (coaches().length === 0) {
                        <div class="menu-empty">{{ 'CONFLICT.noCoachesAvailable' | translate }}</div>
                      } @else {
                        @for (c of coaches(); track c._id) {
                          <button mat-menu-item (click)="escalateToCoach(c)">
                            <mat-icon>person</mat-icon>
                            <span>{{ c.firstName }} {{ c.lastName }}</span>
                          </button>
                        }
                      }
                    </mat-menu>
                  } @else {
                    <span class="escalation-chip">
                      <mat-icon>check_circle</mat-icon> {{ 'CONFLICT.escalatedToProfessional' | translate }}
                    </span>
                  }
                </div>
              }
            </div>
          </mat-tab>

          <!-- Tab 3.5: Divergence Signals (only when metrics are present) -->
          @if (analysis()!.itemMetrics?.length) {
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon>analytics</mat-icon>
                <span>{{ 'CONFLICT.divergenceTab' | translate }}</span>
              </ng-template>
              <div class="tab-body">
                <!-- Response-quality card -->
                @if (analysis()!.responseQuality; as q) {
                  <div class="div-quality">
                    <mat-icon>verified_user</mat-icon>
                    <span [innerHTML]="'CONFLICT.responseQualitySummary' | translate:{
                      accepted: q.acceptedCount, total: q.totalSubmitted,
                      dropped: q.droppedCount
                    }"></span>
                    <mat-icon class="div-info"
                              [matTooltip]="'CONFLICT.responseQualityTooltip' | translate">info_outline</mat-icon>
                  </div>
                }

                <!-- Team alignment meter -->
                @if (analysis()!.teamAlignmentScore !== undefined) {
                  <div class="div-card div-alignment-card">
                    <div class="div-card-head">
                      <h3>{{ 'CONFLICT.teamAlignment' | translate }}</h3>
                      <span class="div-band" [class]="alignmentBand(analysis()!.teamAlignmentScore!)">
                        {{ ('CONFLICT.alignmentBand_' + alignmentBand(analysis()!.teamAlignmentScore!)) | translate }}
                      </span>
                    </div>
                    <div class="div-meter">
                      <div class="div-meter-bar">
                        <div class="div-meter-fill" [style.width.%]="analysis()!.teamAlignmentScore"></div>
                      </div>
                      <span class="div-meter-num">{{ analysis()!.teamAlignmentScore }}/100</span>
                    </div>
                  </div>
                }

                <!-- Dimensional roll-up -->
                @if (analysis()!.dimensionMetrics?.length) {
                  <div class="div-card">
                    <h3>{{ 'CONFLICT.dimensionalDivergence' | translate }}</h3>
                    <table class="div-table">
                      <thead>
                        <tr>
                          <th>{{ 'CONFLICT.dimColDimension' | translate }}</th>
                          <th class="num">{{ 'CONFLICT.dimColItems' | translate }}</th>
                          <th class="num">{{ 'CONFLICT.dimColMean' | translate }}</th>
                          <th class="num">{{ 'CONFLICT.dimColRwg' | translate }}</th>
                          <th class="num">{{ 'CONFLICT.dimColDisagreement' | translate }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (d of analysis()!.dimensionMetrics; track d.dimension) {
                          <tr>
                            <td>{{ d.dimension }}</td>
                            <td class="num">{{ d.itemCount }}</td>
                            <td class="num">{{ d.mean }}</td>
                            <td class="num" [class.muted]="d.rwg >= 0.7">{{ d.rwg }}</td>
                            <td class="num">
                              <span class="div-disagreement-pill" [class]="alignmentBand(100 - d.disagreementScore)">
                                {{ d.disagreementScore }}
                              </span>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }

                <!-- Per-item heat map (top divergent + flagged splits) -->
                <div class="div-card">
                  <h3>{{ 'CONFLICT.itemDivergence' | translate }}</h3>
                  <div class="div-items">
                    @for (m of sortedItemMetrics(); track m.questionId) {
                      <div class="div-item" [class.split]="m.bimodalityCoef > 0.555">
                        <div class="div-item-head">
                          <span class="div-item-text">{{ m.text || m.questionId }}</span>
                          @if (m.bimodalityCoef > 0.555) {
                            <span class="div-split-badge" [matTooltip]="'CONFLICT.itemSplitTooltip' | translate">
                              <mat-icon>call_split</mat-icon> {{ 'CONFLICT.itemSplit' | translate }}
                            </span>
                          }
                        </div>
                        <div class="div-item-stats">
                          <span><strong>μ</strong> {{ m.mean }}</span>
                          <span><strong>σ</strong> {{ m.sd }}</span>
                          <span><strong>r<sub>wg</sub></strong> {{ m.rwg }}</span>
                          @if (m.dimension) { <span class="div-item-dim">{{ m.dimension }}</span> }
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <!-- Disclaimer (always present in this tab) -->
                <div class="div-disclaimer">
                  <mat-icon>info</mat-icon>
                  <span>{{ 'CONFLICT.divergenceDisclaimer' | translate }}</span>
                </div>
              </div>
            </mat-tab>
          }

          <!-- Tab 4: Professional Review -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>rate_review</mat-icon>
              <span>{{ 'CONFLICT.professionalReview' | translate }}</span>
              @if (analysis()!.professionalReview) {
                <span class="review-status-dot" [class]="analysis()!.professionalReview!.status"></span>
              }
            </ng-template>
            <div class="tab-body">
              @if (!analysis()!.escalationRequested) {
                <div class="placeholder-state">
                  <mat-icon>rate_review</mat-icon>
                  <h3>{{ 'CONFLICT.professionalReview' | translate }}</h3>
                  <p>{{ 'CONFLICT.professionalReviewEmpty' | translate }}</p>
                </div>
              } @else {
                <div class="review-card">
                  <div class="review-header">
                    <mat-icon>person</mat-icon>
                    <span>{{ 'CONFLICT.assignedTo' | translate }}: {{ coachName() }}</span>
                    <span class="review-status-badge" [class]="analysis()!.professionalReview?.status || 'pending'">
                      {{ analysis()!.professionalReview?.status || 'pending' }}
                    </span>
                  </div>

                  @if (analysis()!.escalationMessage) {
                    <div class="review-message">
                      <mat-icon>message</mat-icon>
                      <p>{{ analysis()!.escalationMessage }}</p>
                    </div>
                  }

                  @if (isAssignedCoach()) {
                    <!-- Coach can edit -->
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>{{ 'CONFLICT.reviewNotes' | translate }}</mat-label>
                      <textarea matInput [(ngModel)]="reviewNotes" rows="4"
                                [placeholder]="'CONFLICT.reviewNotesPlaceholder' | translate"></textarea>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>{{ 'CONFLICT.reviewRecommendations' | translate }}</mat-label>
                      <textarea matInput [(ngModel)]="reviewRecommendations" rows="4"
                                [placeholder]="'CONFLICT.reviewRecommendationsPlaceholder' | translate"></textarea>
                    </mat-form-field>

                    <div class="review-actions">
                      <button mat-stroked-button (click)="saveReview('in_progress')" [disabled]="savingReview()">
                        <mat-icon>save</mat-icon> {{ 'CONFLICT.saveProgress' | translate }}
                      </button>
                      <button mat-flat-button color="primary" (click)="saveReview('completed')" [disabled]="savingReview()">
                        <mat-icon>check_circle</mat-icon> {{ 'CONFLICT.markComplete' | translate }}
                      </button>
                    </div>
                  } @else {
                    <!-- Non-coach view -->
                    @if (analysis()!.professionalReview?.notes) {
                      <div class="review-section">
                        <h4>{{ 'CONFLICT.reviewNotes' | translate }}</h4>
                        <p>{{ analysis()!.professionalReview!.notes }}</p>
                      </div>
                    }
                    @if (analysis()!.professionalReview?.recommendations) {
                      <div class="review-section">
                        <h4>{{ 'CONFLICT.reviewRecommendations' | translate }}</h4>
                        <p>{{ analysis()!.professionalReview!.recommendations }}</p>
                      </div>
                    }
                    @if (analysis()!.professionalReview?.status === 'pending') {
                      <p class="pending-note">{{ 'CONFLICT.awaitingReview' | translate }}</p>
                    }
                  }
                </div>
              }
            </div>
          </mat-tab>

          <!-- Tab 5: Resolution Plan -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>task_alt</mat-icon>
              <span>Resolution Plan</span>
            </ng-template>
            <div class="tab-body">
              <div class="placeholder-state">
                <mat-icon>task_alt</mat-icon>
                <h3>Resolution Plan</h3>
                <p>
                  Track concrete action items, assign owners, and set timelines for
                  resolving the issues identified in this analysis.
                </p>
                <span class="placeholder-tag">Coming soon</span>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>

        <!-- Actions bar placeholder for future use -->
      </div>
    }
  `,
  styles: [`
    .loading, .not-found {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 300px; gap: 12px; color: #6b7c93;
      h2 { margin: 0; color: var(--artes-primary); }
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #c8d3df; }
    }

    .detail-page { max-width: 80%; margin: 0 auto; padding: 0 16px 32px; }

    /* ─ Header ─ */
    .page-header {
      display: flex; align-items: flex-start; gap: 12px; padding: 16px 0 12px;
    }
    .header-content { flex: 1; min-width: 0; }
    .header-content h1 {
      margin: 0 0 6px; font-size: 22px; color: var(--artes-primary); font-weight: 700;
    }
    .header-meta { display: flex; flex-wrap: wrap; gap: 12px; }
    .meta-chip {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 13px; color: #5a6a7e;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #9aa5b4; }
    }
    .meta-link {
      cursor: pointer; text-decoration: none; transition: color 0.15s;
      &:hover { color: var(--artes-accent); mat-icon { color: var(--artes-accent); } }
      .link-arrow { font-size: 12px; width: 12px; height: 12px; margin-left: 2px; }
    }
    .header-right {
      display: flex; flex-direction: column; align-items: center; gap: 6px; flex-shrink: 0;
    }
    .score-block {
      width: 72px; height: 72px; border-radius: 14px; flex-shrink: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      .score-num  { font-size: 28px; font-weight: 700; line-height: 1; }
      .score-label { font-size: 10px; margin-top: 3px; opacity: 0.8; }
      &.low      { background: rgba(39,196,160,0.15); color: #1a9678; }
      &.medium   { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.high     { background: rgba(232,108,58,0.15); color: #c04a14; }
      &.critical { background: rgba(229,62,62,0.15);  color: #c53030; }
    }
    .chips-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 100px; }
    .chip {
      background: rgba(58,159,214,0.1); color: #2080b0;
      padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 500;
    }

    /* ─ Tabs ─ */
    .detail-tabs {
      ::ng-deep .mat-mdc-tab .mdc-tab__text-label {
        display: flex; align-items: center; gap: 6px;
      }
    }
    .tab-body { padding: 20px 4px; }

    /* ─ AI Analysis tab content — reused from dialog ─ */
    .section {
      padding: 16px 0;
      h3 {
        display: flex; align-items: center; gap: 6px;
        font-size: 15px; font-weight: 600; color: var(--artes-primary); margin: 0 0 12px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--artes-accent); }
      }
    }
    .narrative {
      font-size: 14px; color: #374151; line-height: 1.7; margin: 0;
      p { margin: 0 0 12px; &:last-child { margin-bottom: 0; } }
    }
    .drill-hint { font-size: 13px; color: #6b7280; margin: -4px 0 16px; line-height: 1.5; }
    .sub-analyses-list { display: flex; flex-direction: column; gap: 10px; }
    .sub-card {
      background: #f8fafc; border-radius: 10px;
      border-left: 4px solid #e8edf4; transition: border-color 0.2s; overflow: hidden;
      &.low      { border-left-color: #27C4A0; }
      &.medium   { border-left-color: #f0a500; }
      &.high     { border-left-color: #e86c3a; }
      &.critical { border-left-color: #e53e3e; }
    }
    .sub-row {
      display: flex; align-items: center; gap: 14px; padding: 12px 14px;
      &.clickable { cursor: pointer; &:hover { background: rgba(58,159,214,0.04); } }
    }
    .sub-left { flex-shrink: 0; }
    .sub-center { flex: 1; min-width: 0; }
    .sub-type-label { font-size: 13px; font-weight: 600; color: var(--artes-primary); margin-bottom: 6px; }
    .sub-score-bar-wrap {
      background: #e8edf4; border-radius: 4px; height: 6px; overflow: hidden;
      &.empty { display: flex; align-items: center; background: transparent; height: auto; }
    }
    .sub-score-bar { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
    .sub-score-bar-placeholder { font-size: 12px; color: #9aa5b4; font-style: italic; }
    .sub-narrative-panel {
      padding: 0 14px 14px 100px; border-top: 1px solid #e8edf4;
      p { font-size: 13px; color: #374151; line-height: 1.7; margin: 12px 0 0; }
    }
    .expand-icon {
      font-size: 20px; width: 20px; height: 20px; color: #9aa5b4;
      transition: transform 0.2s;
      &.expanded { transform: rotate(180deg); }
    }
    .sub-right {
      flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
      button { display: flex; align-items: center; gap: 4px; font-size: 12px; white-space: nowrap;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
        mat-spinner { margin: 0 2px; }
      }
    }
    .script-box { background: #f8fafc; border-radius: 10px; padding: 16px; border-left: 3px solid var(--artes-accent); }
    .script-text { font-family: inherit; font-size: 13px; color: #374151; line-height: 1.7; margin: 0; white-space: pre-wrap; word-break: break-word; }
    .script-sections { display: flex; flex-direction: column; gap: 12px; }
    .script-section { background: #f8fafc; border-radius: 10px; padding: 14px 16px; border-left: 3px solid var(--artes-accent); }
    .script-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--artes-accent); margin-bottom: 8px; }
    .script-para { font-size: 13px; color: #374151; line-height: 1.7; margin: 0; }
    .script-list { margin: 0; padding-left: 18px; li { font-size: 13px; color: #374151; line-height: 1.7; margin-bottom: 2px; } &.tight li { margin-bottom: 0; } }
    .topics-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th { text-align: left; padding: 6px 10px; background: #edf2f7; color: var(--artes-primary); font-weight: 600; font-size: 12px;
        &:first-child { border-radius: 6px 0 0 0; width: 30%; } &:last-child { border-radius: 0 6px 0 0; } }
      td { padding: 8px 10px; vertical-align: top; color: #374151; border-bottom: 1px solid #e8edf4; }
      tr:last-child td { border-bottom: none; }
      .topic-name { font-weight: 600; color: var(--artes-primary); }
    }

    /* ─ AI Recommended Actions tab ─ */
    .generate-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 60px 20px; text-align: center; color: #6b7c93; gap: 8px;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #c8d3df; }
      h3 { margin: 4px 0; font-size: 18px; color: var(--artes-primary); }
      p { max-width: 460px; line-height: 1.6; font-size: 14px; margin: 0 0 12px; }
      .gen-hint { font-size: 12px; color: #9aa5b4; }
    }
    .actions-accordion {
      display: block; margin-bottom: 16px;
      ::ng-deep .mat-expansion-panel { border-radius: 12px !important; margin-bottom: 8px; box-shadow: none !important; border: 1px solid #e8edf4; }
      ::ng-deep .mat-expansion-panel-header { padding: 0 20px; height: 52px; }
      ::ng-deep .mat-expansion-panel-body { padding: 0 20px 16px; }
      ::ng-deep mat-panel-title {
        display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--artes-primary);
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--artes-accent); }
      }
    }
    .completion-count {
      margin-left: auto; font-size: 12px; font-weight: 600; color: #9aa5b4;
      padding: 2px 8px; border-radius: 999px; background: #f0f4f8;
    }
    .timeframe-tag {
      font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 999px;
      background: #eef2f7; color: #5a6a7e; margin-left: 4px;
      &.urgent { background: rgba(239, 68, 68, 0.1); color: #b91c1c; }
    }
    .action-cards { display: flex; flex-direction: column; gap: 10px; }
    .action-card {
      background: #f8fafc; border-radius: 10px; padding: 14px 16px;
      border-left: 4px solid #e8edf4; transition: opacity 0.2s;
      &.priority-high     { border-left-color: #e86c3a; }
      &.priority-medium   { border-left-color: #f0a500; }
      &.priority-low      { border-left-color: #27C4A0; }
      &.completed { opacity: 0.55; .action-title { text-decoration: line-through; } }
    }
    .action-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .action-title { font-size: 14px; font-weight: 600; color: var(--artes-primary); flex: 1; }
    .priority-badge {
      font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px;
      border-radius: 999px; letter-spacing: 0.3px;
      &.high     { background: rgba(232,108,58,0.15); color: #c04a14; }
      &.medium   { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.low      { background: rgba(39,196,160,0.15); color: #1a9678; }
    }
    .action-desc { font-size: 13px; color: #374151; line-height: 1.6; margin: 0 0 8px; }
    .action-footer { display: flex; gap: 16px; }
    .action-owner, .action-timeframe {
      display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #5a6a7e;
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #9aa5b4; }
    }
    .preventive-section {
      margin-top: 16px;
      h3 {
        display: flex; align-items: center; gap: 6px;
        font-size: 15px; font-weight: 600; color: var(--artes-primary); margin: 0 0 12px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--artes-accent); }
      }
    }
    .preventive-list {
      margin: 0; padding-left: 20px;
      li { font-size: 14px; color: #374151; line-height: 1.7; margin-bottom: 6px; }
    }
    .regen-row { display: flex; justify-content: center; gap: 12px; align-items: center; padding: 16px 0 0; flex-wrap: wrap; }
    .escalation-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 14px; border-radius: 999px;
      background: rgba(39,196,160,0.12); color: #1a9678;
      font-size: 13px; font-weight: 600;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .menu-loading, .menu-empty { padding: 16px 24px; text-align: center; color: #6b7c93; font-size: 13px; }
    .gen-intake-btn { font-size: 11px; height: 28px; line-height: 28px; }
    .gen-intake-btn.done { color: #1a9678; border-color: #1a9678; }
    .action-card { position: relative; }
    .intake-overlay {
      position: absolute; inset: 0; z-index: 2;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
      background: rgba(255,255,255,0.92); border-radius: 10px;
      font-size: 13px; font-weight: 500; color: #5a6a7e;
      &.done { color: #1a9678; mat-icon { font-size: 32px; width: 32px; height: 32px; } }
    }

    /* ─ Professional Review ─ */
    .review-status-dot {
      width: 8px; height: 8px; border-radius: 50%; margin-left: 6px; display: inline-block;
      &.pending { background: #f0a500; }
      &.in_progress { background: #3A9FD6; }
      &.completed { background: #27C4A0; }
    }
    .review-card {
      background: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 8px;
    }
    .review-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
      font-weight: 600; color: var(--artes-primary);
      mat-icon { color: #9aa5b4; }
    }
    .review-status-badge {
      margin-left: auto; padding: 3px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      &.pending { background: rgba(240,165,0,0.12); color: #a06800; }
      &.in_progress { background: rgba(58,159,214,0.12); color: #2080b0; }
      &.completed { background: rgba(39,196,160,0.12); color: #1a9678; }
    }
    .review-message {
      display: flex; gap: 8px; padding: 10px 14px; border-radius: 8px;
      background: rgba(58,159,214,0.06); margin-bottom: 16px;
      mat-icon { color: #3A9FD6; flex-shrink: 0; margin-top: 2px; }
      p { margin: 0; font-size: 13px; color: #5a6a7e; }
    }
    .review-section {
      margin-bottom: 16px;
      h4 { font-size: 13px; font-weight: 600; color: var(--artes-primary); margin: 0 0 6px; }
      p { font-size: 13px; color: #5a6a7e; white-space: pre-wrap; line-height: 1.5; margin: 0; }
    }
    .review-actions { display: flex; gap: 12px; margin-top: 16px; }
    .pending-note { color: #9aa5b4; font-style: italic; font-size: 13px; text-align: center; padding: 24px; }
    .full-width { width: 100%; }

    /* ─ Placeholder tabs ─ */
    .placeholder-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 60px 20px; text-align: center; color: #6b7c93;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #c8d3df; }
      h3 { margin: 12px 0 8px; font-size: 18px; color: var(--artes-primary); }
      p { max-width: 440px; line-height: 1.6; font-size: 14px; margin: 0 0 16px; }
    }
    .placeholder-tag {
      display: inline-block; padding: 4px 14px; border-radius: 999px;
      background: #eef2f7; color: #9aa5b4; font-size: 12px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px;
    }

    /* ─ Bottom actions ─ */
    .escalation-banner {
      display: flex; align-items: center; gap: 8px;
      background: rgba(229,62,62,0.08); border-radius: 8px; padding: 12px 14px;
      color: #c53030; font-size: 13px; margin-top: 16px;
      mat-icon { font-size: 18px; }
    }
    .actions-bar {
      display: flex; justify-content: flex-end; gap: 12px; padding: 16px 0;
    }

    /* ════════════════════════════════════════════════════════════════
       REDESIGNED AI ANALYSIS TAB — hero, narrative, distribution, grid
       ════════════════════════════════════════════════════════════════ */
    .ai-analysis-tab {
      display: flex; flex-direction: column; gap: 20px;
      padding: 24px 4px 8px;
    }

    /* ── Hero ─────────────────────────────────────────────────────── */
    .ai-hero {
      position: relative; overflow: hidden;
      display: grid; grid-template-columns: auto 1fr auto; gap: 28px; align-items: center;
      padding: 28px 32px; border-radius: 20px;
      background: linear-gradient(135deg, #fbfcfe 0%, #f2f7fb 100%);
      border: 1px solid rgba(27, 42, 71, 0.06);
      box-shadow: 0 4px 20px -10px rgba(27, 42, 71, 0.08);
      animation: hero-fade 0.5s ease both;

      &.risk-low    { background: linear-gradient(135deg, #fbfefd 0%, #e9f9f4 100%); }
      &.risk-medium { background: linear-gradient(135deg, #fffdf6 0%, #fdf2dc 100%); }
      &.risk-high   { background: linear-gradient(135deg, #fff9f6 0%, #fde5d8 100%); }
      &.risk-critical {
        background: linear-gradient(135deg, #fff7f7 0%, #fbdede 100%);
        border-color: rgba(229, 62, 62, 0.15);
      }
    }
    .ai-hero-glow {
      position: absolute; inset: -40% -20% auto auto; width: 60%; height: 140%;
      background: radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 60%);
      pointer-events: none; animation: glow-drift 8s ease-in-out infinite alternate;
    }
    @keyframes glow-drift {
      0%   { transform: translate(0, 0) rotate(0deg); }
      100% { transform: translate(-30px, 20px) rotate(10deg); }
    }
    @keyframes hero-fade {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Big animated ring gauge */
    .ai-hero-gauge {
      position: relative; width: 180px; height: 180px; flex-shrink: 0;
    }
    .big-ring { width: 100%; height: 100%; transform: rotate(-90deg); }
    .big-ring .ring-bg { stroke: rgba(27, 42, 71, 0.08); }
    .big-ring .ring-val {
      animation: ring-draw 1.1s cubic-bezier(0.22, 1, 0.36, 1) both;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.08));
    }
    @keyframes ring-draw {
      from { stroke-dashoffset: 490; }
    }
    .big-ring-inner {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 0;
    }
    .big-score {
      font-size: 52px; font-weight: 800; line-height: 1;
      color: var(--artes-primary); letter-spacing: -1.5px;
      animation: score-pop 0.6s 0.2s ease both;
    }
    .big-score-of {
      font-size: 12px; color: #8a99ad; margin-top: 6px;
      font-weight: 500; letter-spacing: 0.8px;
    }
    @keyframes score-pop {
      from { transform: scale(0.7); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }

    /* Hero center: risk label + summary */
    .ai-hero-center {
      min-width: 0; display: flex; flex-direction: column; gap: 10px;
      animation: slide-in 0.5s 0.1s ease both;
    }
    @keyframes slide-in {
      from { opacity: 0; transform: translateX(-8px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    .ai-hero-eyebrow {
      font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px;
      color: #7f8ea3; font-weight: 600;
    }
    .ai-hero-risk {
      display: inline-flex; align-items: center; gap: 10px;
      font-size: 26px; font-weight: 700; line-height: 1.1;
      mat-icon { font-size: 28px; width: 28px; height: 28px; }
      &.low    { color: #1a9678; }
      &.medium { color: #b07800; }
      &.high   { color: #c04a14; }
      &.critical { color: #c53030; animation: pulse-critical 2.2s ease-in-out infinite; }
    }
    @keyframes pulse-critical {
      0%, 100% { text-shadow: 0 0 0 rgba(197,48,48,0); }
      50%      { text-shadow: 0 0 12px rgba(197,48,48,0.35); }
    }
    .ai-hero-lead {
      font-size: 14px; color: #4a5a74; line-height: 1.6;
      max-width: 420px; font-weight: 500;
    }

    /* Hero stats */
    .ai-hero-stats {
      display: flex; flex-direction: column; gap: 10px; flex-shrink: 0;
    }
    .ai-stat-card {
      position: relative; min-width: 148px;
      display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto;
      column-gap: 10px; align-items: center;
      padding: 12px 16px; border-radius: 12px;
      background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(6px);
      border: 1px solid rgba(27, 42, 71, 0.06);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
      animation: stat-in 0.5s ease both;
      &:nth-child(1) { animation-delay: 0.2s; }
      &:nth-child(2) { animation-delay: 0.3s; }
      &:hover { transform: translateY(-2px); box-shadow: 0 6px 18px -8px rgba(27, 42, 71, 0.15); }
    }
    @keyframes stat-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .ai-stat-icon {
      grid-row: 1 / 3; width: 36px; height: 36px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, rgba(58,159,214,0.14), rgba(39,196,160,0.14));
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--artes-accent); }
    }
    .ai-stat-num {
      font-size: 22px; font-weight: 700; color: var(--artes-primary);
      line-height: 1.1; display: flex; align-items: baseline; gap: 2px;
      .stat-big { font-size: 22px; }
      .stat-of { font-size: 13px; color: #9aa5b4; font-weight: 500; }
    }
    .ai-stat-lbl {
      font-size: 11px; color: #7f8ea3; font-weight: 500;
      text-transform: uppercase; letter-spacing: 0.4px;
    }

    /* ── Narrative card ───────────────────────────────────────────── */
    .ai-narrative-card {
      background: #ffffff; border-radius: 18px; padding: 24px 28px;
      border: 1px solid #edf1f6;
      box-shadow: 0 2px 12px -6px rgba(27, 42, 71, 0.06);
      animation: card-in 0.5s 0.1s ease both;
    }
    @keyframes card-in {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .ai-narrative-head {
      display: flex; align-items: center; gap: 14px; margin-bottom: 18px;
    }
    .ai-avatar {
      position: relative; width: 44px; height: 44px; flex-shrink: 0;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #3A9FD6 0%, #27C4A0 100%);
      box-shadow: 0 4px 14px -4px rgba(58, 159, 214, 0.45);
      mat-icon { color: #fff; font-size: 22px; width: 22px; height: 22px; }
    }
    .pulse-ring {
      position: absolute; inset: -4px; border-radius: 50%;
      border: 2px solid rgba(58, 159, 214, 0.35);
      animation: pulse-ring 2.4s ease-out infinite;
    }
    @keyframes pulse-ring {
      0%   { transform: scale(1);   opacity: 0.8; }
      100% { transform: scale(1.3); opacity: 0; }
    }
    .ai-head-text { display: flex; flex-direction: column; gap: 3px; }
    .ai-head-title { font-size: 15px; font-weight: 700; color: var(--artes-primary); }
    .ai-head-sub {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px; color: #9aa5b4;
      .tiny { font-size: 13px; width: 13px; height: 13px; }
    }

    .ai-narrative-body { display: flex; flex-direction: column; gap: 14px; }
    .ai-pullquote {
      position: relative; margin: 0;
      padding: 18px 20px 18px 52px;
      background: linear-gradient(135deg, rgba(58,159,214,0.06) 0%, rgba(39,196,160,0.04) 100%);
      border-left: 4px solid var(--artes-accent);
      border-radius: 0 12px 12px 0;
      font-size: 15px; line-height: 1.7; color: #2d3748; font-weight: 500;
      font-style: italic;
      animation: quote-in 0.55s 0.15s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    @keyframes quote-in {
      from { opacity: 0; transform: translateX(-6px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    .ai-pullquote .quote-mark {
      position: absolute; left: 14px; top: 14px;
      font-size: 30px; width: 30px; height: 30px;
      color: var(--artes-accent); opacity: 0.35;
    }
    .ai-para {
      font-size: 14px; color: #374151; line-height: 1.75; margin: 0;
      animation: para-in 0.5s ease both;
    }
    @keyframes para-in {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Risk distribution bar ───────────────────────────────────── */
    .risk-dist-card {
      background: #ffffff; border-radius: 16px; padding: 20px 24px;
      border: 1px solid #edf1f6;
      box-shadow: 0 2px 12px -6px rgba(27, 42, 71, 0.06);
      animation: card-in 0.5s 0.15s ease both;
    }
    .risk-dist-head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
      h4 {
        display: flex; align-items: center; gap: 6px; margin: 0;
        font-size: 14px; font-weight: 600; color: var(--artes-primary);
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--artes-accent); }
      }
    }
    .risk-dist-hint {
      font-size: 12px; color: #9aa5b4; background: #f0f4f8;
      padding: 2px 10px; border-radius: 999px; font-weight: 600;
    }
    .dist-bar {
      display: flex; width: 100%; height: 14px;
      border-radius: 8px; overflow: hidden; background: #f0f4f8;
      margin-bottom: 12px;
    }
    .dist-segment {
      height: 100%; transform-origin: left center;
      animation: dist-grow 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
      transition: filter 0.2s;
      &:hover { filter: brightness(1.08); }
    }
    @keyframes dist-grow {
      from { transform: scaleX(0); }
      to   { transform: scaleX(1); }
    }
    .dist-legend {
      display: flex; flex-wrap: wrap; gap: 14px 20px;
    }
    .legend-item {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; color: #4a5a74;
    }
    .legend-dot {
      width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0;
    }
    .legend-label { font-weight: 500; }
    .legend-val {
      font-variant-numeric: tabular-nums; font-weight: 700;
      color: var(--artes-primary); margin-left: 2px;
    }

    /* ── Conflict type cards grid ────────────────────────────────── */
    .types-section { margin-top: 4px; }
    .types-head {
      margin-bottom: 14px;
      h3 {
        display: flex; align-items: center; gap: 6px;
        font-size: 15px; font-weight: 600; color: var(--artes-primary); margin: 0 0 4px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--artes-accent); }
      }
      .drill-hint { font-size: 13px; color: #6b7280; margin: 0; line-height: 1.5; }
    }
    .types-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 16px;
    }
    .type-card {
      position: relative; overflow: hidden;
      display: flex; flex-direction: column; gap: 12px;
      padding: 18px; border-radius: 16px;
      background: #ffffff; border: 1px solid #edf1f6;
      box-shadow: 0 2px 10px -6px rgba(27, 42, 71, 0.06);
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      animation: card-in 0.55s ease both;

      &::before {
        content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
        background: #e8edf4; transition: background 0.2s;
      }
      &.low::before      { background: linear-gradient(180deg, #27C4A0, #1a9678); }
      &.medium::before   { background: linear-gradient(180deg, #f0a500, #b07800); }
      &.high::before     { background: linear-gradient(180deg, #e86c3a, #c04a14); }
      &.critical::before { background: linear-gradient(180deg, #e53e3e, #9b2c2c); }

      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 12px 28px -12px rgba(27, 42, 71, 0.18);
        border-color: #d8e2ee;
      }
      &.pending { background: linear-gradient(135deg, #fbfcfe, #f5f8fb); }
    }
    .type-topline {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;
    }
    .type-icon-wrap {
      width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: #f0f4f8; transition: background 0.2s, transform 0.2s;
      mat-icon { font-size: 22px; width: 22px; height: 22px; color: #5a6a7e; }

      &.low      { background: rgba(39,196,160,0.12);  mat-icon { color: #1a9678; } }
      &.medium   { background: rgba(240,165,0,0.12);   mat-icon { color: #b07800; } }
      &.high     { background: rgba(232,108,58,0.12);  mat-icon { color: #c04a14; } }
      &.critical { background: rgba(229,62,62,0.12);   mat-icon { color: #c53030; } }
    }
    .type-card:hover .type-icon-wrap { transform: scale(1.06) rotate(-2deg); }

    .risk-pill {
      display: inline-flex; align-items: center;
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; padding: 4px 10px; border-radius: 999px;
      background: #eef2f7; color: #7f8ea3;
      &.low      { background: rgba(39,196,160,0.15); color: #1a9678; }
      &.medium   { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.high     { background: rgba(232,108,58,0.15); color: #c04a14; }
      &.critical { background: rgba(229,62,62,0.15);  color: #c53030;
                   animation: pill-pulse 1.8s ease-in-out infinite; }
      &.pending  { background: rgba(154,165,180,0.12); color: #7f8ea3;
                   text-transform: none; letter-spacing: 0.2px; font-weight: 600; }
    }
    @keyframes pill-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(229,62,62,0); }
      50%      { box-shadow: 0 0 0 6px rgba(229,62,62,0.1); }
    }
    .type-title {
      font-size: 15px; font-weight: 600; color: var(--artes-primary);
      line-height: 1.35;
    }

    /* Small per-type ring */
    .type-ring-wrap {
      position: relative; width: 96px; height: 96px; align-self: center;
    }
    .type-ring {
      width: 100%; height: 100%; transform: rotate(-90deg);
      .tr-bg { stroke: rgba(27, 42, 71, 0.08); }
      .tr-val { animation: ring-draw-sm 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }
    }
    @keyframes ring-draw-sm { from { stroke-dashoffset: 251.3; } }
    .type-ring-inner {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .type-ring-num {
      font-size: 26px; font-weight: 800; line-height: 1; letter-spacing: -0.5px;
      animation: score-pop 0.5s 0.15s ease both;
    }
    .type-ring-lbl {
      font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px;
      color: #9aa5b4; margin-top: 3px; font-weight: 600;
    }

    .type-toggle {
      align-self: stretch; font-size: 12px; height: 32px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 2px; }
    }
    /* Empty / pending state inside type card */
    .type-empty {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 18px 10px 8px;
    }
    .type-empty-icon {
      width: 52px; height: 52px; border-radius: 50%;
      background: #f0f4f8; display: flex; align-items: center; justify-content: center;
      mat-icon {
        font-size: 26px; width: 26px; height: 26px; color: #9aa5b4;
        animation: hourglass-spin 3.5s ease-in-out infinite;
      }
    }
    @keyframes hourglass-spin {
      0%, 45% { transform: rotate(0deg); }
      50%     { transform: rotate(180deg); }
      95%, 100% { transform: rotate(180deg); }
    }
    .type-empty-lbl {
      font-size: 12px; color: #9aa5b4; font-weight: 500;
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .type-run-btn {
      align-self: stretch; font-size: 13px;
      mat-icon { margin-right: 4px; font-size: 18px; width: 18px; height: 18px; }
      mat-spinner { margin-right: 6px; }
    }

    /* ── Responsive ──────────────────────────────────────────────── */
    @media (max-width: 860px) {
      .ai-hero { grid-template-columns: 1fr; text-align: center; gap: 16px; padding: 22px 18px; }
      .ai-hero-gauge { margin: 0 auto; }
      .ai-hero-center { align-items: center; }
      .ai-hero-stats { flex-direction: row; justify-content: center; flex-wrap: wrap; }
      .ai-stat-card { flex: 1 1 160px; max-width: 220px; }
    }
    @media (max-width: 520px) {
      .types-grid { grid-template-columns: 1fr; }
      .ai-narrative-card { padding: 18px 16px; }
      .ai-pullquote { padding: 14px 14px 14px 44px; }
    }

    /* ── Divergence tab ─────────────────────────────────────────────── */
    .div-quality {
      display: flex; align-items: center; gap: 10px;
      background: rgba(58,159,214,0.06);
      border: 1px solid rgba(58,159,214,0.18);
      padding: 12px 16px; border-radius: 8px;
      margin-bottom: 18px;
      font-size: 14px; color: #2080b0;
      mat-icon { color: #3A9FD6; flex-shrink: 0; }
      .div-info { font-size: 16px; width: 16px; height: 16px; color: #9aa5b4; cursor: help; margin-left: auto; }
    }
    .div-card {
      background: white; border: 1px solid #edf1f6; border-radius: 10px;
      padding: 18px 20px; margin-bottom: 16px;
      h3 { margin: 0 0 14px; font-size: 14px; font-weight: 700; color: var(--artes-primary); text-transform: uppercase; letter-spacing: 0.5px; }
    }
    .div-alignment-card {
      .div-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;
        h3 { margin: 0; }
      }
      .div-meter { display: flex; align-items: center; gap: 12px; }
      .div-meter-bar { flex: 1; height: 10px; border-radius: 999px; background: #f0f4f8; overflow: hidden; }
      .div-meter-fill {
        height: 100%; border-radius: 999px;
        background: linear-gradient(90deg, #e53e3e 0%, #f0a500 50%, #27C4A0 100%);
        transition: width 0.3s ease;
      }
      .div-meter-num { font-size: 13px; font-weight: 700; color: var(--artes-primary); font-variant-numeric: tabular-nums; min-width: 60px; text-align: right; }
    }
    .div-band {
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
      padding: 3px 10px; border-radius: 999px;
      &.aligned   { background: rgba(39,196,160,0.15); color: #1a9678; }
      &.mixed     { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.fractured { background: rgba(229,62,62,0.15);  color: #c53030; }
    }
    .div-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th { text-align: left; padding: 8px 12px; color: #7f8ea3; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #edf1f6; }
      th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
      td { padding: 10px 12px; border-bottom: 1px solid #f5f7fa; color: #374151; }
      td.muted { color: #9aa5b4; }
      tr:last-child td { border-bottom: none; }
    }
    .div-disagreement-pill {
      display: inline-block; min-width: 36px; padding: 2px 8px; border-radius: 999px;
      font-weight: 700; font-size: 12px; text-align: center;
      &.aligned   { background: rgba(39,196,160,0.15); color: #1a9678; }
      &.mixed     { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.fractured { background: rgba(229,62,62,0.15);  color: #c53030; }
    }
    .div-items { display: flex; flex-direction: column; gap: 8px; }
    .div-item {
      padding: 12px 14px; border-radius: 8px;
      border: 1px solid #edf1f6; background: #fafcff;
      &.split { border-color: rgba(229,62,62,0.3); background: rgba(229,62,62,0.04); }
    }
    .div-item-head {
      display: flex; align-items: flex-start; gap: 10px; margin-bottom: 6px;
      .div-item-text { flex: 1; font-size: 13px; color: #374151; line-height: 1.5; }
    }
    .div-split-badge {
      display: inline-flex; align-items: center; gap: 4px;
      flex-shrink: 0;
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
      padding: 2px 8px; border-radius: 999px;
      background: rgba(229,62,62,0.10); color: #c53030;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
    }
    .div-item-stats {
      display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: #5a6a7e;
      strong { color: var(--artes-primary); margin-right: 3px; font-weight: 600; }
      .div-item-dim {
        margin-left: auto;
        padding: 1px 8px; border-radius: 999px;
        background: rgba(58,159,214,0.10); color: #2080b0; font-weight: 600; font-size: 11px;
      }
    }
    .div-disclaimer {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 12px 14px; border-radius: 8px;
      background: rgba(154,165,180,0.08); color: #5a6a7e;
      font-size: 12px; line-height: 1.5; margin-top: 8px;
      mat-icon { color: #7f8ea3; flex-shrink: 0; font-size: 18px; width: 18px; height: 18px; margin-top: 1px; }
    }
  `],
})
export class ConflictDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private translateSvc = inject(TranslateService);

  loading = signal(true);
  analysis = signal<ConflictAnalysis | null>(null);
  subAnalyses = signal<ConflictAnalysis[]>([]);
  runningFor = signal<string | null>(null);

  // AI Recommended Actions
  recommendedActions = signal<RecommendedActions | null>(null);
  generatingActions = signal(false);
  generatingIntakeFor = signal<number | null>(null);
  intakeGeneratedFor = signal<number | null>(null);
  expandedPanel = signal<string>('immediate');
  completedActions = signal<Record<string, Set<number>>>({});

  // Escalation / Coach selection
  coaches = signal<CoachOption[]>([]);
  loadingCoaches = signal(false);

  // Professional Review
  reviewNotes = '';
  reviewRecommendations = '';
  savingReview = signal(false);

  coachName = computed(() => {
    const a = this.analysis();
    if (!a?.escalatedToCoachId) return '';
    if (typeof a.escalatedToCoachId === 'string') return a.escalatedToCoachId;
    return `${a.escalatedToCoachId.firstName} ${a.escalatedToCoachId.lastName}`;
  });

  isAssignedCoach = computed(() => {
    const a = this.analysis();
    const user = this.auth.currentUser();
    if (!a?.escalatedToCoachId || !user) return false;
    const coachId = typeof a.escalatedToCoachId === 'string' ? a.escalatedToCoachId : a.escalatedToCoachId._id;
    return user.id === coachId;
  });

  isCompleted(section: string, index: number): boolean {
    return this.completedActions()[section]?.has(index) ?? false;
  }

  toggleCompleted(section: string, index: number): void {
    this.completedActions.update(map => {
      const updated = { ...map };
      const set = new Set(updated[section] ?? []);
      if (set.has(index)) { set.delete(index); } else { set.add(index); }
      updated[section] = set;
      return updated;
    });
    this.saveCompletedActions();
  }

  private saveCompletedActions(): void {
    const a = this.analysis();
    if (!a) return;
    const payload: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(this.completedActions())) payload[k] = [...v];
    this.api.patch(`/conflict/analyses/${a._id}/completed-actions`, { completedActions: payload }).subscribe();
  }

  completedCount(section: string, items: unknown[]): number {
    const set = this.completedActions()[section];
    return set ? [...set].filter(i => i < items.length).length : 0;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }
    this.api.get<ConflictAnalysis>(`/conflict/analyses/${id}`).subscribe({
      next: (a) => {
        this.analysis.set(a);
        if (a.recommendedActions) this.recommendedActions.set(a.recommendedActions);
        if (a.completedActions) {
          const map: Record<string, Set<number>> = {};
          for (const [k, v] of Object.entries(a.completedActions)) map[k] = new Set(v);
          this.completedActions.set(map);
        }
        if (a.professionalReview) {
          this.reviewNotes = a.professionalReview.notes || '';
          this.reviewRecommendations = a.professionalReview.recommendations || '';
        }
        this.loading.set(false);
        this.loadSubAnalyses(a._id);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadSubAnalyses(id: string): void {
    this.api.get<ConflictAnalysis[]>(`/conflict/analyses/${id}/sub-analyses`).subscribe({
      next: (list) => this.subAnalyses.set(list),
    });
  }

  subAnalysisFor(ct: string): ConflictAnalysis | undefined {
    return this.subAnalyses().find((s) => s.focusConflictType === ct);
  }

  runSubAnalysis(ct: string): void {
    const a = this.analysis();
    if (!a) return;
    this.runningFor.set(ct);
    this.api.post<ConflictAnalysis>(`/conflict/analyses/${a._id}/sub-analyses`, {
      focusConflictType: ct,
    }).subscribe({
      next: (sub) => {
        this.subAnalyses.update((list) => {
          const idx = list.findIndex((s) => s.focusConflictType === ct);
          return idx >= 0 ? list.map((s, i) => i === idx ? sub : s) : [...list, sub];
        });
        this.runningFor.set(null);
        this.openSubAnalysis(ct);
      },
      error: () => this.runningFor.set(null),
    });
  }

  splitParagraphs(text: string): string[] {
    return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  }

  openSubAnalysis(ct: string): void {
    const sub = this.subAnalysisFor(ct);
    if (!sub) return;
    this.dialog.open<SubAnalysisDialogComponent, SubAnalysisDialogData>(SubAnalysisDialogComponent, {
      width: '720px',
      maxWidth: '92vw',
      panelClass: 'sub-analysis-dialog-panel',
      data: {
        focusConflictType: sub.focusConflictType || ct,
        riskScore: sub.riskScore,
        riskLevel: sub.riskLevel,
        aiNarrative: sub.aiNarrative,
        conflictTypes: sub.conflictTypes || [],
        icon: this.typeIcon(ct),
        createdAt: sub.createdAt,
      },
    });
  }

  riskColor(level: string): string {
    const map: Record<string, string> = { low: '#27C4A0', medium: '#f0a500', high: '#e86c3a', critical: '#e53e3e' };
    return map[level] ?? '#9aa5b4';
  }

  riskIcon(level: string): string {
    const map: Record<string, string> = {
      low: 'check_circle',
      medium: 'info',
      high: 'warning',
      critical: 'report',
    };
    return map[level] ?? 'help';
  }

  /** Map a free-form conflict type label to a Material icon. */
  typeIcon(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('communication'))                                              return 'forum';
    if (t.includes('role') || t.includes('ambig') || t.includes('clarity'))       return 'help_outline';
    if (t.includes('leader') || t.includes('manage'))                             return 'supervisor_account';
    if (t.includes('trust'))                                                      return 'handshake';
    if (t.includes('psych') || t.includes('safety'))                              return 'shield';
    if (t.includes('feel') || t.includes('emotion'))                              return 'mood';
    if (t.includes('identity') || t.includes('belong') || t.includes('inclu'))    return 'diversity_3';
    if (t.includes('workload') || t.includes('burnout') || t.includes('stress'))  return 'hourglass_bottom';
    if (t.includes('process') || t.includes('procedure') || t.includes('structure'))  return 'account_tree';
    if (t.includes('resource'))                                                   return 'inventory_2';
    if (t.includes('recogn') || t.includes('reward'))                             return 'emoji_events';
    if (t.includes('feedback'))                                                   return 'rate_review';
    if (t.includes('change') || t.includes('transition'))                         return 'sync_alt';
    if (t.includes('power') || t.includes('politic'))                             return 'gavel';
    if (t.includes('value') || t.includes('culture'))                             return 'compass_calibration';
    if (t.includes('team') || t.includes('collab'))                               return 'groups';
    if (t.includes('workflow') || t.includes('task'))                             return 'task_alt';
    if (t.includes('goal') || t.includes('mission'))                              return 'flag';
    return 'label';
  }

  completedSubCount(): number {
    return this.subAnalyses().length;
  }

  analyzedTypes(): string[] {
    const a = this.analysis();
    if (!a) return [];
    return a.conflictTypes.filter((ct) => !!this.subAnalysisFor(ct));
  }

  /** Weight for the stacked risk-distribution bar — each segment proportional to its score. */
  distWeight(ct: string): number {
    const sub = this.subAnalysisFor(ct);
    if (!sub) return 0;
    const total = this.analyzedTypes().reduce((acc, c) => acc + (this.subAnalysisFor(c)?.riskScore || 0), 0);
    if (total <= 0) return 0;
    return (sub.riskScore / total) * 100;
  }

  private narrativeParagraphs(): string[] {
    const a = this.analysis();
    if (!a) return [];
    return this.splitParagraphs(a.aiNarrative);
  }

  firstParagraph(): string {
    return this.narrativeParagraphs()[0] ?? '';
  }

  remainingParagraphs(): string[] {
    return this.narrativeParagraphs().slice(1);
  }

  /** First sentence of the narrative — used as the hero lead. Clipped at 220 chars. */
  firstSentence(): string {
    const first = this.firstParagraph();
    if (!first) return '';
    const match = first.match(/[^.!?]+[.!?]/);
    const sentence = (match ? match[0] : first).trim();
    return sentence.length > 220 ? sentence.slice(0, 217).trimEnd() + '…' : sentence;
  }

  private splitWords(s: string): string {
    return s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
  }

  /** Map a 0-100 alignment score to a band: 70+ aligned, 40-69 mixed, <40 fractured. */
  alignmentBand(score: number): 'aligned' | 'mixed' | 'fractured' {
    if (score >= 70) return 'aligned';
    if (score >= 40) return 'mixed';
    return 'fractured';
  }

  /** Items sorted lowest rwg first, with split items prioritised. Cap at 10
   *  so the heat-map list doesn't sprawl on long instruments (e.g. 30-item TKI). */
  sortedItemMetrics(): ItemMetric[] {
    const items = this.analysis()?.itemMetrics ?? [];
    return [...items]
      .sort((a, b) => {
        const aSplit = a.bimodalityCoef > 0.555 ? 1 : 0;
        const bSplit = b.bimodalityCoef > 0.555 ? 1 : 0;
        if (aSplit !== bSplit) return bSplit - aSplit;
        return a.rwg - b.rwg;
      })
      .slice(0, 10);
  }

  scriptSections(): ScriptSection[] {
    const raw = this.analysis()?.managerScript;
    if (!raw) return [];
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(raw); if (typeof parsed !== 'object' || Array.isArray(parsed)) return []; } catch { return []; }
    const POINTS_RE = /^(points|talkingPoints|talking_points|actions|suggestions|tips|items|bullets|scripts|keyPoints|key_points|strategies)$/i;
    const TOPIC_RE = /^(topic|title|area|name|subject|issue|category|type|heading|label)$/i;
    return Object.entries(parsed).map(([key, val]): ScriptSection => {
      const label = this.splitWords(key);
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
        const topics = (val as Record<string, unknown>[]).map((item) => {
          const topicKey = Object.keys(item).find((k) => TOPIC_RE.test(k));
          const topicRaw = topicKey ? String(item[topicKey] ?? '') : '';
          const topic = topicRaw ? this.splitWords(topicRaw) : label;
          const pointsKey = Object.keys(item).find((k) => POINTS_RE.test(k));
          const rawPoints = pointsKey ? item[pointsKey] : null;
          const points: string[] = Array.isArray(rawPoints) ? rawPoints.map(String)
            : Object.values(item).filter((v) => typeof v === 'string' && v !== topicRaw).map(String);
          return { topic, points };
        });
        return { key, label, type: 'topics', topics };
      }
      if (Array.isArray(val)) return { key, label, type: 'list', items: val.map(String) };
      return { key, label, type: 'string', value: String(val ?? '') };
    });
  }

  generateActions(): void {
    const a = this.analysis();
    if (!a || this.generatingActions()) return;
    this.generatingActions.set(true);
    this.api.post<RecommendedActions>(`/conflict/analyses/${a._id}/recommended-actions`, {}).subscribe({
      next: (ra) => {
        this.recommendedActions.set(ra);
        this.generatingActions.set(false);
      },
      error: () => {
        this.snack.open('Failed to generate actions', 'OK', { duration: 3000 });
        this.generatingActions.set(false);
      },
    });
  }

  loadCoaches(): void {
    if (this.coaches().length) return;
    this.loadingCoaches.set(true);
    this.api.get<(CoachOption & { role: string })[]>('/users').subscribe({
      next: (users) => {
        const eligible = users.filter(u => u.role === 'coach' || u.role === 'hr_manager');
        this.coaches.set(eligible);
        this.loadingCoaches.set(false);
      },
      error: () => this.loadingCoaches.set(false),
    });
  }

  escalateToCoach(coach: CoachOption): void {
    const a = this.analysis();
    if (!a) return;
    this.api.post<ConflictAnalysis>(`/conflict/escalate/${a._id}`, { coachId: coach._id }).subscribe({
      next: (updated) => {
        this.analysis.set(updated);
        this.reviewNotes = updated.professionalReview?.notes || '';
        this.reviewRecommendations = updated.professionalReview?.recommendations || '';
        this.snack.open(
          this.translateSvc.instant('CONFLICT.escalationSent', { name: `${coach.firstName} ${coach.lastName}` }),
          'OK', { duration: 3500 },
        );
      },
      error: () => this.snack.open(this.translateSvc.instant('CONFLICT.escalationFailed'), 'OK', { duration: 3000 }),
    });
  }

  saveReview(status: 'in_progress' | 'completed'): void {
    const a = this.analysis();
    if (!a) return;
    this.savingReview.set(true);
    this.api.patch<ConflictAnalysis>(`/conflict/analyses/${a._id}/professional-review`, {
      notes: this.reviewNotes,
      recommendations: this.reviewRecommendations,
      status,
    }).subscribe({
      next: (updated) => {
        this.analysis.set(updated);
        this.savingReview.set(false);
        this.snack.open(
          status === 'completed'
            ? this.translateSvc.instant('CONFLICT.reviewCompleted')
            : this.translateSvc.instant('CONFLICT.reviewSaved'),
          'OK', { duration: 3000 },
        );
      },
      error: () => { this.savingReview.set(false); this.snack.open('Failed to save', 'OK', { duration: 3000 }); },
    });
  }

  hasGeneratedIntake(index: number): boolean {
    const map = this.analysis()?.generatedIntakeIds;
    return !!map?.[`immediate_${index}`];
  }

  openGeneratedIntake(index: number): void {
    const templateId = this.analysis()?.generatedIntakeIds?.[`immediate_${index}`];
    if (templateId) {
      this.router.navigate(['/intakes'], { queryParams: { highlight: templateId } });
    }
  }

  generateActionIntake(action: ActionItem, index: number): void {
    const a = this.analysis();
    if (!a) return;
    this.generatingIntakeFor.set(index);
    this.intakeGeneratedFor.set(null);
    this.api.post<{ _id: string; title: string }>(`/conflict/analyses/${a._id}/generate-intake`, {
      actionTitle: action.title,
      actionDescription: action.description,
      actionIndex: index,
    }).subscribe({
      next: (template) => {
        this.generatingIntakeFor.set(null);
        this.intakeGeneratedFor.set(index);
        // Update local analysis with the new mapping
        const updated = { ...a, generatedIntakeIds: { ...(a.generatedIntakeIds || {}), [`immediate_${index}`]: template._id } };
        this.analysis.set(updated);
        this.snack.open(
          this.translateSvc.instant('CONFLICT.assessmentGenerated', { title: template.title }),
          this.translateSvc.instant('COMMON.close'),
          { duration: 4000 },
        );
        setTimeout(() => {
          if (this.intakeGeneratedFor() === index) this.intakeGeneratedFor.set(null);
        }, 5000);
      },
      error: () => {
        this.generatingIntakeFor.set(null);
        this.snack.open(this.translateSvc.instant('CONFLICT.assessmentGenerateFailed'), 'OK', { duration: 3000 });
      },
    });
  }

  viewIntakeResponses(templateId: string): void {
    this.api.get<Record<string, unknown>>(`/surveys/templates/${templateId}`).subscribe({
      next: (template) => {
        this.dialog.open(SurveyResponsesDialogComponent, {
          width: '760px',
          maxHeight: '90vh',
          data: template,
        });
      },
      error: () => this.snack.open('Failed to load template', 'OK', { duration: 3000 }),
    });
  }
}
