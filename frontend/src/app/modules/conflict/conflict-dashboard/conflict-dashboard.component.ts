import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';
import { ConflictAnalyzeDialogComponent } from '../conflict-analyze-dialog/conflict-analyze-dialog.component';
import { ConflictDetailDialogComponent } from '../conflict-detail-dialog/conflict-detail-dialog.component';

interface SurveyTemplate { _id: string; title: string; moduleType: string; }

interface ConflictAnalysis {
  _id: string;
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
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  template: `
    <div class="conflict-page">
      <div class="page-header">
        <div>
          <h1>Conflict Intelligence™</h1>
          <p>Proactive workplace conflict detection and resolution grounded in Helena's coaching-integrated mediation methodology</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button (click)="copySurveyLink()" [disabled]="!surveyTemplateId()">
            <mat-icon>link</mat-icon> Copy Survey Link
          </button>
          <button mat-raised-button color="primary" (click)="runNewAnalysis()">
            <mat-icon>add</mat-icon> New Analysis
          </button>
        </div>
      </div>

      <!-- Module description banner -->
      <div class="module-banner">
        <div class="banner-insight">
          <mat-icon class="banner-icon">lightbulb</mat-icon>
          <p><strong>Core Insight:</strong> Most workplace conflict is predictable. Warning signs appear weeks or months before a formal complaint is filed. Conflict Intelligence makes those signals visible — and actionable — for leaders who lack the training to see them.</p>
        </div>
        <div class="banner-features">
          <span class="feature-pill"><mat-icon>poll</mat-icon> Confidential Pulse Surveys</span>
          <span class="feature-pill"><mat-icon>psychology</mat-icon> AI Conflict Risk Mapping</span>
          <span class="feature-pill"><mat-icon>record_voice_over</mat-icon> Manager Coaching Guides</span>
          <span class="feature-pill"><mat-icon>escalator_warning</mat-icon> Mediation Escalation</span>
          <span class="feature-pill"><mat-icon>trending_up</mat-icon> Conflict Trend Dashboard</span>
          <span class="feature-pill"><mat-icon>handshake</mat-icon> Negotiation Toolkit</span>
        </div>
      </div>

      <!-- Risk overview cards -->
      <div class="risk-overview">
        @for (level of riskLevels; track level.key) {
          <div class="risk-card" [class]="'risk-card--' + level.key">
            <div class="risk-count">{{ level.count }}</div>
            <div class="risk-label">{{ level.label }}</div>
          </div>
        }
      </div>

      <!-- Gauge + summary -->
      <div class="analysis-grid">
        <div class="gauge-card">
          <h3>Overall Organization Risk</h3>
          <div class="gauge-container">
            <svg viewBox="0 0 200 120" class="gauge-svg">
              <!-- Background arc -->
              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e8edf4" stroke-width="16" stroke-linecap="round"/>
              <!-- Risk arc -->
              <path
                [attr.d]="gaugeArcPath()"
                fill="none"
                [attr.stroke]="gaugeColor()"
                stroke-width="16"
                stroke-linecap="round"
                class="gauge-arc"
              />
              <!-- Score text -->
              <text x="100" y="90" text-anchor="middle" class="gauge-score">{{ avgRiskScore() }}</text>
              <text x="100" y="110" text-anchor="middle" class="gauge-label">Avg Risk Score</text>
            </svg>
          </div>
          <div class="risk-legend">
            <span class="legend-item low">Low 0-25</span>
            <span class="legend-item medium">Medium 26-50</span>
            <span class="legend-item high">High 51-75</span>
            <span class="legend-item critical">Critical 76-100</span>
          </div>
        </div>

        <div class="dept-heatmap">
          <h3>Department Heatmap</h3>
          @if (loading()) {
            <div class="loading-center"><mat-spinner diameter="32" /></div>
          } @else if (analyses().length === 0) {
            <div class="empty-state">
              <mat-icon>analytics</mat-icon>
              <p>No analyses yet. Run your first conflict analysis.</p>
            </div>
          } @else {
            <table mat-table [dataSource]="analyses()" class="heatmap-table">
              <ng-container matColumnDef="department">
                <th mat-header-cell *matHeaderCellDef>Department</th>
                <td mat-cell *matCellDef="let row">{{ row.departmentId || 'All' }}</td>
              </ng-container>
              <ng-container matColumnDef="period">
                <th mat-header-cell *matHeaderCellDef>Period</th>
                <td mat-cell *matCellDef="let row">{{ row.surveyPeriod }}</td>
              </ng-container>
              <ng-container matColumnDef="score">
                <th mat-header-cell *matHeaderCellDef>Risk Score</th>
                <td mat-cell *matCellDef="let row">
                  <div class="score-bar">
                    <div class="score-fill" [class]="row.riskLevel" [style.width.%]="row.riskScore"></div>
                    <span>{{ row.riskScore }}</span>
                  </div>
                </td>
              </ng-container>
              <ng-container matColumnDef="level">
                <th mat-header-cell *matHeaderCellDef>Risk Level</th>
                <td mat-cell *matCellDef="let row">
                  <span class="risk-badge" [class]="row.riskLevel">{{ row.riskLevel }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="types">
                <th mat-header-cell *matHeaderCellDef>Conflict Types</th>
                <td mat-cell *matCellDef="let row">
                  <div class="type-chips">
                    @for (t of row.conflictTypes; track t) {
                      <span class="type-chip">{{ t }}</span>
                    }
                  </div>
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let row">
                  <button mat-button (click)="viewAnalysis(row._id)">View</button>
                  @if (!row.escalationRequested && row.riskLevel !== 'low') {
                    <button mat-button color="warn" (click)="escalate(row._id)">Escalate</button>
                  }
                  @if (row.escalationRequested) {
                    <span class="escalated-badge"><mat-icon>gavel</mat-icon> Escalated</span>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          }
        </div>
      </div>

      <!-- Manager Coaching Guides -->
      @if (highRiskAnalyses().length > 0) {
        <div class="section-card coaching-guides">
          <div class="section-header">
            <div class="section-icon orange">
              <mat-icon>record_voice_over</mat-icon>
            </div>
            <div>
              <h3>Manager Coaching Guides</h3>
              <p>AI-generated conversation scripts tailored to detected conflict signals. Use these to open productive dialogue before situations escalate.</p>
            </div>
          </div>
          @for (analysis of highRiskAnalyses(); track analysis._id) {
            <div class="coaching-guide-item">
              <div class="guide-header">
                <span class="risk-badge" [class]="analysis.riskLevel">{{ analysis.riskLevel }}</span>
                <span class="guide-dept">{{ analysis.departmentId || 'Organization-wide' }}</span>
                <span class="guide-period">{{ analysis.surveyPeriod }}</span>
                <div class="type-chips">
                  @for (t of analysis.conflictTypes; track t) {
                    <span class="type-chip">{{ t }}</span>
                  }
                </div>
              </div>
              @if (analysis.managerScript) {
                <div class="guide-script">
                  <p class="script-label"><mat-icon>chat_bubble_outline</mat-icon> Suggested conversation guide:</p>
                  @if (parseScript(analysis.managerScript).length > 0) {
                    <table class="script-table">
                      @for (row of parseScript(analysis.managerScript); track row.section) {
                        <tr>
                          <td class="script-section">{{ row.section }}</td>
                          <td class="script-text">{{ row.text }}</td>
                        </tr>
                      }
                    </table>
                  } @else {
                    <blockquote>{{ analysis.managerScript }}</blockquote>
                  }
                </div>
              }
              @if (analysis.aiNarrative) {
                <div class="guide-narrative">
                  <p>{{ analysis.aiNarrative }}</p>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Mediation Escalation Pathway -->
      <div class="section-card escalation-pathway">
        <div class="section-header">
          <div class="section-icon red">
            <mat-icon>escalator_warning</mat-icon>
          </div>
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

      <!-- Interest-Based Negotiation Toolkit -->
      <div class="section-card toolkit">
        <div class="section-header">
          <div class="section-icon green">
            <mat-icon>handshake</mat-icon>
          </div>
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
      p  { color: #5a6a7e; margin: 0; }
    }

    .risk-overview {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .risk-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      border-left: 4px solid transparent;

      .risk-count { font-size: 36px; font-weight: 700; color: #1B2A47; }
      .risk-label { font-size: 13px; color: #5a6a7e; margin-top: 4px; }
    }

    .risk-card--low      { border-color: #27C4A0; .risk-count { color: #27C4A0; } }
    .risk-card--medium   { border-color: #f0a500; .risk-count { color: #f0a500; } }
    .risk-card--high     { border-color: #e86c3a; .risk-count { color: #e86c3a; } }
    .risk-card--critical { border-color: #e53e3e; .risk-count { color: #e53e3e; } }

    .analysis-grid {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 20px;
    }

    .gauge-card, .dept-heatmap {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      h3 { font-size: 16px; color: #1B2A47; margin-bottom: 16px; }
    }

    .gauge-svg {
      width: 100%;
      .gauge-score { font-size: 28px; font-weight: 700; fill: #1B2A47; }
      .gauge-label { font-size: 10px; fill: #9aa5b4; }
    }

    .risk-legend {
      display: flex; flex-direction: column; gap: 6px; margin-top: 12px;
      .legend-item {
        font-size: 11px; padding: 3px 8px; border-radius: 4px;
        &.low      { background: rgba(39,196,160,0.15); color: #1a9678; }
        &.medium   { background: rgba(240,165,0,0.15);  color: #b07800; }
        &.high     { background: rgba(232,108,58,0.15); color: #c04a14; }
        &.critical { background: rgba(229,62,62,0.15);  color: #c53030; }
      }
    }

    .heatmap-table { width: 100%; }

    .score-bar {
      display: flex; align-items: center; gap: 8px;
      .score-fill {
        height: 8px; border-radius: 4px; min-width: 4px;
        &.low      { background: #27C4A0; }
        &.medium   { background: #f0a500; }
        &.high     { background: #e86c3a; }
        &.critical { background: #e53e3e; }
      }
      span { font-size: 13px; font-weight: 600; }
    }

    .risk-badge {
      padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase;
      &.low      { background: rgba(39,196,160,0.15); color: #1a9678; }
      &.medium   { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.high     { background: rgba(232,108,58,0.15); color: #c04a14; }
      &.critical { background: rgba(229,62,62,0.15);  color: #c53030; }
    }

    .loading-center { display: flex; justify-content: center; padding: 48px; }

    .empty-state {
      text-align: center; padding: 48px; color: #9aa5b4;
      mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; }
      p { font-size: 14px; }
    }

    /* ── Module description banner ── */
    .module-banner {
      background: linear-gradient(135deg, #1B2A47 0%, #243558 100%);
      border-radius: 16px;
      padding: 24px 28px;
      margin-bottom: 24px;
      color: white;
    }

    .banner-insight {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 16px;

      .banner-icon { color: #f0c040; font-size: 22px; flex-shrink: 0; margin-top: 2px; }
      p { font-size: 13.5px; color: rgba(255,255,255,0.88); line-height: 1.7; margin: 0; }
      strong { color: white; }
    }

    .banner-features {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .feature-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 12px;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 20px;
      font-size: 12px;
      color: rgba(255,255,255,0.9);
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    /* ── Conflict type chips in table ── */
    .type-chips { display: flex; flex-wrap: wrap; gap: 4px; }
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

    /* ── Section cards ── */
    .section-card {
      background: white;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      margin-top: 20px;
    }

    .section-header {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 24px;

      h3 { font-size: 17px; color: #1B2A47; margin: 0 0 4px; font-weight: 700; }
      p  { font-size: 13px; color: #5a6a7e; margin: 0; line-height: 1.6; }
    }

    .section-icon {
      width: 44px; height: 44px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      mat-icon { font-size: 22px; }

      &.orange { background: rgba(232,108,58,0.12); color: #e86c3a; }
      &.red    { background: rgba(229,62,62,0.12);  color: #e53e3e; }
      &.green  { background: rgba(39,196,160,0.12); color: #1a9678; }
      &.blue   { background: rgba(58,159,214,0.12); color: #2b8bbf; }
    }

    /* ── Coaching guides ── */
    .coaching-guide-item {
      border: 1px solid #e8edf4;
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 12px;

      &:last-child { margin-bottom: 0; }
    }

    .guide-header {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .guide-dept  { font-size: 14px; font-weight: 600; color: #1B2A47; }
    .guide-period { font-size: 12px; color: #9aa5b4; }

    .guide-script {
      background: #f8fafc;
      border-left: 3px solid #3A9FD6;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 10px;
    }

    .script-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 600; color: #3A9FD6;
      text-transform: uppercase; letter-spacing: 0.5px;
      margin: 0 0 8px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    .script-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      tr { border-bottom: 1px solid #e8edf4; }
      tr:last-child { border-bottom: none; }

      td { padding: 8px 10px; vertical-align: top; }
    }

    .script-section {
      width: 160px;
      font-weight: 700;
      color: #1B2A47;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      white-space: nowrap;
      padding-right: 16px !important;
    }

    .script-text {
      color: #374151;
      line-height: 1.6;
    }

    blockquote {
      margin: 0;
      font-size: 13px;
      color: #374151;
      line-height: 1.7;
      font-style: italic;
    }

    .guide-narrative {
      font-size: 13px; color: #5a6a7e; line-height: 1.7;
      p { margin: 0; }
    }

    /* ── Escalation pathway ── */
    .escalation-steps {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }

    .escalation-step {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      background: #fef7f5;
      border: 1px solid #fce0d4;
      border-radius: 10px;
      padding: 14px 16px;
    }

    .step-num {
      width: 28px; height: 28px;
      background: #e53e3e; color: white;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
    }

    .step-content {
      display: flex; flex-direction: column; gap: 3px;
      strong { font-size: 13px; color: #1B2A47; }
      span   { font-size: 12px; color: #5a6a7e; line-height: 1.5; }
    }

    .escalation-cta { color: #e53e3e; border-color: #e53e3e; }

    /* ── Toolkit ── */
    .toolkit-grid { display: flex; flex-direction: column; gap: 10px; }

    .toolkit-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border: 1px solid #e8edf4;
      border-radius: 10px;
      background: #fafbfc;
      transition: background 0.15s;

      &:hover { background: #f0f4f8; }
    }

    .toolkit-icon {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      mat-icon { font-size: 20px; }
    }

    .toolkit-info {
      flex: 1;
      display: flex; flex-direction: column; gap: 2px;
      strong { font-size: 13px; color: #1B2A47; }
      span   { font-size: 12px; color: #5a6a7e; }
    }

    .download-btn { color: #3A9FD6; }
  `],
})
export class ConflictDashboardComponent implements OnInit {
  analyses = signal<ConflictAnalysis[]>([]);
  loading = signal(true);
  displayedColumns = ['department', 'period', 'score', 'level', 'types', 'actions'];

