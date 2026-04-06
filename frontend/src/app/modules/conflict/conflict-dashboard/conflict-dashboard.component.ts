import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { ApiService } from '../../../core/api.service';
import { ConflictAnalyzeDialogComponent } from '../conflict-analyze-dialog/conflict-analyze-dialog.component';
import { ConflictDetailDialogComponent } from '../conflict-detail-dialog/conflict-detail-dialog.component';
import { ConflictIdpDialogComponent } from '../conflict-idp-dialog/conflict-idp-dialog.component';

interface ConflictMilestone {
  _id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

interface ConflictIDP {
  _id: string;
  coacheeId: { _id: string; firstName: string; lastName: string } | string;
  goal: string;
  currentReality: string;
  options: string[];
  willDoActions: string[];
  competencyGaps: string[];
  milestones: ConflictMilestone[];
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
}

interface SurveyTemplate { _id: string; title: string; moduleType: string; }

interface ConflictAnalysis {
  _id: string;
  templateTitle?: string;
  departmentId: string;
  surveyPeriod: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  conflictTypes: string[];
  aiNarrative: string;
  managerScript: string;
  escalationRequested: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-conflict-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatExpansionModule,
    DatePipe,
  ],
  template: `
    <div class="conflict-page">

      <!-- Page header -->
      <div class="page-header">
        <div>
          <h1>Conflict Intelligence™</h1>
          <p>Proactive workplace conflict detection and resolution grounded in Helena's coaching-integrated mediation methodology</p>
        </div>
      </div>

      <!-- Module banner -->
      <div class="module-banner">
        <div class="banner-insight">
          <mat-icon class="banner-icon">lightbulb</mat-icon>
          <p><strong>Core Insight:</strong> Most workplace conflict is predictable. Warning signs appear weeks or months before a formal complaint is filed. Conflict Intelligence makes those signals visible — and actionable — for leaders who lack the training to see them.</p>
        </div>
        <div class="banner-features">
          <span class="feature-pill"><mat-icon>poll</mat-icon> Confidential Pulse Surveys</span>
          <span class="feature-pill"><mat-icon>psychology</mat-icon> AI Conflict Risk Mapping</span>
          <span class="feature-pill"><mat-icon>escalator_warning</mat-icon> Mediation Escalation</span>
          <span class="feature-pill"><mat-icon>trending_up</mat-icon> Conflict Trend Dashboard</span>
          <span class="feature-pill"><mat-icon>handshake</mat-icon> Negotiation Toolkit</span>
        </div>
      </div>

      <!-- Risk count cards + central legend -->
      <div class="summary-bar">
        <div class="risk-cards">
          @for (level of riskLevels; track level.key) {
            <div class="risk-card" [class]="'risk-card--' + level.key">
              <div class="risk-count">{{ level.count }}</div>
              <div class="risk-label">{{ level.label }}</div>
            </div>
          }
        </div>

      </div>

      <!-- Analyses list -->
      <div class="analyses-section">
        <div class="analyses-header">
          <h2>Analyses</h2>
          <span class="analyses-count">{{ analyses().length }} total</span>
          <button mat-raised-button color="primary" class="new-analysis-btn" (click)="runNewAnalysis()">
            <mat-icon>add</mat-icon> New Analysis
          </button>
        </div>

        @if (loading()) {
          <div class="loading-center"><mat-spinner diameter="36" /></div>
        } @else if (analyses().length === 0) {
          <div class="empty-state">
            <mat-icon>analytics</mat-icon>
            <p>No analyses yet. Run your first conflict analysis.</p>
            <button mat-raised-button color="primary" (click)="runNewAnalysis()">
              <mat-icon>add</mat-icon> New Analysis
            </button>
          </div>
        } @else {
          <div class="analyses-grid">
            @for (a of analyses(); track a._id) {
              <div class="analysis-card" [class]="'accent-' + a.riskLevel">
                <div class="analysis-card-top">
                  <!-- Mini gauge -->
                  <div class="mini-gauge-wrap">
                    <svg viewBox="0 0 100 60" class="mini-gauge-svg">
                      <path d="M 10 52 A 40 40 0 0 1 90 52" fill="none" stroke="#e8edf4" stroke-width="10" stroke-linecap="round"/>
                      <path [attr.d]="miniGaugeArc(a.riskScore)" fill="none"
                            [attr.stroke]="riskColor(a.riskLevel)" stroke-width="10" stroke-linecap="round"/>
                      <text x="50" y="48" text-anchor="middle" class="mini-score">{{ a.riskScore }}</text>
                    </svg>
                    <span class="risk-badge" [class]="a.riskLevel">{{ a.riskLevel }}</span>
                  </div>

                  <!-- Meta -->
                  <div class="analysis-meta">
                    <div class="meta-dept">
                      <mat-icon>corporate_fare</mat-icon>
                      <strong>{{ a.departmentId || 'All Departments' }}</strong>
                    </div>
                    <div class="meta-period">
                      <mat-icon>calendar_today</mat-icon>
                      {{ a.surveyPeriod }}
                    </div>
                    @if (a.templateTitle) {
                      <div class="meta-template">
                        <mat-icon>assignment</mat-icon>
                        <span>{{ a.templateTitle }}</span>
                      </div>
                    }
                    @if (a.escalationRequested) {
                      <span class="escalated-badge">
                        <mat-icon>gavel</mat-icon> Escalated
                      </span>
                    }
                  </div>

                  <!-- Delete -->
                  <button mat-icon-button class="delete-analysis-btn"
                          matTooltip="Delete analysis"
                          (click)="deleteAnalysis(a); $event.stopPropagation()">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>

                <!-- Conflict types -->
                @if (a.conflictTypes.length) {
                  <div class="type-chips">
                    @for (t of a.conflictTypes; track t) {
                      <span class="type-chip">{{ t }}</span>
                    }
                  </div>
                }

                <!-- Actions -->
                <div class="analysis-card-actions">
                  <button mat-stroked-button (click)="viewAnalysis(a)">
                    <mat-icon>open_in_new</mat-icon> View Details
                  </button>
                  @if (!a.escalationRequested && (a.riskLevel === 'high' || a.riskLevel === 'critical')) {
                    <button mat-stroked-button color="warn" (click)="escalate(a._id)">
                      <mat-icon>escalator_warning</mat-icon> Escalate
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Mediation Escalation Pathway -->
      <div class="section-card escalation-pathway">
        <div class="section-header">
          <div class="section-icon red"><mat-icon>escalator_warning</mat-icon></div>
          <div>
            <h3>Mediation Escalation Pathway</h3>
            <p>When coaching guides are insufficient, escalate directly to Helena's professional mediation services — coaching-integrated, interest-based, and designed to preserve relationships.</p>
          </div>
        </div>
        <div class="escalation-steps">
          <div class="escalation-step">
            <div class="step-num">1</div>
            <div class="step-content">
              <strong>Flag for Escalation</strong>
              <span>Click "Escalate" on any high or critical risk analysis. HR is notified immediately.</span>
            </div>
          </div>
          <div class="escalation-step">
            <div class="step-num">2</div>
            <div class="step-content">
              <strong>Initial Consultation</strong>
              <span>Helena reviews the AI analysis and conducts a 30-min intake with the HR contact to understand context.</span>
            </div>
          </div>
          <div class="escalation-step">
            <div class="step-num">3</div>
            <div class="step-content">
              <strong>Mediation Process</strong>
              <span>Interest-based negotiation session facilitated by Helena — focuses on underlying needs, not positions.</span>
            </div>
          </div>
          <div class="escalation-step">
            <div class="step-num">4</div>
            <div class="step-content">
              <strong>Resolution & Follow-up</strong>
              <span>Agreement documented, follow-up pulse survey scheduled to verify resolution at 30 and 60 days.</span>
            </div>
          </div>
        </div>
        <a href="mailto:helena@helenacoaching.com?subject=Mediation%20Escalation%20Request"
           mat-stroked-button class="escalation-cta">
          <mat-icon>email</mat-icon> Contact Helena for Mediation
        </a>
      </div>

      <!-- Skill Development — Conflict IDPs -->
      <div class="section-card skill-dev">
        <div class="section-header">
          <div class="section-icon purple"><mat-icon>psychology</mat-icon></div>
          <div>
            <h3>Skill Development Plans</h3>
            <p>Generate AI-powered Individual Development Plans (IDPs) based on conflict analysis findings — targeted skill building using the GROW model.</p>
          </div>
          @if (analyses().length > 0) {
            <button mat-raised-button color="primary" class="section-action-btn" (click)="openConflictIdpDialog()">
              <mat-icon>add_circle</mat-icon> Generate Conflict IDP
            </button>
          }
        </div>

        @if (conflictIdpsLoading()) {
          <div class="loading-center" style="padding: 24px"><mat-spinner diameter="28" /></div>
        } @else if (conflictIdps().length === 0) {
          <div class="skill-empty">
            <mat-icon>psychology</mat-icon>
            <p>No conflict-based development plans yet. Run an analysis first, then generate a targeted IDP for team members.</p>
          </div>
        } @else {
          <div class="idp-grid">
            @for (idp of conflictIdps(); track idp._id) {
              <div class="idp-card" [class]="'status-' + idp.status">
                <div class="idp-card-header">
                  <div class="idp-status-badge" [class]="idp.status">{{ idp.status }}</div>
                  @if (isPopulatedCoachee(idp.coacheeId)) {
                    <span class="idp-coachee-name">
                      <mat-icon class="coachee-icon">person</mat-icon>
                      {{ idp.coacheeId.firstName }} {{ idp.coacheeId.lastName }}
                    </span>
                  }
                  <span class="idp-date-label">{{ idp.createdAt | date:'MMM d, y' }}</span>
                  <button class="card-action-btn delete-btn"
                          matTooltip="Delete IDP"
                          (click)="deleteConflictIdp(idp)">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>

                <!-- GROW sections -->
                <mat-accordion class="grow-accordion">
                  <mat-expansion-panel class="grow-panel goal-panel">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon>flag</mat-icon> Goal
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <p>{{ idp.goal }}</p>
                  </mat-expansion-panel>

                  <mat-expansion-panel class="grow-panel reality-panel">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon>explore</mat-icon> Reality
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <p>{{ idp.currentReality }}</p>
                  </mat-expansion-panel>

                  <mat-expansion-panel class="grow-panel options-panel">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon>lightbulb</mat-icon> Options ({{ idp.options.length }})
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <ul>
                      @for (opt of idp.options; track opt) {
                        <li>{{ opt }}</li>
                      }
                    </ul>
                  </mat-expansion-panel>

                  <mat-expansion-panel class="grow-panel will-panel">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon>bolt</mat-icon> Will Do ({{ idp.willDoActions.length }})
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <ul>
                      @for (action of idp.willDoActions; track action) {
                        <li>{{ action }}</li>
                      }
                    </ul>
                  </mat-expansion-panel>
                </mat-accordion>

                <!-- Milestone timeline -->
                <div class="milestone-section">
                  <h4>Milestones</h4>
                  <div class="milestone-timeline">
                    @for (ms of idp.milestones; track ms._id) {
                      <div class="milestone-item" [class]="ms.status">
                        <div class="ms-dot"></div>
                        <div class="ms-content">
                          <span class="ms-title">{{ ms.title }}</span>
                          <span class="ms-date">{{ ms.dueDate | date:'MMM d' }}</span>
                        </div>
                        <div class="ms-actions">
                          @if (ms.status !== 'completed') {
                            <button mat-icon-button [matTooltip]="'Mark complete'"
                                    (click)="updateConflictMilestone(idp._id, ms._id, 'completed')">
                              <mat-icon>check_circle_outline</mat-icon>
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <!-- Conflict areas -->
                @if (idp.competencyGaps.length) {
                  <mat-expansion-panel class="grow-panel conflict-areas-panel">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon>warning_amber</mat-icon> Conflict Areas ({{ idp.competencyGaps.length }})
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <ul>
                      @for (gap of idp.competencyGaps; track gap) {
                        <li>{{ gap }}</li>
                      }
                    </ul>
                  </mat-expansion-panel>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Knowledge & Skill Building -->
      <div class="section-card knowledge">
        <div class="section-header">
          <div class="section-icon blue"><mat-icon>school</mat-icon></div>
          <div>
            <h3>Knowledge &amp; Skill Building</h3>
            <p>Structured learning paths to build conflict literacy, emotional intelligence, and leadership capability — drawing on tools available within this platform and leading external assessments.</p>
          </div>
        </div>

        <div class="edu-columns">

          <!-- In-platform -->
          <div class="edu-col">
            <div class="edu-col-label"><mat-icon>layers</mat-icon> In-Platform Modules</div>
            @for (item of inPlatformPaths; track item.route) {
              <a class="edu-card internal" [routerLink]="item.route">
                <div class="edu-icon" [style.background]="item.color + '18'" [style.color]="item.color">
                  <mat-icon>{{ item.icon }}</mat-icon>
                </div>
                <div class="edu-info">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.description }}</span>
                </div>
                <mat-icon class="edu-arrow">chevron_right</mat-icon>
              </a>
            }
          </div>

          <!-- External tools -->
          <div class="edu-col">
            <div class="edu-col-label"><mat-icon>open_in_new</mat-icon> External Assessments &amp; Tools</div>
            @for (item of externalTools; track item.url) {
              <a class="edu-card external" [href]="item.url" target="_blank" rel="noopener">
                <div class="edu-icon" [style.background]="item.color + '18'" [style.color]="item.color">
                  <mat-icon>{{ item.icon }}</mat-icon>
                </div>
                <div class="edu-info">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.description }}</span>
                </div>
                <mat-icon class="edu-arrow">open_in_new</mat-icon>
              </a>
            }
          </div>

        </div>
      </div>

      <!-- Interest-Based Negotiation Toolkit -->
      <div class="section-card toolkit">
        <div class="section-header">
          <div class="section-icon green"><mat-icon>handshake</mat-icon></div>
          <div>
            <h3>Interest-Based Negotiation Toolkit</h3>
            <p>Downloadable frameworks and guided exercises for self-directed conflict resolution, based on Helena's methodology.</p>
          </div>
        </div>
        <div class="toolkit-grid">
          @for (resource of toolkitResources; track resource.title) {
            <div class="toolkit-card">
              <div class="toolkit-icon" [style.background]="resource.color + '18'" [style.color]="resource.color">
                <mat-icon>{{ resource.icon }}</mat-icon>
              </div>
              <div class="toolkit-info">
                <strong>{{ resource.title }}</strong>
                <span>{{ resource.description }}</span>
              </div>
              <button mat-icon-button [matTooltip]="'Download ' + resource.title" class="download-btn">
                <mat-icon>download</mat-icon>
              </button>
            </div>
          }
        </div>
      </div>

    </div>
  `,
  styles: [`
    .conflict-page { padding: 32px; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px;
      h1 { font-size: 28px; color: #1B2A47; margin: 0 0 4px; }
      p  { color: #5a6a7e; margin: 0; max-width: 700px; }
    }

    /* ── Banner ──────────────────────────────────── */
    .module-banner {
      background: linear-gradient(135deg, #1B2A47 0%, #243558 100%);
      border-radius: 16px; padding: 24px 28px; margin-bottom: 24px; color: white;
    }
    .banner-insight {
      display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px;
      .banner-icon { color: #f0c040; font-size: 22px; flex-shrink: 0; margin-top: 2px; }
      p { font-size: 13.5px; color: rgba(255,255,255,0.88); line-height: 1.7; margin: 0; }
      strong { color: white; }
    }
    .banner-features { display: flex; flex-wrap: wrap; gap: 8px; }
    .feature-pill {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 12px; background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.18); border-radius: 20px;
      font-size: 12px; color: rgba(255,255,255,0.9);
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    /* ── Summary bar ─────────────────────────────── */
    .summary-bar {
      display: flex; gap: 20px; align-items: stretch; margin-bottom: 24px;
    }

    .risk-cards {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; flex: 1;
    }
    .risk-card {
      background: white; border-radius: 12px; padding: 16px 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-left: 4px solid transparent;
      text-align: center;
      .risk-count { font-size: 32px; font-weight: 700; color: #1B2A47; line-height: 1; }
      .risk-label { font-size: 11px; color: #5a6a7e; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.4px; }
    }
    .risk-card--low      { border-color: #27C4A0; .risk-count { color: #27C4A0; } }
    .risk-card--medium   { border-color: #f0a500; .risk-count { color: #f0a500; } }
    .risk-card--high     { border-color: #e86c3a; .risk-count { color: #e86c3a; } }
    .risk-card--critical { border-color: #e53e3e; .risk-count { color: #e53e3e; } }

    /* Gauge + legend */
    .gauge-mini-wrap {
      background: white; border-radius: 12px; padding: 14px 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; flex-shrink: 0;
    }
    .gauge-svg {
      width: 120px;
      .gauge-score { font-size: 22px; font-weight: 700; fill: #1B2A47; }
      .gauge-label-txt { font-size: 8px; fill: #9aa5b4; }
    }
    .gauge-arc { transition: all 0.4s ease; }

    /* Central risk legend */
    .risk-legend-central {
      display: grid; grid-template-columns: auto auto auto auto;
      align-items: center; gap: 3px 6px;
      font-size: 10px; color: #5a6a7e;
    }
    .legend-dot {
      width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
      &.low      { background: #27C4A0; }
      &.medium   { background: #f0a500; }
      &.high     { background: #e86c3a; }
      &.critical { background: #e53e3e; }
    }
    .legend-txt { }

    /* ── Analyses list ────────────────────────────── */
    .analyses-section {
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 24px;
    }
    .analyses-header {
      display: flex; align-items: center; gap: 10px;
      padding: 18px 24px; border-bottom: 1px solid #f0f4f8;
      h2 { font-size: 16px; color: #1B2A47; margin: 0; font-weight: 700; }
      .analyses-count {
        font-size: 12px; background: #f0f4f8; color: #5a6a7e;
        padding: 2px 9px; border-radius: 999px;
      }
      .new-analysis-btn { margin-left: auto; }
    }
    .loading-center { display: flex; justify-content: center; padding: 48px; }
    .empty-state {
      text-align: center; padding: 48px; color: #9aa5b4;
      mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; display: block; }
      p { font-size: 14px; margin-bottom: 20px; }
    }

    .analyses-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 16px; padding: 16px 20px 20px;
    }

    .analysis-card {
      background: white;
      border: 1px solid #e8edf4;
      border-radius: 14px;
      padding: 18px;
      border-left: 4px solid transparent;
      transition: box-shadow 0.15s, border-color 0.15s;
      display: flex; flex-direction: column; gap: 12px;
      &:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
      &.accent-low      { border-left-color: #27C4A0; }
      &.accent-medium   { border-left-color: #f0a500; }
      &.accent-high     { border-left-color: #e86c3a; }
      &.accent-critical { border-left-color: #e53e3e; }
    }

    .analysis-card-top {
      display: flex; align-items: flex-start; gap: 16px;
    }

    /* Mini gauge */
    .mini-gauge-wrap {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
    }
    .mini-gauge-svg {
      width: 80px;
      .mini-score { font-size: 18px; font-weight: 700; fill: #1B2A47; }
    }
    .risk-badge {
      padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.3px;
      &.low      { background: rgba(39,196,160,0.15); color: #1a9678; }
      &.medium   { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.high     { background: rgba(232,108,58,0.15); color: #c04a14; }
      &.critical { background: rgba(229,62,62,0.15);  color: #c53030; }
    }

    /* Analysis meta */
    .analysis-meta {
      display: flex; flex-direction: column; gap: 5px; min-width: 0;
    }
    .meta-template {
      display: flex; align-items: center; gap: 5px; font-size: 12px; color: #3A9FD6;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .meta-dept, .meta-period {
      display: flex; align-items: center; gap: 5px; font-size: 13px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #9aa5b4; }
      strong { color: #1B2A47; }
    }
    .meta-period { color: #5a6a7e; }
    .type-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
    .type-chip {
      padding: 2px 8px; border-radius: 4px;
      font-size: 10px; font-weight: 600; text-transform: capitalize;
      background: #eef2f7; color: #4a5568;
    }
    .escalated-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; color: #e86c3a; font-weight: 600;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    /* Actions */
    .analysis-card-actions {
      display: flex; gap: 8px; padding-top: 4px; border-top: 1px solid #f0f4f8;
    }
    .delete-analysis-btn {
      color: #c5d0db; width: 28px; height: 28px; margin-left: auto; flex-shrink: 0;
      &:hover { color: #e53e3e !important; }
    }

    /* section-card, section-header, section-icon — from global styles.scss */

    /* Escalation */
    .escalation-steps {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px;
    }
    .escalation-step {
      display: flex; gap: 14px; align-items: flex-start;
      background: #fef7f5; border: 1px solid #fce0d4; border-radius: 10px; padding: 14px 16px;
    }
    .step-num {
      width: 28px; height: 28px; background: #e53e3e; color: white;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
    }
    .step-content {
      display: flex; flex-direction: column; gap: 3px;
      strong { font-size: 13px; color: #1B2A47; }
      span   { font-size: 12px; color: #5a6a7e; line-height: 1.5; }
    }
    .escalation-cta { color: #e53e3e; border-color: #e53e3e; }

    /* Toolkit */
    .toolkit-grid { display: flex; flex-direction: column; gap: 10px; }
    .toolkit-card {
      display: flex; align-items: center; gap: 14px; padding: 14px 16px;
      border: 1px solid #e8edf4; border-radius: 10px; background: #fafbfc;
      transition: background 0.15s;
      &:hover { background: #f0f4f8; }
    }
    .toolkit-icon {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 20px; }
    }
    .toolkit-info {
      flex: 1; display: flex; flex-direction: column; gap: 2px;
      strong { font-size: 13px; color: #1B2A47; }
      span   { font-size: 12px; color: #5a6a7e; }
    }
    .download-btn { color: #3A9FD6; }

    /* ── Skill Development — component-specific only ── */
    .section-action-btn { margin-left: auto; flex-shrink: 0; }

    .skill-empty {
      display: flex; align-items: center; gap: 12px; padding: 24px;
      color: #9aa5b4; font-size: 14px;
      mat-icon { font-size: 24px; width: 24px; height: 24px; color: #c5d0db; }
      p { margin: 0; }
    }

    /* IDP cards, GROW panels, milestones — from global styles.scss */

    /* ── Knowledge & Skill Building ──────────────── */
    .section-icon.blue { background: rgba(58,159,214,0.12); color: #2080b0; }

    .edu-columns {
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    }

    .edu-col-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.7px; color: #9aa5b4; margin-bottom: 10px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }

    .edu-card {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border-radius: 10px; margin-bottom: 8px;
      border: 1px solid #e8edf4; text-decoration: none; cursor: pointer;
      transition: background 0.13s, border-color 0.13s;
      &:last-child { margin-bottom: 0; }
      &:hover { background: #f0f8ff; border-color: #3A9FD6; }
      &.internal { background: #fafbfc; }
      &.external { background: #fafbfc; }
    }

    .edu-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 20px; }
    }

    .edu-info {
      flex: 1; min-width: 0;
      strong { display: block; font-size: 13px; color: #1B2A47; margin-bottom: 2px; }
      span   { font-size: 11px; color: #6b7280; line-height: 1.4; display: block; }
    }

    .edu-arrow {
      color: #c4cdd6; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0;
      .edu-card:hover & { color: #3A9FD6; }
    }
  `],
})
export class ConflictDashboardComponent implements OnInit {
  analyses = signal<ConflictAnalysis[]>([]);
  loading = signal(true);
  surveyTemplateId = signal('');

