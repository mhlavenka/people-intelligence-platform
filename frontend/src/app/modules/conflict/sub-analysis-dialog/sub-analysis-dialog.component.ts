import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { parseConflictType } from '../conflict-type.util';

export interface SubAnalysisDialogData {
  focusConflictType: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | string;
  aiNarrative: string;
  conflictTypes: string[];
  icon: string;
  createdAt: string;
  // Parent-divergence link: present when this sub-analysis was opened from
  // its parent's detail page and the parent carries the divergence metric
  // blocks. The dialog renders a "see parent for full divergence panel"
  // hint; closing with result 'show-divergence' is the host's signal to
  // switch the parent page to the Divergence Signals tab.
  parentHasDivergence?: boolean;
}

@Component({
  selector: 'app-sub-analysis-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, TranslateModule],
  template: `
    <div class="dlg-hero" [class]="'risk-' + data.riskLevel">
      <div class="dlg-hero-glow"></div>

      <div class="dlg-head-row">
        <div class="dlg-icon-wrap" [class]="data.riskLevel">
          <mat-icon>{{ data.icon }}</mat-icon>
        </div>
        <div class="dlg-title-wrap">
          <div class="dlg-eyebrow">{{ "CONFLICT.deepDiveEyebrow" | translate }}</div>
          <h2 mat-dialog-title class="dlg-title">{{ data.focusConflictType }}</h2>
          <div class="dlg-meta">
            <mat-icon class="tiny">event</mat-icon>
            {{ data.createdAt | date:'MMM d, y · h:mm a' }}
          </div>
        </div>

        <div class="dlg-ring-wrap">
          <svg class="dlg-ring" viewBox="0 0 120 120">
            <circle class="dlg-ring-bg" cx="60" cy="60" r="50" fill="none" stroke-width="10"/>
            <circle class="dlg-ring-val" cx="60" cy="60" r="50" fill="none" stroke-width="10"
                    [style.stroke]="color()"
                    [style.stroke-dasharray]="314.15"
                    [style.stroke-dashoffset]="314.15 - (data.riskScore / 100) * 314.15"
                    stroke-linecap="round"/>
          </svg>
          <div class="dlg-ring-inner">
            <div class="dlg-ring-num" [style.color]="color()">{{ data.riskScore }}</div>
            <div class="dlg-ring-lbl">/ 100</div>
          </div>
        </div>
      </div>

      <div class="dlg-pill-row">
        <span class="dlg-risk-pill" [class]="data.riskLevel">
          <mat-icon>{{ riskIcon() }}</mat-icon>
          {{ (data.riskLevel | titlecase) + ' Risk' }}
        </span>
        @if (data.conflictTypes.length) {
          @for (t of data.conflictTypes; track t) {
            <span class="dlg-chip" [title]="parseType(t).rationale || ''">{{ parseType(t).label }}</span>
          }
        }
      </div>
    </div>

    <mat-dialog-content class="dlg-content">
      <div class="dlg-narrative">
        <div class="dlg-narrative-head">
          <div class="ai-avatar">
            <mat-icon>auto_awesome</mat-icon>
            <span class="pulse-ring"></span>
          </div>
          <div>
            <div class="ai-h-title">{{ "CONFLICT.aiAssessment" | translate }}</div>
            <div class="ai-h-sub">{{ data.focusConflictType }}</div>
          </div>
        </div>

        @if (firstParagraph(); as lead) {
          <blockquote class="dlg-pullquote">
            <mat-icon class="quote-mark">format_quote</mat-icon>
            {{ lead }}
          </blockquote>
        }
        @for (para of remainingParagraphs(); track $index) {
          <p class="dlg-para" [style.animation-delay.ms]="80 + $index * 50">{{ para }}</p>
        }
      </div>
    </mat-dialog-content>

    @if (data.parentHasDivergence) {
      <div class="dlg-parent-link">
        <mat-icon>insights</mat-icon>
        <span class="dlg-parent-link-text">{{ "CONFLICT.subParentDivergenceHint" | translate }}</span>
        <button mat-stroked-button class="dlg-parent-link-btn" (click)="showParentDivergence()">
          <mat-icon>arrow_forward</mat-icon>
          {{ "CONFLICT.subParentDivergenceCta" | translate }}
        </button>
      </div>
    }

    <mat-dialog-actions align="end" class="dlg-actions">
      <button mat-raised-button color="primary" mat-dialog-close>
        {{ "COMMON.close" | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; }

    .dlg-hero {
      position: relative; overflow: hidden;
      padding: 22px 24px 18px;
      background: linear-gradient(135deg, #fbfcfe 0%, #f2f7fb 100%);
      border-bottom: 1px solid rgba(27, 42, 71, 0.06);

      &.risk-low    { background: linear-gradient(135deg, #fbfefd 0%, #e9f9f4 100%); }
      &.risk-medium { background: linear-gradient(135deg, #fffdf6 0%, #fdf2dc 100%); }
      &.risk-high   { background: linear-gradient(135deg, #fff9f6 0%, #fde5d8 100%); }
      &.risk-critical { background: linear-gradient(135deg, #fff7f7 0%, #fbdede 100%); }
    }
    .dlg-hero-glow {
      position: absolute; inset: -40% -20% auto auto; width: 60%; height: 140%;
      background: radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 60%);
      pointer-events: none;
    }

    .dlg-head-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 18px; align-items: center;
      position: relative; z-index: 1;
    }
    .dlg-icon-wrap {
      width: 56px; height: 56px; border-radius: 16px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: #f0f4f8;
      mat-icon { font-size: 30px; width: 30px; height: 30px; color: #5a6a7e; }
      &.low      { background: rgba(39,196,160,0.15);  mat-icon { color: #1a9678; } }
      &.medium   { background: rgba(240,165,0,0.15);   mat-icon { color: #b07800; } }
      &.high     { background: rgba(232,108,58,0.15);  mat-icon { color: #c04a14; } }
      &.critical { background: rgba(229,62,62,0.15);   mat-icon { color: #c53030; } }
    }
    .dlg-title-wrap { min-width: 0; }
    .dlg-eyebrow {
      font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px;
      color: #7f8ea3; font-weight: 600; margin-bottom: 2px;
    }
    .dlg-title {
      margin: 0 !important; padding: 0 !important;
      font-size: 22px; font-weight: 700; color: var(--artes-primary);
      line-height: 1.2;
    }
    .dlg-meta {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px; color: #9aa5b4; margin-top: 4px;
      .tiny { font-size: 13px; width: 13px; height: 13px; }
    }

    .dlg-ring-wrap {
      position: relative; width: 100px; height: 100px; flex-shrink: 0;
    }
    .dlg-ring { width: 100%; height: 100%; transform: rotate(-90deg); }
    .dlg-ring-bg { stroke: rgba(27, 42, 71, 0.08); }
    .dlg-ring-val {
      animation: ring-draw 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
      filter: drop-shadow(0 2px 5px rgba(0,0,0,0.08));
    }
    @keyframes ring-draw { from { stroke-dashoffset: 314.15; } }
    .dlg-ring-inner {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .dlg-ring-num {
      font-size: 30px; font-weight: 800; line-height: 1; letter-spacing: -0.5px;
      animation: score-pop 0.5s 0.15s ease both;
    }
    .dlg-ring-lbl {
      font-size: 10px; color: #9aa5b4; margin-top: 3px; font-weight: 500;
    }
    @keyframes score-pop {
      from { transform: scale(0.7); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }

    .dlg-pill-row {
      display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px;
      position: relative; z-index: 1;
    }
    .dlg-risk-pill {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; padding: 4px 10px; border-radius: 999px;
      background: #eef2f7; color: #7f8ea3;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &.low      { background: rgba(39,196,160,0.15); color: #1a9678; }
      &.medium   { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.high     { background: rgba(232,108,58,0.15); color: #c04a14; }
      &.critical { background: rgba(229,62,62,0.15);  color: #c53030; }
    }
    .dlg-chip {
      background: rgba(58,159,214,0.1); color: #2080b0;
      padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 500;
    }

    .dlg-content {
      min-width: 520px; max-width: 680px;
      padding: 20px 24px !important;
    }

    .dlg-narrative-head {
      display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
    }
    .ai-avatar {
      position: relative; width: 40px; height: 40px; flex-shrink: 0;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #3A9FD6 0%, #27C4A0 100%);
      box-shadow: 0 4px 14px -4px rgba(58, 159, 214, 0.45);
      mat-icon { color: #fff; font-size: 20px; width: 20px; height: 20px; }
    }
    .pulse-ring {
      position: absolute; inset: -3px; border-radius: 50%;
      border: 2px solid rgba(58, 159, 214, 0.35);
      animation: pulse-ring 2.4s ease-out infinite;
    }
    @keyframes pulse-ring {
      0%   { transform: scale(1);   opacity: 0.8; }
      100% { transform: scale(1.3); opacity: 0; }
    }
    .ai-h-title { font-size: 14px; font-weight: 700; color: var(--artes-primary); }
    .ai-h-sub { font-size: 12px; color: #9aa5b4; }

    .dlg-pullquote {
      position: relative; margin: 0 0 14px;
      padding: 16px 18px 16px 48px;
      background: linear-gradient(135deg, rgba(58,159,214,0.06) 0%, rgba(39,196,160,0.04) 100%);
      border-left: 4px solid var(--artes-accent);
      border-radius: 0 12px 12px 0;
      font-size: 14px; line-height: 1.7; color: #2d3748; font-weight: 500;
      font-style: italic;
      animation: quote-in 0.5s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both;

      .quote-mark {
        position: absolute; left: 12px; top: 12px;
        font-size: 28px; width: 28px; height: 28px;
        color: var(--artes-accent); opacity: 0.35;
      }
    }
    @keyframes quote-in {
      from { opacity: 0; transform: translateX(-6px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    .dlg-para {
      font-size: 14px; color: #374151; line-height: 1.75; margin: 0 0 12px;
      animation: para-in 0.45s ease both;
      &:last-child { margin-bottom: 0; }
    }
    @keyframes para-in {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .dlg-actions {
      padding: 12px 20px !important;
      border-top: 1px solid #edf1f6;
    }

    /* Parent-divergence hint shown when this sub was opened from a parent
       that carries divergence metric blocks. */
    .dlg-parent-link {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 20px;
      background: rgba(58,159,214,0.06);
      border-top: 1px solid rgba(58,159,214,0.18);
      border-bottom: 1px solid rgba(58,159,214,0.18);
      mat-icon { color: #3A9FD6; flex-shrink: 0; }
      .dlg-parent-link-text { flex: 1; font-size: 13px; color: #2080b0; line-height: 1.4; }
      .dlg-parent-link-btn {
        flex-shrink: 0;
        font-size: 12px; font-weight: 600;
        mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; color: inherit; }
      }
    }
    @media (max-width: 600px) {
      .dlg-parent-link { flex-wrap: wrap; }
    }
  `],
})
export class SubAnalysisDialogComponent {
  data = inject<SubAnalysisDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<SubAnalysisDialogComponent, 'show-divergence' | undefined>);

  showParentDivergence(): void {
    this.dialogRef.close('show-divergence');
  }

  private static COLORS: Record<string, string> = {
    low: '#27C4A0', medium: '#f0a500', high: '#e86c3a', critical: '#e53e3e',
  };

  color(): string {
    return SubAnalysisDialogComponent.COLORS[this.data.riskLevel] ?? '#9aa5b4';
  }

  riskIcon(): string {
    const map: Record<string, string> = {
      low: 'check_circle', medium: 'info', high: 'warning', critical: 'report',
    };
    return map[this.data.riskLevel] ?? 'help';
  }

  parseType(raw: string) { return parseConflictType(raw); }

  private paragraphs(): string[] {
    return (this.data.aiNarrative || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  }

  firstParagraph(): string { return this.paragraphs()[0] ?? ''; }

  remainingParagraphs(): string[] { return this.paragraphs().slice(1); }
}