  riskLevels = [
    { key: 'low', label: 'Low Risk', count: 0 },
    { key: 'medium', label: 'Medium Risk', count: 0 },
    { key: 'high', label: 'High Risk', count: 0 },
    { key: 'critical', label: 'Critical', count: 0 },
  ];

  avgRiskScore = signal(0);

  highRiskAnalyses = () =>
    this.analyses().filter((a) => a.riskLevel === 'high' || a.riskLevel === 'critical');

  toolkitResources = [
    {
      title: 'Positions vs. Interests Framework',
      description: 'Identify underlying needs behind stated positions to find creative solutions both parties can accept.',
      icon: 'compare_arrows',
      color: '#3A9FD6',
    },
    {
      title: 'Interest Mapping Worksheet',
      description: 'Guided exercise to map each party\'s interests before entering a difficult conversation.',
      icon: 'account_tree',
      color: '#27C4A0',
    },
    {
      title: 'Conflict Type Diagnostic',
      description: 'Determine whether conflict is interpersonal, structural, cultural, or positional to choose the right intervention.',
      icon: 'category',
      color: '#e86c3a',
    },
    {
      title: 'Manager Conversation Planner',
      description: 'Step-by-step guide for preparing and facilitating a conflict conversation using GROW methodology.',
      icon: 'edit_note',
      color: '#7c3aed',
    },
  ];