  riskLevels = [
    { key: 'low',      label: 'Low Risk',    count: 0 },
    { key: 'medium',   label: 'Medium Risk', count: 0 },
    { key: 'high',     label: 'High Risk',   count: 0 },
    { key: 'critical', label: 'Critical',    count: 0 },
  ];

  avgRiskScore = signal(0);

  toolkitResources = [
    { title: 'Positions vs. Interests Framework', description: 'Identify underlying needs behind stated positions to find creative solutions both parties can accept.', icon: 'compare_arrows', color: '#3A9FD6' },
    { title: 'Interest Mapping Worksheet', description: "Guided exercise to map each party's interests before entering a difficult conversation.", icon: 'account_tree', color: '#27C4A0' },
    { title: 'Conflict Type Diagnostic', description: 'Determine whether conflict is interpersonal, structural, cultural, or positional to choose the right intervention.', icon: 'category', color: '#e86c3a' },
    { title: 'Manager Conversation Planner', description: 'Step-by-step guide for preparing and facilitating a conflict conversation using GROW methodology.', icon: 'edit_note', color: '#7c3aed' },
  ];

  inPlatformPaths = [
    {
      route: '/neuroinclusion',
      title: 'Neuro-Inclusion Assessment',
      description: 'Identify neuroinclusion gaps that often underlie perceived conflict — communication style mismatches, sensory overload, and cognitive diversity barriers.',
      icon: 'psychology',
      color: '#27C4A0',
    },
    {
      route: '/succession',
      title: 'Leadership IDP (GROW Model)',
      description: 'Build individual development plans using the GROW coaching model to strengthen self-awareness and conflict-resilient leadership behaviours.',
      icon: 'trending_up',
      color: '#3A9FD6',
    },
    {
      route: '/coach/interview',
      title: 'Coach-Led Interview',
      description: 'Conduct structured one-to-one or group intake interviews to surface unspoken tensions before they escalate.',
      icon: 'record_voice_over',
      color: '#7c3aed',
    },
  ];

