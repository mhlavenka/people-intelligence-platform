import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';
import { ConflictAnalyzeDialogComponent } from '../conflict-analyze-dialog/conflict-analyze-dialog.component';

interface ConflictAnalysis {
  _id: string;
  intakeTemplateId?: { _id: string; title: string } | null;
  name: string;
  departmentId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  conflictTypes: string[];
  aiNarrative: string;
  managerScript: string;
  escalationRequested: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-conflict-analysis',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatDialogModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
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

    <!-- Risk count cards -->
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
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {
        <div class="analyses-grid">
          @for (a of analyses(); track a._id) {
            <div class="analysis-card" [class]="'accent-' + a.riskLevel">
              <div class="analysis-card-top">
                <div class="mini-gauge-wrap">
                  <svg viewBox="0 0 100 60" class="mini-gauge-svg">
                    <path d="M 10 52 A 40 40 0 0 1 90 52" fill="none" stroke="#e8edf4" stroke-width="10" stroke-linecap="round"/>
                    <path [attr.d]="miniGaugeArc(a.riskScore)" fill="none"
                          [attr.stroke]="riskColor(a.riskLevel)" stroke-width="10" stroke-linecap="round"/>
                    <text x="50" y="48" text-anchor="middle" class="mini-score">{{ a.riskScore }}</text>
                  </svg>
                  <span class="risk-badge" [class]="a.riskLevel">{{ a.riskLevel }}</span>
                </div>
                <div class="analysis-meta">
                  <div class="meta-name">
                    <strong>{{ a.name }}</strong>
                  </div>
                  <div class="meta-period">
                    <mat-icon>calendar_today</mat-icon>
                    {{ a.createdAt | date:'MMM d, y' }}
                  </div>
                  @if (a.intakeTemplateId?.title; as tplTitle) {
                    <div class="meta-template">
                      <mat-icon>assignment</mat-icon>
                      <span>{{ tplTitle }}</span>
                    </div>
                  }
                  @if (a.escalationRequested) {
                    <span class="escalated-badge">
                      <mat-icon>gavel</mat-icon> Escalated
                    </span>
                  }
                </div>
                <button mat-icon-button class="delete-analysis-btn"
                        matTooltip="Delete analysis"
                        (click)="deleteAnalysis(a); $event.stopPropagation()">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
              @if (a.conflictTypes.length) {
                <div class="type-chips">
                  @for (t of a.conflictTypes; track t) {
                    <span class="type-chip">{{ t }}</span>
                  }
                </div>
              }
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

          <div class="analysis-card new-analysis-card" (click)="runNewAnalysis()">
            <mat-icon class="new-analysis-icon">add</mat-icon>
            <span>New Analysis</span>
          </div>
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
  `,
  styles: [`
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

    .summary-bar { display: flex; gap: 20px; align-items: stretch; margin-bottom: 24px; }
    .risk-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; flex: 1; }
    .risk-card {
      background: white; border-radius: 12px; padding: 16px 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-left: 4px solid transparent; text-align: center;
      .risk-count { font-size: 32px; font-weight: 700; color: #1B2A47; line-height: 1; }
      .risk-label { font-size: 11px; color: #5a6a7e; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.4px; }
    }
    .risk-card--low      { border-color: #27C4A0; .risk-count { color: #27C4A0; } }
    .risk-card--medium   { border-color: #f0a500; .risk-count { color: #f0a500; } }
    .risk-card--high     { border-color: #e86c3a; .risk-count { color: #e86c3a; } }
    .risk-card--critical { border-color: #e53e3e; .risk-count { color: #e53e3e; } }

    .analyses-section {
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 24px;
    }
    .analyses-header {
      display: flex; align-items: center; gap: 10px;
      padding: 18px 24px; border-bottom: 1px solid #f0f4f8;
      h2 { font-size: 16px; color: #1B2A47; margin: 0; font-weight: 700; }
      .analyses-count { font-size: 12px; background: #f0f4f8; color: #5a6a7e; padding: 2px 9px; border-radius: 999px; }
      .new-analysis-btn { margin-left: auto; }
    }

    .analyses-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
      gap: 16px; padding: 16px 20px 20px;
    }
    .analysis-card {
      background: white; border: 1px solid #e8edf4; border-radius: 14px; padding: 18px;
      border-left: 4px solid transparent; transition: box-shadow 0.15s;
      display: flex; flex-direction: column; gap: 12px;
      &:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
      &.accent-low      { border-left-color: #27C4A0; }
      &.accent-medium   { border-left-color: #f0a500; }
      &.accent-high     { border-left-color: #e86c3a; }
      &.accent-critical { border-left-color: #e53e3e; }
    }
    .analysis-card-top { display: flex; align-items: flex-start; gap: 16px; }
    .mini-gauge-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .mini-gauge-svg { width: 80px; .mini-score { font-size: 18px; font-weight: 700; fill: #1B2A47; } }
    .risk-badge {
      padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase;
      &.low      { background: rgba(39,196,160,0.15); color: #1a9678; }
      &.medium   { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.high     { background: rgba(232,108,58,0.15); color: #c04a14; }
      &.critical { background: rgba(229,62,62,0.15);  color: #c53030; }
    }
    .new-analysis-card {
      border: 2px dashed #d0d8e4; border-left-width: 2px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; cursor: pointer; min-height: 120px; color: #6b7c93;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      &:hover { border-color: #3A9FD6; color: #3A9FD6; background: rgba(58,159,214,0.04); }
    }
    .new-analysis-icon { font-size: 36px; width: 36px; height: 36px; }
    .analysis-meta { display: flex; flex-direction: column; gap: 5px; min-width: 0; flex: 1; }
    .meta-name { font-size: 14px; color: #1B2A47; strong { font-weight: 600; } }
    .meta-template { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #3A9FD6; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
    .meta-dept, .meta-period { display: flex; align-items: center; gap: 5px; font-size: 13px; mat-icon { font-size: 14px; width: 14px; height: 14px; color: #9aa5b4; } strong { color: #1B2A47; } }
    .meta-period { color: #5a6a7e; }
    .type-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .type-chip { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: capitalize; background: #eef2f7; color: #4a5568; }
    .escalated-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #e86c3a; font-weight: 600; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
    .analysis-card-actions { display: flex; gap: 8px; padding-top: 4px; border-top: 1px solid #f0f4f8; }
    .delete-analysis-btn { color: #c5d0db; width: 28px; height: 28px; margin-left: auto; flex-shrink: 0; &:hover { color: #e53e3e !important; } }

    .escalation-steps { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px; }
    .escalation-step { display: flex; gap: 14px; align-items: flex-start; background: #fef7f5; border: 1px solid #fce0d4; border-radius: 10px; padding: 14px 16px; }
    .step-num { width: 28px; height: 28px; background: #e53e3e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
    .step-content { display: flex; flex-direction: column; gap: 3px; strong { font-size: 13px; color: #1B2A47; } span { font-size: 12px; color: #5a6a7e; line-height: 1.5; } }
    .escalation-cta { color: #e53e3e; border-color: #e53e3e; }
  `],
})
export class ConflictAnalysisComponent implements OnInit {
  analyses = signal<ConflictAnalysis[]>([]);
  loading = signal(true);

  riskLevels = [
    { key: 'low', label: 'Low Risk', count: 0 },
    { key: 'medium', label: 'Medium Risk', count: 0 },
    { key: 'high', label: 'High Risk', count: 0 },
    { key: 'critical', label: 'Critical', count: 0 },
  ];

  constructor(private api: ApiService, private dialog: MatDialog, private snackBar: MatSnackBar, private router: Router) {}

  ngOnInit(): void { this.loadAnalyses(); }

  loadAnalyses(): void {
    this.loading.set(true);
    this.api.get<ConflictAnalysis[]>('/conflict/analyses').subscribe({
      next: (data) => {
        const topLevel = data.filter((a: any) => !a.parentId);
        this.analyses.set(topLevel);
        this.riskLevels.forEach((l) => { l.count = topLevel.filter((a) => a.riskLevel === l.key).length; });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  viewAnalysis(analysis: ConflictAnalysis): void {
    this.router.navigate(['/conflict/analysis', analysis._id]);
  }

  escalate(id: string): void {
    this.api.post(`/conflict/escalate/${id}`, {}).subscribe({ next: () => this.loadAnalyses() });
  }

  deleteAnalysis(a: ConflictAnalysis): void {
    if (!confirm(`Delete analysis for "${a.departmentId || 'All Departments'}" (${a.name})?`)) return;
    this.api.delete(`/conflict/analyses/${a._id}`).subscribe({
      next: () => { this.analyses.update((list) => list.filter((x) => x._id !== a._id)); this.snackBar.open('Analysis deleted', 'OK', { duration: 3000 }); },
    });
  }

  runNewAnalysis(): void {
    const ref = this.dialog.open(ConflictAnalyzeDialogComponent, { width: '560px', disableClose: true });
    ref.afterClosed().subscribe((result) => { if (result) this.loadAnalyses(); });
  }

  riskColor(level: string): string {
    return ({ low: '#27C4A0', medium: '#f0a500', high: '#e86c3a', critical: '#e53e3e' } as Record<string, string>)[level] ?? '#9aa5b4';
  }

  miniGaugeArc(score: number): string {
    if (score <= 0) return '';
    const angle = (score / 100) * Math.PI;
    return `M 10 52 A 40 40 0 0 1 ${(50 - 40 * Math.cos(angle)).toFixed(2)} ${(52 - 40 * Math.sin(angle)).toFixed(2)}`;
  }
}