  gaugeColor = () => {
    const s = this.avgRiskScore();
    if (s <= 25) return '#27C4A0';
    if (s <= 50) return '#f0a500';
    if (s <= 75) return '#e86c3a';
    return '#e53e3e';
  };

  gaugeArcPath = () => {
    const score = this.avgRiskScore();
    if (score <= 0) return '';
    const angle = (score / 100) * Math.PI;
    const x = (100 - 80 * Math.cos(angle)).toFixed(2);
    const y = (100 - 80 * Math.sin(angle)).toFixed(2);
    // large-arc-flag is always 0: the filled portion is always ≤ 180°
    return `M 20 100 A 80 80 0 0 1 ${x} ${y}`;
  };

  surveyTemplateId = signal('');

  constructor(private api: ApiService, private dialog: MatDialog, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.loadAnalyses();
  }

  loadAnalyses(): void {
    // Load first conflict template ID for survey link
    this.api.get<SurveyTemplate[]>('/surveys/templates').subscribe({
      next: (templates) => {
        const first = templates.find((t) => t.moduleType === 'conflict');
        if (first) this.surveyTemplateId.set(first._id);
      },
    });

    this.loading.set(true);
    this.api.get<ConflictAnalysis[]>('/conflict/analyses').subscribe({
      next: (data) => {
        this.analyses.set(data);
        this.updateStats(data);
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

  viewAnalysis(id: string): void {
    const analysis = this.analyses().find((a) => a._id === id);
    if (!analysis) return;

    const ref = this.dialog.open(ConflictDetailDialogComponent, {
      width: '740px',
      maxHeight: '90vh',
      data: analysis,
    });

    ref.afterClosed().subscribe((result) => {
      if (result?.action === 'escalate') {
        this.escalate(result.id);
      }
    });
  }

  escalate(id: string): void {
    this.api.post(`/conflict/escalate/${id}`, {}).subscribe({
      next: () => this.loadAnalyses(),
    });
  }

  copySurveyLink(): void {
    const url = `${window.location.origin}/survey/${this.surveyTemplateId()}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snackBar.open('Survey link copied to clipboard!', 'Close', { duration: 3000 });
    });
  }

  parseScript(raw: string): Array<{ section: string; text: string }> {
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end   = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1) return [];
      const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      return Object.entries(obj)
        .filter(([, v]) => typeof v === 'string' && (v as string).trim().length > 0)
        .map(([k, v]) => ({
          section: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          text: (v as string).trim(),
        }));
    } catch {
      return [];
    }
  }

  runNewAnalysis(): void {
    const ref = this.dialog.open(ConflictAnalyzeDialogComponent, {
      width: '560px',
      disableClose: true,
    });

    ref.afterClosed().subscribe((result) => {
      if (result) this.loadAnalyses();
    });
  }
}