  externalTools = [
    {
      url: 'https://cad.storefront.mhs.com/collections/eq-i-2-0/',
      title: 'MHS EQ-i 2.0',
      description: "The world's leading emotional intelligence assessment. Measure self-awareness, empathy, and stress tolerance — core competencies for conflict-resilient teams.",
      icon: 'insights',
      color: '#e86c3a',
    },
    {
      url: 'https://cad.storefront.mhs.com/collections/eq-360/',
      title: 'MHS EQ 360',
      description: 'Multi-rater emotional intelligence feedback to reveal blind spots and strengthen leadership effectiveness in high-conflict environments.',
      icon: '360',
      color: '#f0a500',
    },
    {
      url: 'https://www.themyersbriggs.com/en-US/Products-and-Services/Myers-Briggs',
      title: 'MBTI Assessment',
      description: 'Understand personality type differences that drive communication friction and team conflict — foundational for mediation and coaching.',
      icon: 'people_alt',
      color: '#1B2A47',
    },
    {
      url: 'https://www.viacharacter.org/',
      title: 'VIA Character Strengths',
      description: 'Free evidence-based strengths profiling. Reframe conflict conversations around what each person brings rather than what divides them.',
      icon: 'star_outline',
      color: '#27C4A0',
    },
  ];

  // ── Conflict IDPs ──────────────────────────────────────────────
  conflictIdps = signal<ConflictIDP[]>([]);
  conflictIdpsLoading = signal(true);

