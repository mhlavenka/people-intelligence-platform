import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/api.service';

type ScriptSection =
  | { key: string; label: string; type: 'string'; value: string }
  | { key: string; label: string; type: 'list'; items: string[] }
  | { key: string; label: string; type: 'topics'; topics: { topic: string; points: string[] }[] };

interface ConflictAnalysis {
  _id: string;
  departmentId?: string;
  surveyPeriod: string;
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
    MatProgressSpinnerModule,
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

      <div class="section">
        <h3><mat-icon>auto_awesome</mat-icon> AI Analysis</h3>
        <p class="narrative">{{ data.aiNarrative }}</p>
      </div>

      <!-- Sub-analysis drill-down section -->
      @if (data.conflictTypes.length) {
        <mat-divider />
        <div class="section">
          <h3><mat-icon>manage_search</mat-icon> Drill-down by Conflict Type</h3>
          <p class="drill-hint">Run a focused sub-analysis for each detected conflict type to get deeper insights and targeted manager scripts.</p>

          <div class="sub-analyses-list">
            @for (ct of data.conflictTypes; track ct) {
              <div class="sub-row" [class]="subAnalysisFor(ct)?.riskLevel || ''">
                <div class="sub-left">
                  <svg class="mini-gauge" viewBox="0 0 80 52" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
                    <path d="M10,44 A30,30 0 0,1 70,44" fill="none" stroke="#e8edf4" stroke-width="8" stroke-linecap="round"/>
                    <path [attr.d]="gaugeArcFor(ct)"
                          fill="none"
                          [attr.stroke]="subAnalysisFor(ct) ? riskColor(subAnalysisFor(ct)!.riskLevel) : 'none'"
                          stroke-width="8" stroke-linecap="round"/>
                    <text x="40" y="43" text-anchor="middle"
                          [attr.font-size]="subAnalysisFor(ct) ? 13 : 10"
                          font-weight="700"
                          [attr.fill]="subAnalysisFor(ct) ? riskColor(subAnalysisFor(ct)!.riskLevel) : '#b0bec5'">{{ subAnalysisFor(ct)?.riskScore ?? '--' }}</text>
                  </svg>
                </div>

                <div class="sub-center">
                  <div class="sub-type-label">{{ ct }}</div>
                  @if (subAnalysisFor(ct); as sub) {
                    <div class="sub-score-bar-wrap">
                      <div class="sub-score-bar" [style.width.%]="sub.riskScore" [style.background]="riskColor(sub.riskLevel)"></div>
                    </div>
                    <div class="sub-narrative">
                      @if (isNarrativeExpanded(ct)) {
                        {{ sub.aiNarrative }}
                        <a class="narrative-toggle" (click)="toggleNarrative(ct)">Show less</a>
                      } @else {
                        {{ sub.aiNarrative | slice:0:200 }}@if (sub.aiNarrative.length > 200) {<a class="narrative-toggle" (click)="toggleNarrative(ct)">…&nbsp;more</a>}
                      }
                    </div>
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
                      {{ runningFor() === ct ? 'Analyzing…' : 'Run Sub-Analysis' }}
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      @if (data.managerScript) {
        <mat-divider />
        <div class="section">
          <h3><mat-icon>record_voice_over</mat-icon> Manager Conversation Guide</h3>

          @if (scriptSections().length > 0) {
            <div class="script-sections">
              @for (section of scriptSections(); track section.key) {
                <div class="script-section">
                  <div class="script-section-title">{{ section.label }}</div>

                  @if (section.type === 'string') {
                    <p class="script-para">{{ section.value }}</p>
                  }

                  @if (section.type === 'list') {
                    <ul class="script-list">
                      @for (item of section.items; track $index) {
                        <li>{{ item }}</li>
                      }
                    </ul>
                  }

                  @if (section.type === 'topics') {
                    <table class="topics-table">
                      <thead>
                        <tr>
                          <th>Topic</th>
                          <th>Talking Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of section.topics; track $index) {
                          <tr>
                            <td class="topic-name">{{ row.topic }}</td>
                            <td>
                              <ul class="script-list tight">
                                @for (pt of row.points; track $index) {
                                  <li>{{ pt }}</li>
                                }
                              </ul>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                </div>
              }
            </div>
          } @else {
            <div class="script-box">
              <pre class="script-text">{{ data.managerScript }}</pre>
            </div>
          }
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
      <button mat-stroked-button (click)="exportPdf()" style="margin-right: auto">
        <mat-icon>picture_as_pdf</mat-icon> Export PDF
      </button>
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
      min-width: 560px; max-width: 820px;
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

    .drill-hint {
      font-size: 13px; color: #6b7280; margin: -4px 0 16px; line-height: 1.5;
    }

    /* Sub-analysis rows */
    .sub-analyses-list {
      display: flex; flex-direction: column; gap: 10px;
    }

    .sub-row {
      display: flex; align-items: center; gap: 14px;
      background: #f8fafc; border-radius: 10px; padding: 12px 14px;
      border-left: 4px solid #e8edf4;
      transition: border-color 0.2s;
      &.low      { border-left-color: #27C4A0; }
      &.medium   { border-left-color: #f0a500; }
      &.high     { border-left-color: #e86c3a; }
      &.critical { border-left-color: #e53e3e; }
    }

    .sub-left {
      flex-shrink: 0;
      .mini-gauge { width: 72px; height: 46px; display: block; }
    }

    .sub-center {
      flex: 1; min-width: 0;
    }

    .sub-type-label {
      font-size: 13px; font-weight: 600; color: #1B2A47; margin-bottom: 6px;
    }

    .sub-score-bar-wrap {
      background: #e8edf4; border-radius: 4px; height: 6px; margin-bottom: 6px;
      overflow: hidden;
      &.empty { display: flex; align-items: center; background: transparent; height: auto; }
    }

    .sub-score-bar {
      height: 100%; border-radius: 4px; transition: width 0.5s ease;
    }

    .sub-score-bar-placeholder {
      font-size: 12px; color: #9aa5b4; font-style: italic;
    }

    .sub-narrative {
      font-size: 12px; color: #5a6a7e; line-height: 1.5;
      .narrative-toggle {
        color: #3A9FD6; cursor: pointer; text-decoration: none; font-weight: 500;
        margin-left: 2px;
        &:hover { text-decoration: underline; }
      }
    }

    .sub-right {
      flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
      .risk-badge { margin-top: 0; }
      button {
        display: flex; align-items: center; gap: 4px; font-size: 12px; white-space: nowrap;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
        mat-spinner { margin: 0 2px; }
      }
    }

    /* Script sections */
    .script-box {
      background: #f8fafc; border-radius: 10px; padding: 16px;
      border-left: 3px solid #3A9FD6;
    }

    .script-text {
      font-family: inherit; font-size: 13px; color: #374151;
      line-height: 1.7; margin: 0; white-space: pre-wrap; word-break: break-word;
    }

    .script-sections {
      display: flex; flex-direction: column; gap: 12px;
    }

    .script-section {
      background: #f8fafc; border-radius: 10px; padding: 14px 16px;
      border-left: 3px solid #3A9FD6;
    }

    .script-section-title {
      font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.05em; color: #3A9FD6; margin-bottom: 8px;
    }

    .script-para {
      font-size: 13px; color: #374151; line-height: 1.7; margin: 0;
    }

    .script-list {
      margin: 0; padding-left: 18px;
      li { font-size: 13px; color: #374151; line-height: 1.7; margin-bottom: 2px; }
      &.tight li { margin-bottom: 0; }
    }

    .topics-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th {
        text-align: left; padding: 6px 10px;
        background: #edf2f7; color: #1B2A47; font-weight: 600; font-size: 12px;
        &:first-child { border-radius: 6px 0 0 0; width: 30%; }
        &:last-child  { border-radius: 0 6px 0 0; }
      }
      td {
        padding: 8px 10px; vertical-align: top; color: #374151;
        border-bottom: 1px solid #e8edf4;
      }
      tr:last-child td { border-bottom: none; }
      .topic-name { font-weight: 600; color: #1B2A47; }
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
export class ConflictDetailDialogComponent implements OnInit {
  data = inject<ConflictAnalysis>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ConflictDetailDialogComponent>);
  private api = inject(ApiService);

  subAnalyses = signal<ConflictAnalysis[]>([]);
  runningFor = signal<string | null>(null);
  expandedNarratives = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.loadSubAnalyses();
  }

  private loadSubAnalyses(): void {
    this.api.get<ConflictAnalysis[]>(`/conflict/analyses/${this.data._id}/sub-analyses`).subscribe({
      next: (list) => this.subAnalyses.set(list),
      error: () => {},
    });
  }

  subAnalysisFor(conflictType: string): ConflictAnalysis | undefined {
    return this.subAnalyses().find((s) => s.focusConflictType === conflictType);
  }

  runSubAnalysis(conflictType: string): void {
    this.runningFor.set(conflictType);
    this.api.post<ConflictAnalysis>(`/conflict/analyses/${this.data._id}/sub-analyses`, {
      focusConflictType: conflictType,
    }).subscribe({
      next: (sub) => {
        this.subAnalyses.update((list) => {
          const idx = list.findIndex((s) => s.focusConflictType === conflictType);
          return idx >= 0 ? list.map((s, i) => i === idx ? sub : s) : [...list, sub];
        });
        this.runningFor.set(null);
      },
      error: () => this.runningFor.set(null),
    });
  }

  isNarrativeExpanded(conflictType: string): boolean {
    return this.expandedNarratives().has(conflictType);
  }

  toggleNarrative(conflictType: string): void {
    this.expandedNarratives.update((set) => {
      const next = new Set(set);
      next.has(conflictType) ? next.delete(conflictType) : next.add(conflictType);
      return next;
    });
  }

  gaugeArcFor(conflictType: string): string {
    const sub = this.subAnalysisFor(conflictType);
    if (!sub || sub.riskScore <= 0) return '';
    return this.miniGaugeArc(sub.riskScore);
  }

  miniGaugeArc(score: number): string {
    const pct = Math.min(Math.max(score, 0), 100) / 100;
    const startAngle = Math.PI;
    const endAngle   = startAngle + pct * Math.PI;
    const r = 30;
    const cx = 40, cy = 44;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 0,1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
  }

  riskColor(level: string): string {
    const map: Record<string, string> = {
      low: '#27C4A0', medium: '#f0a500', high: '#e86c3a', critical: '#e53e3e',
    };
    return map[level] ?? '#9aa5b4';
  }

  private splitWords(s: string): string {
    return s
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
  }

  scriptSections(): ScriptSection[] {
    const raw = this.data.managerScript;
    if (!raw) return [];

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    } catch {
      return [];
    }

    const POINTS_RE = /^(points|talkingPoints|talking_points|actions|suggestions|tips|items|bullets|scripts|keyPoints|key_points|strategies)$/i;
    const TOPIC_RE  = /^(topic|title|area|name|subject|issue|category|type|heading|label)$/i;

    return Object.entries(parsed).map(([key, val]): ScriptSection => {
      const label = this.splitWords(key);

      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
        const topics = (val as Record<string, unknown>[]).map((item) => {
          const topicKey = Object.keys(item).find((k) => TOPIC_RE.test(k));
          const topicRaw = topicKey ? String(item[topicKey] ?? '') : '';
          const topic = topicRaw ? this.splitWords(topicRaw) : label;

          const pointsKey = Object.keys(item).find((k) => POINTS_RE.test(k));
          const rawPoints = pointsKey ? item[pointsKey] : null;
          const points: string[] = Array.isArray(rawPoints)
            ? rawPoints.map(String)
            : Object.values(item)
                .filter((v) => typeof v === 'string' && v !== topicRaw)
                .map(String);

          return { topic, points };
        });
        return { key, label, type: 'topics', topics };
      }

      if (Array.isArray(val)) {
        return { key, label, type: 'list', items: val.map(String) };
      }

      return { key, label, type: 'string', value: String(val ?? '') };
    });
  }

  exportPdf(): void {
    const d = this.data;
    const riskColors: Record<string, string> = {
      low: '#27C4A0', medium: '#f0a500', high: '#e86c3a', critical: '#e53e3e',
    };
    const color = riskColors[d.riskLevel] ?? '#9aa5b4';

    const subRows = this.subAnalyses().map((s) => `
      <div class="sub-block">
        <div class="sub-header">
          <span class="sub-type">${s.focusConflictType ?? ''}</span>
          <span class="badge" style="background:${riskColors[s.riskLevel]}22;color:${riskColors[s.riskLevel]}">${s.riskLevel.toUpperCase()} — ${s.riskScore}</span>
        </div>
        <p>${s.aiNarrative}</p>
      </div>`).join('');

    const scriptHtml = (() => {
      const sections = this.scriptSections();
      if (!sections.length) return `<pre>${d.managerScript}</pre>`;
      return sections.map((sec) => {
        if (sec.type === 'string') return `<div class="script-sec"><div class="sec-title">${sec.label}</div><p>${sec.value}</p></div>`;
        if (sec.type === 'list') return `<div class="script-sec"><div class="sec-title">${sec.label}</div><ul>${sec.items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`;
        if (sec.type === 'topics') return `<div class="script-sec"><div class="sec-title">${sec.label}</div><table><thead><tr><th>Topic</th><th>Talking Points</th></tr></thead><tbody>${sec.topics.map((t) => `<tr><td><strong>${t.topic}</strong></td><td><ul>${t.points.map((p) => `<li>${p}</li>`).join('')}</ul></td></tr>`).join('')}</tbody></table></div>`;
        return '';
      }).join('');
    })();

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Conflict Analysis — ${d.departmentId || 'All Departments'}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1B2A47; margin: 0; padding: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #5a6a7e; margin-bottom: 20px; }
  .score-block { display: inline-flex; flex-direction: column; align-items: center;
    padding: 16px 24px; border-radius: 12px; background: ${color}22; color: ${color};
    margin-bottom: 20px; }
  .score-num { font-size: 36px; font-weight: 700; line-height: 1; }
  .score-lbl { font-size: 11px; margin-top: 4px; }
  .badge { padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700;
    background: ${color}22; color: ${color}; display: inline-block; margin-left: 10px; }
  h2 { font-size: 15px; border-bottom: 2px solid #edf2f7; padding-bottom: 6px; margin: 24px 0 12px; }
  .narrative { line-height: 1.7; white-space: pre-wrap; }
  .sub-block { background: #f8fafc; border-left: 4px solid #e8edf4; border-radius: 6px;
    padding: 12px 16px; margin-bottom: 10px; }
  .sub-header { display: flex; align-items: center; margin-bottom: 6px; }
  .sub-type { font-weight: 700; }
  .script-sec { background: #f8fafc; border-left: 3px solid #3A9FD6; border-radius: 4px;
    padding: 12px 16px; margin-bottom: 10px; }
  .sec-title { font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.05em; color: #3A9FD6; margin-bottom: 8px; }
  ul { margin: 0; padding-left: 18px; } li { margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 6px 10px; background: #edf2f7; font-size: 12px; }
  td { padding: 8px 10px; border-bottom: 1px solid #e8edf4; vertical-align: top; }
  pre { white-space: pre-wrap; word-break: break-word; }
  @media print { body { padding: 16px; } }
</style></head><body>
<h1>Conflict Intelligence™ Analysis</h1>
<div class="meta">
  ${d.departmentId || 'All Departments'} &nbsp;·&nbsp; ${d.surveyPeriod} &nbsp;·&nbsp;
  Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
</div>
<div class="score-block">
  <div class="score-num">${d.riskScore}</div>
  <div class="score-lbl">Risk Score</div>
</div>
<span class="badge">${d.riskLevel.toUpperCase()} RISK</span>

<h2>AI Analysis</h2>
<p class="narrative">${d.aiNarrative}</p>

${this.subAnalyses().length ? `<h2>Drill-down by Conflict Type</h2>${subRows}` : ''}

${d.managerScript ? `<h2>Manager Conversation Guide</h2>${scriptHtml}` : ''}

${d.escalationRequested ? '<p style="color:#e53e3e;font-weight:700">⚠ Escalation has been requested.</p>' : ''}
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  escalate(): void {
    this.dialogRef.close({ action: 'escalate', id: this.data._id });
  }
}
