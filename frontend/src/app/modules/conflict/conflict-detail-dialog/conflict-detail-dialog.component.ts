import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

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
  selector: 'app-conflict-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>analytics</mat-icon>
      Conflict Analysis — {{ data.departmentId || 'All Departments' }}
    </h2>

    <mat-dialog-content>
      <!-- Header row: score + meta -->
      <div class="meta-row">
        <div class="score-block" [class]="data.riskLevel">
          <div class="score-num">{{ data.riskScore }}</div>
          <div class="score-label">Risk Score</div>
        </div>
        <div class="meta-info">
          <div class="meta-item">
            <mat-icon>calendar_today</mat-icon>
            <span>{{ data.surveyPeriod }}</span>
          </div>
          <div class="meta-item">
            <mat-icon>corporate_fare</mat-icon>
            <span>{{ data.departmentId || 'All Departments' }}</span>
          </div>
          <div class="meta-item">
            <mat-icon>event</mat-icon>
            <span>{{ data.createdAt | date:'MMM d, y, h:mm a' }}</span>
          </div>
          <div class="risk-badge" [class]="data.riskLevel">{{ data.riskLevel | titlecase }} Risk</div>
        </div>
      </div>

      @if (data.conflictTypes?.length) {
        <div class="section">
          <h3><mat-icon>label</mat-icon> Identified Conflict Types</h3>
          <div class="chips-row">
            @for (ct of data.conflictTypes; track ct) {
              <span class="chip">{{ ct }}</span>
            }
          </div>
        </div>
        <mat-divider />
      }

      <div class="section">
        <h3><mat-icon>auto_awesome</mat-icon> AI Analysis</h3>
        <p class="narrative">{{ data.aiNarrative }}</p>
      </div>

      @if (data.managerScript) {
        <mat-divider />
        <div class="section">
          <h3><mat-icon>record_voice_over</mat-icon> Manager Conversation Guide</h3>
          <div class="script-box">
            <pre class="script-text">{{ data.managerScript }}</pre>
          </div>
        </div>
      }

      @if (data.escalationRequested) {
        <div class="escalation-banner">
          <mat-icon>notifications_active</mat-icon>
          Escalation has been requested — HR / Coach has been notified.
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (!data.escalationRequested && data.riskLevel !== 'low') {
        <button mat-stroked-button color="warn" (click)="escalate()">
          <mat-icon>escalator_warning</mat-icon> Escalate to HR
        </button>
      }
      <button mat-raised-button color="primary" mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex; align-items: center; gap: 8px; color: #1B2A47;
      mat-icon { color: #e86c3a; }
    }

    mat-dialog-content {
      min-width: 560px; max-width: 700px;
      padding-top: 8px !important;
      display: flex; flex-direction: column; gap: 0;
    }

    .meta-row {
      display: flex; gap: 20px; align-items: flex-start; margin-bottom: 20px;
    }

    .score-block {
      width: 88px; height: 88px; border-radius: 16px; flex-shrink: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      .score-num  { font-size: 32px; font-weight: 700; line-height: 1; }
      .score-label { font-size: 11px; margin-top: 4px; opacity: 0.8; }
      &.low      { background: rgba(39,196,160,0.15); color: #1a9678; }
      &.medium   { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.high     { background: rgba(232,108,58,0.15); color: #c04a14; }
      &.critical { background: rgba(229,62,62,0.15);  color: #c53030; }
    }

    .meta-info {
      display: flex; flex-direction: column; gap: 6px; flex: 1;
      .meta-item {
        display: flex; align-items: center; gap: 6px;
        font-size: 13px; color: #5a6a7e;
        mat-icon { font-size: 16px; width: 16px; height: 16px; color: #9aa5b4; }
      }
    }

    .risk-badge {
      display: inline-block; padding: 3px 12px; border-radius: 999px;
      font-size: 12px; font-weight: 700; text-transform: uppercase; margin-top: 4px;
      &.low      { background: rgba(39,196,160,0.15); color: #1a9678; }
      &.medium   { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.high     { background: rgba(232,108,58,0.15); color: #c04a14; }
      &.critical { background: rgba(229,62,62,0.15);  color: #c53030; }
    }

    .section {
      padding: 16px 0;
      h3 {
        display: flex; align-items: center; gap: 6px;
        font-size: 14px; font-weight: 600; color: #1B2A47; margin: 0 0 12px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #3A9FD6; }
      }
    }

    .chips-row { display: flex; flex-wrap: wrap; gap: 8px; }

    .chip {
      background: rgba(58,159,214,0.1); color: #2080b0;
      padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 500;
    }

    .narrative {
      font-size: 14px; color: #374151; line-height: 1.7; margin: 0;
      white-space: pre-wrap;
    }

    .script-box {
      background: #f8fafc; border-radius: 10px; padding: 16px;
      border-left: 3px solid #3A9FD6;
    }

    .script-text {
      font-family: inherit; font-size: 13px; color: #374151;
      line-height: 1.7; margin: 0; white-space: pre-wrap; word-break: break-word;
    }

    .escalation-banner {
      display: flex; align-items: center; gap: 8px;
      background: rgba(229,62,62,0.08); border-radius: 8px; padding: 12px 14px;
      color: #c53030; font-size: 13px; margin-top: 8px;
      mat-icon { font-size: 18px; }
    }

    mat-dialog-actions { gap: 8px; }
  `],
})
export class ConflictDetailDialogComponent {
  data = inject<ConflictAnalysis>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ConflictDetailDialogComponent>);

  escalate(): void {
    this.dialogRef.close({ action: 'escalate', id: this.data._id });
  }
}