  idpCoacheeName(idp: ConflictIDP): string {
    if (typeof idp.coacheeId === 'object') {
      return `${idp.coacheeId.firstName} ${idp.coacheeId.lastName}`;
    }
    return 'Unknown';
  }

  idpMilestonesDone(idp: ConflictIDP): number {
    return idp.milestones.filter((m) => m.status === 'completed').length;
  }

  loadConflictIdps(): void {
    this.conflictIdpsLoading.set(true);
    this.api.get<ConflictIDP[]>('/succession/idps?module=conflict').subscribe({
      next: (idps) => { this.conflictIdps.set(idps); this.conflictIdpsLoading.set(false); },
      error: () => this.conflictIdpsLoading.set(false),
    });
  }

  isPopulatedCoachee(coacheeId: ConflictIDP['coacheeId']): coacheeId is { _id: string; firstName: string; lastName: string } {
    return typeof coacheeId === 'object' && coacheeId !== null;
  }

  updateConflictMilestone(idpId: string, milestoneId: string, status: string): void {
    this.api.put(`/succession/idps/${idpId}/milestone`, { milestoneId, status }).subscribe({
      next: () => this.loadConflictIdps(),
    });
  }

  deleteConflictIdp(idp: ConflictIDP): void {
    if (!confirm(`Delete this development plan for ${this.idpCoacheeName(idp)}?`)) return;
    this.api.delete(`/succession/idps/${idp._id}`).subscribe({
      next: () => {
        this.conflictIdps.update((list) => list.filter((i) => i._id !== idp._id));
        this.snackBar.open('Development plan deleted', 'OK', { duration: 3000 });
      },
    });
  }

