import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/api.service';

type ScriptSection =
  | { key: string; label: string; type: 'string'; value: string }
  | { key: string; label: string; type: 'list'; items: string[] }
  | { key: string; label: string; type: 'topics'; topics: { topic: string; points: string[] }[] };

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
  escalationRequested: boolean;
  focusConflictType?: string;
  parentId?: string;
  createdAt: string;
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
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule, MatTabsModule,
    MatChipsModule, MatDividerModule, MatProgressSpinnerModule,
    MatTooltipModule, MatSnackBarModule,
  ],
  template: `
    @if (loading()) {
      <div class="loading"><mat-spinner diameter="40" /></div>
    } @else if (!analysis()) {
      <div class="not-found">
        <mat-icon>error_outline</mat-icon>
        <h2>Analysis not found</h2>
        <a mat-stroked-button routerLink="/conflict/analysis">
          <mat-icon>arrow_back</mat-icon> Back to analyses
        </a>
      </div>
    } @else {
      <div class="detail-page">
        <!-- Header -->
        <div class="page-header">
          <a mat-icon-button routerLink="/conflict/analysis" matTooltip="Back to analyses">
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
              @if (analysis()!.intakeTemplateId?.title; as tplTitle) {
                <span class="meta-chip">
                  <mat-icon>assignment</mat-icon>
                  {{ tplTitle }}
                </span>
              }
            </div>
          </div>
          <div class="header-right">
            <div class="score-block" [class]="analysis()!.riskLevel">
              <div class="score-num">{{ analysis()!.riskScore }}</div>
              <div class="score-label">Risk Score</div>
            </div>
            <span class="risk-badge" [class]="analysis()!.riskLevel">
              {{ analysis()!.riskLevel | titlecase }} Risk
            </span>
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
              <span>AI Analysis</span>
            </ng-template>
            <div class="tab-body">
              <div class="section">
                <h3><mat-icon>auto_awesome</mat-icon> AI Narrative</h3>
                <p class="narrative">{{ analysis()!.aiNarrative }}</p>
              </div>

              @if (analysis()!.conflictTypes.length) {
                <mat-divider />
                <div class="section">
                  <h3><mat-icon>manage_search</mat-icon> Drill-down by Conflict Type</h3>
                  <p class="drill-hint">Run a focused sub-analysis for each detected conflict type.</p>
                  <div class="sub-analyses-list">
                    @for (ct of analysis()!.conflictTypes; track ct) {
                      <div class="sub-row" [class]="subAnalysisFor(ct)?.riskLevel || ''">
                        <div class="sub-left">
                          <svg class="mini-gauge" viewBox="0 0 80 52" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
                            <path d="M10,44 A30,30 0 0,1 70,44" fill="none" stroke="#e8edf4" stroke-width="8" stroke-linecap="round"/>
                            <path [attr.d]="gaugeArcFor(ct)" fill="none"
                                  [attr.stroke]="subAnalysisFor(ct) ? riskColor(subAnalysisFor(ct)!.riskLevel) : 'none'"
                                  stroke-width="8" stroke-linecap="round"/>
                            <text x="40" y="43" text-anchor="middle"
                                  [attr.font-size]="subAnalysisFor(ct) ? 13 : 10"
                                  font-weight="700"
                                  [attr.fill]="subAnalysisFor(ct) ? riskColor(subAnalysisFor(ct)!.riskLevel) : '#b0bec5'">
                              {{ subAnalysisFor(ct)?.riskScore ?? '--' }}
                            </text>
                          </svg>
                        </div>
                        <div class="sub-center">
                          <div class="sub-type-label">{{ ct }}</div>
                          @if (subAnalysisFor(ct); as sub) {
                            <div class="sub-score-bar-wrap">
                              <div class="sub-score-bar" [style.width.%]="sub.riskScore" [style.background]="riskColor(sub.riskLevel)"></div>
                            </div>
                            <div class="sub-narrative">{{ sub.aiNarrative }}</div>
                          } @else {
                            <div class="sub-score-bar-wrap empty">
                              <div class="sub-score-bar-placeholder">No sub-analysis yet</div>
                            </div>
                          }
                        </div>
                        <div class="sub-right">
                          @if (subAnalysisFor(ct); as sub) {
                            <span class="risk-badge" [class]="sub.riskLevel">{{ sub.riskLevel | titlecase }}</span>
                          }
                          @if (!subAnalysisFor(ct)) {
                            <button mat-stroked-button color="primary"
                                    [disabled]="runningFor() === ct"
                                    (click)="runSubAnalysis(ct)">
                              @if (runningFor() === ct) {
                                <mat-spinner diameter="16" />
                              } @else {
                                <mat-icon>play_arrow</mat-icon>
                              }
                              {{ runningFor() === ct ? 'Analyzing…' : 'Run' }}
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (analysis()!.managerScript) {
                <mat-divider />
                <div class="section">
                  <h3><mat-icon>record_voice_over</mat-icon> Manager Conversation Guide</h3>
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
                              <thead><tr><th>Topic</th><th>Talking Points</th></tr></thead>
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
              }
            </div>
          </mat-tab>

          <!-- Tab 2: AI Recommended Actions -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>lightbulb</mat-icon>
              <span>AI Recommended Actions</span>
            </ng-template>
            <div class="tab-body">
              @if (!recommendedActions() && !generatingActions()) {
                <div class="generate-state">
                  <mat-icon>lightbulb</mat-icon>
                  <h3>AI Recommended Actions</h3>
                  <p>
                    Generate concrete, prioritized action items based on this analysis.
                    Actions are grouped by timeframe — immediate, short-term, and long-term.
                  </p>
                  <button mat-flat-button color="primary" (click)="generateActions()">
                    <mat-icon>auto_awesome</mat-icon> Generate Recommended Actions
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
                @if (ra.immediateActions?.length) {
                  <div class="actions-section">
                    <h3><mat-icon>priority_high</mat-icon> Immediate Actions <span class="timeframe-tag urgent">This week</span></h3>
                    <div class="action-cards">
                      @for (a of ra.immediateActions; track $index) {
                        <div class="action-card" [class]="'priority-' + a.priority">
                          <div class="action-header">
                            <span class="action-title">{{ a.title }}</span>
                            <span class="priority-badge" [class]="a.priority">{{ a.priority }}</span>
                          </div>
                          <p class="action-desc">{{ a.description }}</p>
                          <div class="action-owner"><mat-icon>person</mat-icon> {{ a.owner }}</div>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (ra.shortTermActions?.length) {
                  <div class="actions-section">
                    <h3><mat-icon>schedule</mat-icon> Short-Term Actions <span class="timeframe-tag">2–4 weeks</span></h3>
                    <div class="action-cards">
                      @for (a of ra.shortTermActions; track $index) {
                        <div class="action-card" [class]="'priority-' + a.priority">
                          <div class="action-header">
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
                  </div>
                }

                @if (ra.longTermActions?.length) {
                  <div class="actions-section">
                    <h3><mat-icon>trending_up</mat-icon> Long-Term Actions <span class="timeframe-tag">1–3 months</span></h3>
                    <div class="action-cards">
                      @for (a of ra.longTermActions; track $index) {
                        <div class="action-card" [class]="'priority-' + a.priority">
                          <div class="action-header">
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
                  </div>
                }

                @if (ra.preventiveMeasures?.length) {
                  <div class="actions-section">
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
                    <mat-icon>refresh</mat-icon> Regenerate
                  </button>
                </div>
              }
            </div>
          </mat-tab>

          <!-- Tab 3: Professional Review -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>rate_review</mat-icon>
              <span>Professional Review</span>
            </ng-template>
            <div class="tab-body">
              <div class="placeholder-state">
                <mat-icon>rate_review</mat-icon>
                <h3>Professional Review</h3>
                <p>
                  This section is for a qualified specialist (HR, mediator, or coach) to
                  document their independent assessment and recommendations based on
                  the AI analysis above.
                </p>
                <span class="placeholder-tag">Coming soon</span>
              </div>
            </div>
          </mat-tab>

          <!-- Tab 3: Resolution Plan -->
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

        @if (analysis()!.escalationRequested) {
          <div class="escalation-banner">
            <mat-icon>notifications_active</mat-icon>
            Escalation has been requested — HR / Coach has been notified.
          </div>
        }

        <!-- Actions bar -->
        <div class="actions-bar">
          @if (!analysis()!.escalationRequested && analysis()!.riskLevel !== 'low') {
            <button mat-stroked-button color="warn" (click)="escalate()">
              <mat-icon>escalator_warning</mat-icon> Escalate to HR
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .loading, .not-found {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 300px; gap: 12px; color: #6b7c93;
      h2 { margin: 0; color: #1B2A47; }
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #c8d3df; }
    }

    .detail-page { max-width: 80%; margin: 0 auto; padding: 0 16px 32px; }

    /* ─ Header ─ */
    .page-header {
      display: flex; align-items: flex-start; gap: 12px; padding: 16px 0 12px;
    }
    .header-content { flex: 1; min-width: 0; }
    .header-content h1 {
      margin: 0 0 6px; font-size: 22px; color: #1B2A47; font-weight: 700;
    }
    .header-meta { display: flex; flex-wrap: wrap; gap: 12px; }
    .meta-chip {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 13px; color: #5a6a7e;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #9aa5b4; }
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
    .risk-badge {
      display: inline-block; padding: 3px 12px; border-radius: 999px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
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
        font-size: 15px; font-weight: 600; color: #1B2A47; margin: 0 0 12px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #3A9FD6; }
      }
    }
    .narrative { font-size: 14px; color: #374151; line-height: 1.7; margin: 0; white-space: pre-wrap; }
    .drill-hint { font-size: 13px; color: #6b7280; margin: -4px 0 16px; line-height: 1.5; }
    .sub-analyses-list { display: flex; flex-direction: column; gap: 10px; }
    .sub-row {
      display: flex; align-items: center; gap: 14px;
      background: #f8fafc; border-radius: 10px; padding: 12px 14px;
      border-left: 4px solid #e8edf4; transition: border-color 0.2s;
      &.low      { border-left-color: #27C4A0; }
      &.medium   { border-left-color: #f0a500; }
      &.high     { border-left-color: #e86c3a; }
      &.critical { border-left-color: #e53e3e; }
    }
    .sub-left { flex-shrink: 0; .mini-gauge { width: 72px; height: 46px; display: block; } }
    .sub-center { flex: 1; min-width: 0; }
    .sub-type-label { font-size: 13px; font-weight: 600; color: #1B2A47; margin-bottom: 6px; }
    .sub-score-bar-wrap {
      background: #e8edf4; border-radius: 4px; height: 6px; margin-bottom: 6px; overflow: hidden;
      &.empty { display: flex; align-items: center; background: transparent; height: auto; }
    }
    .sub-score-bar { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
    .sub-score-bar-placeholder { font-size: 12px; color: #9aa5b4; font-style: italic; }
    .sub-narrative {
      font-size: 12px; color: #5a6a7e; line-height: 1.5;
      .narrative-toggle { color: #3A9FD6; cursor: pointer; text-decoration: none; font-weight: 500; margin-left: 2px; &:hover { text-decoration: underline; } }
    }
    .sub-right {
      flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
      .risk-badge { margin-top: 0; }
      button { display: flex; align-items: center; gap: 4px; font-size: 12px; white-space: nowrap;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
        mat-spinner { margin: 0 2px; }
      }
    }
    .script-box { background: #f8fafc; border-radius: 10px; padding: 16px; border-left: 3px solid #3A9FD6; }
    .script-text { font-family: inherit; font-size: 13px; color: #374151; line-height: 1.7; margin: 0; white-space: pre-wrap; word-break: break-word; }
    .script-sections { display: flex; flex-direction: column; gap: 12px; }
    .script-section { background: #f8fafc; border-radius: 10px; padding: 14px 16px; border-left: 3px solid #3A9FD6; }
    .script-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #3A9FD6; margin-bottom: 8px; }
    .script-para { font-size: 13px; color: #374151; line-height: 1.7; margin: 0; }
    .script-list { margin: 0; padding-left: 18px; li { font-size: 13px; color: #374151; line-height: 1.7; margin-bottom: 2px; } &.tight li { margin-bottom: 0; } }
    .topics-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th { text-align: left; padding: 6px 10px; background: #edf2f7; color: #1B2A47; font-weight: 600; font-size: 12px;
        &:first-child { border-radius: 6px 0 0 0; width: 30%; } &:last-child { border-radius: 0 6px 0 0; } }
      td { padding: 8px 10px; vertical-align: top; color: #374151; border-bottom: 1px solid #e8edf4; }
      tr:last-child td { border-bottom: none; }
      .topic-name { font-weight: 600; color: #1B2A47; }
    }

    /* ─ AI Recommended Actions tab ─ */
    .generate-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 60px 20px; text-align: center; color: #6b7c93; gap: 8px;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #c8d3df; }
      h3 { margin: 4px 0; font-size: 18px; color: #1B2A47; }
      p { max-width: 460px; line-height: 1.6; font-size: 14px; margin: 0 0 12px; }
      .gen-hint { font-size: 12px; color: #9aa5b4; }
    }
    .actions-section {
      margin-bottom: 24px;
      h3 {
        display: flex; align-items: center; gap: 6px;
        font-size: 15px; font-weight: 600; color: #1B2A47; margin: 0 0 12px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #3A9FD6; }
      }
    }
    .timeframe-tag {
      font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 999px;
      background: #eef2f7; color: #5a6a7e; margin-left: 8px;
      &.urgent { background: rgba(239, 68, 68, 0.1); color: #b91c1c; }
    }
    .action-cards { display: flex; flex-direction: column; gap: 10px; }
    .action-card {
      background: #f8fafc; border-radius: 10px; padding: 14px 16px;
      border-left: 4px solid #e8edf4;
      &.priority-high     { border-left-color: #e86c3a; }
      &.priority-medium   { border-left-color: #f0a500; }
      &.priority-low      { border-left-color: #27C4A0; }
    }
    .action-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .action-title { font-size: 14px; font-weight: 600; color: #1B2A47; flex: 1; }
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
    .preventive-list {
      margin: 0; padding-left: 20px;
      li { font-size: 14px; color: #374151; line-height: 1.7; margin-bottom: 6px; }
    }
    .regen-row { display: flex; justify-content: center; padding: 16px 0 0; }

    /* ─ Placeholder tabs ─ */
    .placeholder-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 60px 20px; text-align: center; color: #6b7c93;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #c8d3df; }
      h3 { margin: 12px 0 8px; font-size: 18px; color: #1B2A47; }
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
  `],
})
export class ConflictDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  loading = signal(true);
  analysis = signal<ConflictAnalysis | null>(null);
  subAnalyses = signal<ConflictAnalysis[]>([]);
  runningFor = signal<string | null>(null);
  expandedNarratives = signal<Set<string>>(new Set());

  // AI Recommended Actions
  recommendedActions = signal<RecommendedActions | null>(null);
  generatingActions = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }
    this.api.get<ConflictAnalysis>(`/conflict/analyses/${id}`).subscribe({
      next: (a) => {
        this.analysis.set(a);
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
      },
      error: () => this.runningFor.set(null),
    });
  }

  isNarrativeExpanded(ct: string): boolean { return this.expandedNarratives().has(ct); }

  toggleNarrative(ct: string): void {
    this.expandedNarratives.update((set) => {
      const next = new Set(set);
      next.has(ct) ? next.delete(ct) : next.add(ct);
      return next;
    });
  }

  gaugeArcFor(ct: string): string {
    const sub = this.subAnalysisFor(ct);
    if (!sub || sub.riskScore <= 0) return '';
    return this.miniGaugeArc(sub.riskScore);
  }

  miniGaugeArc(score: number): string {
    const pct = Math.min(Math.max(score, 0), 100) / 100;
    const startAngle = Math.PI;
    const endAngle = startAngle + pct * Math.PI;
    const r = 30, cx = 40, cy = 44;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 0,1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
  }

  riskColor(level: string): string {
    const map: Record<string, string> = { low: '#27C4A0', medium: '#f0a500', high: '#e86c3a', critical: '#e53e3e' };
    return map[level] ?? '#9aa5b4';
  }

  private splitWords(s: string): string {
    return s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
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

  escalate(): void {
    const a = this.analysis();
    if (!a) return;
    this.api.post(`/conflict/escalate/${a._id}`, {}).subscribe({
      next: () => {
        this.analysis.set({ ...a, escalationRequested: true });
        this.snack.open('Escalation submitted', 'OK', { duration: 3000 });
      },
      error: () => this.snack.open('Escalation failed', 'OK', { duration: 3000 }),
    });
  }
}