  openConflictIdpDialog(): void {
    const ref = this.dialog.open(ConflictIdpDialogComponent, {
      width: '560px',
      disableClose: true,
      data: { analyses: this.analyses() },
    });
    ref.afterClosed().subscribe((result) => {
      if (result) this.loadConflictIdps();
    });
  }

  riskColor(level: string): string {
    const map: Record<string, string> = { low: '#27C4A0', medium: '#f0a500', high: '#e86c3a', critical: '#e53e3e' };
    return map[level] ?? '#9aa5b4';
  }

  miniGaugeArc(score: number): string {
    if (score <= 0) return '';
    const angle = (score / 100) * Math.PI;
    const x = (50 - 40 * Math.cos(angle)).toFixed(2);
    const y = (52 - 40 * Math.sin(angle)).toFixed(2);
    return `M 10 52 A 40 40 0 0 1 ${x} ${y}`;
  }

  gaugeColor(): string { return this.riskColor(this.avgLevel()); }

  gaugeArcPath(): string {
    const score = this.avgRiskScore();
    if (score <= 0) return '';
    const angle = (score / 100) * Math.PI;
    const x = (80 - 64 * Math.cos(angle)).toFixed(2);
    const y = (80 - 64 * Math.sin(angle)).toFixed(2);
    return `M 16 80 A 64 64 0 0 1 ${x} ${y}`;
  }

  private avgLevel(): string {
    const s = this.avgRiskScore();
    if (s <= 25) return 'low';
    if (s <= 50) return 'medium';
    if (s <= 75) return 'high';
    return 'critical';
  }

  constructor(private api: ApiService, private dialog: MatDialog, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.api.get<SurveyTemplate[]>('/surveys/templates').subscribe({
      next: (templates) => {
        const first = templates.find((t) => t.moduleType === 'conflict');
        if (first) this.surveyTemplateId.set(first._id);
      },
    });
    this.loadAnalyses();
    this.loadConflictIdps();
  }

  loadAnalyses(): void {
    this.loading.set(true);
    this.api.get<ConflictAnalysis[]>('/conflict/analyses').subscribe({
      next: (data) => {
        // Only show top-level analyses (no parentId)
        const topLevel = data.filter((a: any) => !a.parentId);
        this.analyses.set(topLevel);
        this.updateStats(topLevel);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  updateStats(data: ConflictAnalysis[]): void {
    this.riskLevels.forEach((l) => {
      l.count = data.filter((a) => a.riskLevel === l.key).length;
    });
    const avg = data.length
      ? Math.round(data.reduce((s, a) => s + a.riskScore, 0) / data.length)
      : 0;
    this.avgRiskScore.set(avg);
  }

  viewAnalysis(analysis: ConflictAnalysis): void {
    const ref = this.dialog.open(ConflictDetailDialogComponent, {
      width: '860px',
      maxHeight: '92vh',
      data: analysis,
    });
    ref.afterClosed().subscribe((result) => {
      if (result?.action === 'escalate') this.escalate(result.id);
    });
  }

  escalate(id: string): void {
    this.api.post(`/conflict/escalate/${id}`, {}).subscribe({
      next: () => this.loadAnalyses(),
    });
  }

  deleteAnalysis(analysis: ConflictAnalysis): void {
    if (!confirm(`Delete analysis for "${analysis.departmentId || 'All Departments'}" (${analysis.surveyPeriod})? This will also delete all sub-analyses.`)) return;
    this.api.delete(`/conflict/analyses/${analysis._id}`).subscribe({
      next: () => {
        this.analyses.update((list) => list.filter((a) => a._id !== analysis._id));
        this.updateStats(this.analyses());
        this.snackBar.open('Analysis deleted', 'OK', { duration: 3000 });
      },
    });
  }

  runNewAnalysis(): void {
    const ref = this.dialog.open(ConflictAnalyzeDialogComponent, {
      width: '560px',
      disableClose: true,
    });
    ref.afterClosed().subscribe((result) => { if (result) this.loadAnalyses(); });
  }

  parseScript(raw: string): Array<{ section: string; text: string }> {
    try {
      const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end   = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1) return [];
      const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      return Object.entries(obj)
        .filter(([, v]) => typeof v === 'string' && (v as string).trim().length > 0)
        .map(([k, v]) => ({
          section: k
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
            .replace(/[_\-]+/g, ' ')
            .replace(/\s+/g, ' ').trim()
            .replace(/^./, (c) => c.toUpperCase()),
          text: (v as string).trim(),
        }));
    } catch { return []; }
  }
}
