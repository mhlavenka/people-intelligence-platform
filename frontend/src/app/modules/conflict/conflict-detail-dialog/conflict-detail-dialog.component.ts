import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/api.service';
import { MiniGaugeComponent } from '../../../shared/mini-gauge/mini-gauge.component';
import { RiskBadgeComponent } from '../../../shared/risk-badge/risk-badge.component';
import { TranslateModule } from '@ngx-translate/core';
import { parseConflictType } from '../conflict-type.util';
import { DialogCloseButtonComponent } from '../../../shared/dialog-close-button/dialog-close-button.component';

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
    MiniGaugeComponent,
    RiskBadgeComponent,
    TranslateModule,
    DialogCloseButtonComponent,
  ],
  template: `
    <app-dialog-close-btn (closed)="dialogRef.close()" />
    <h2 mat-dialog-title>
      <mat-icon>analytics</mat-icon>
      {{ data.name }}
    </h2>

    <mat-dialog-content>
      <!-- Header row: score + meta -->
      <div class="meta-row">
        <div class="score-block" [class]="data.riskLevel">
          <div class="score-num">{{ data.riskScore }}</div>
          <div class="score-label">{{ "CONFLICT.riskScore" | translate }}</div>
        </div>
        <div class="meta-info">
          <div class="meta-item">
            <mat-icon>event</mat-icon>
            <span>{{ data.createdAt | date:'MMM d, y' }}</span>
          </div>
          <div class="meta-item">
            <mat-icon>corporate_fare</mat-icon>
            <span>{{ data.departmentId || ("CONFLICT.allDepartments" | translate) }}</span>
          </div>
          @if (data.intakeTemplateId?.title; as tplTitle) {
            <div class="meta-item">
              <mat-icon>assignment</mat-icon>
              <span>{{ tplTitle }}</span>
            </div>
          }
          <app-risk-badge [level]="data.riskLevel" [label]="(data.riskLevel | titlecase) + ' Risk'" />
        </div>
      </div>

      <div class="section">
        <h3><mat-icon>auto_awesome</mat-icon> {{ "CONFLICT.aiAnalysis" | translate }}</h3>
        <p class="narrative">{{ data.aiNarrative }}</p>
      </div>

      <!-- Sub-analysis drill-down section -->
      @if (data.conflictTypes.length) {
        <mat-divider />
        <div class="section">
          <h3><mat-icon>manage_search</mat-icon> {{ "CONFLICT.drillDown" | translate }}</h3>
          <p class="drill-hint">{{ "CONFLICT.drillHintText" | translate }}</p>

          <div class="sub-analyses-list">
            @for (ct of data.conflictTypes; track ct) {
              <div class="sub-row" [class]="subAnalysisFor(ct)?.riskLevel || ''">
                <div class="sub-left">
                  <app-mini-gauge
                    [score]="subAnalysisFor(ct)?.riskScore ?? 0"
                    [riskLevel]="subAnalysisFor(ct)?.riskLevel ?? ''"
                    size="sm" />
                </div>

                <div class="sub-center">
                  <div class="sub-type-label">
                    <strong>{{ parseType(ct).label }}</strong>
                    @if (parseType(ct).rationale) {
                      <em class="sub-type-rationale">{{ parseType(ct).rationale }}</em>
                    }
                  </div>
                  @if (subAnalysisFor(ct); as sub) {
                    <div class="sub-score-bar-wrap">
                      <div class="sub-score-bar" [class]="sub.riskLevel" [style.width.%]="sub.riskScore"></div>
                    </div>
                    <div class="sub-narrative">
                      @if (isNarrativeExpanded(ct)) {
                        {{ sub.aiNarrative }}
                        <a class="narrative-toggle" (click)="toggleNarrative(ct)">{{ "CONFLICT.showLess" | translate }}</a>
                      } @else {
                        {{ sub.aiNarrative | slice:0:200 }}@if (sub.aiNarrative.length > 200) {<a class="narrative-toggle" (click)="toggleNarrative(ct)">…&nbsp;{{ "CONFLICT.more" | translate }}</a>}
                      }
                    </div>
                  } @else {
                    <div class="sub-score-bar-wrap empty">
                      <div class="sub-score-bar-placeholder">{{ "CONFLICT.noSubAnalysis" | translate }}</div>
                    </div>
                  }
                </div>

                <div class="sub-right">
                  @if (subAnalysisFor(ct); as sub) {
                    <app-risk-badge [level]="sub.riskLevel" />
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
                      {{ runningFor() === ct ? ("CONFLICT.analyzingEllipsis" | translate) : ("CONFLICT.runSubAnalysisBtn" | translate) }}
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
          <h3><mat-icon>record_voice_over</mat-icon> {{ "CONFLICT.managerGuide" | translate }}</h3>

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
                          <th>{{ "CONFLICT.topic" | translate }}</th>
                          <th>{{ "CONFLICT.talkingPoints" | translate }}</th>
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
          {{ "CONFLICT.escalationRequested" | translate }}
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="exportPdf()" style="margin-right: auto">
        <mat-icon>picture_as_pdf</mat-icon> {{ "CONFLICT.exportPdf" | translate }}
      </button>
      @if (!data.escalationRequested && data.riskLevel !== 'low') {
        <button mat-stroked-button color="warn" (click)="escalate()">
          <mat-icon>escalator_warning</mat-icon> {{ "CONFLICT.escalateToHR" | translate }}
        </button>
      }
      <button mat-raised-button color="primary" mat-dialog-close>{{ "COMMON.close" | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex; align-items: center; gap: 8px; color: var(--artes-primary);
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

    .section {
      padding: 16px 0;
      h3 {
        display: flex; align-items: center; gap: 6px;
        font-size: 14px; font-weight: 600; color: var(--artes-primary); margin: 0 0 12px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--artes-accent); }
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
      flex-shrink: 0; width: 72px;
    }

    .sub-center {
      flex: 1; min-width: 0;
    }

    .sub-type-label {
      font-size: 13px; font-weight: 600; color: var(--artes-primary); margin-bottom: 6px;
      strong { font-weight: 700; }
      .sub-type-rationale {
        display: block;
        margin-top: 4px;
        font-size: 12px; font-weight: 400; font-style: italic;
        color: #5a6a7e; line-height: 1.5;
      }
    }

    .sub-score-bar-wrap {
      background: #e8edf4; border-radius: 4px; height: 6px; margin-bottom: 6px;
      overflow: hidden;
      &.empty { display: flex; align-items: center; background: transparent; height: auto; }
    }

    .sub-score-bar {
      height: 100%; border-radius: 4px; transition: width 0.5s ease;
      &.low      { background: #27C4A0; }
      &.medium   { background: #f0a500; }
      &.high     { background: #e86c3a; }
      &.critical { background: #e53e3e; }
    }

    .sub-score-bar-placeholder {
      font-size: 12px; color: #9aa5b4; font-style: italic;
    }

    .sub-narrative {
      font-size: 12px; color: #5a6a7e; line-height: 1.5;
      .narrative-toggle {
        color: var(--artes-accent); cursor: pointer; text-decoration: none; font-weight: 500;
        margin-left: 2px;
        &:hover { text-decoration: underline; }
      }
    }

    .sub-right {
      flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
      button {
        display: flex; align-items: center; gap: 4px; font-size: 12px; white-space: nowrap;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
        mat-spinner { margin: 0 2px; }
      }
    }

    /* Script sections */
    .script-box {
      background: #f8fafc; border-radius: 10px; padding: 16px;
      border-left: 3px solid var(--artes-accent);
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
      border-left: 3px solid var(--artes-accent);
    }

    .script-section-title {
      font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--artes-accent); margin-bottom: 8px;
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
        background: #edf2f7; color: var(--artes-primary); font-weight: 600; font-size: 12px;
        &:first-child { border-radius: 6px 0 0 0; width: 30%; }
        &:last-child  { border-radius: 0 6px 0 0; }
      }
      td {
        padding: 8px 10px; vertical-align: top; color: #374151;
        border-bottom: 1px solid #e8edf4;
      }
      tr:last-child td { border-bottom: none; }
      .topic-name { font-weight: 600; color: var(--artes-primary); }
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
  dialogRef = inject(MatDialogRef<ConflictDetailDialogComponent>);
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

  parseType(raw: string) { return parseConflictType(raw); }

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
    const rc: Record<string, string> = { low: '#27C4A0', medium: '#f0a500', high: '#e86c3a', critical: '#e53e3e' };
    const rcBg: Record<string, string> = { low: 'rgba(39,196,160,0.15)', medium: 'rgba(240,165,0,0.15)', high: 'rgba(232,108,58,0.15)', critical: 'rgba(229,62,62,0.15)' };
    const color = rc[d.riskLevel] ?? '#9aa5b4';
    const colorBg = rcBg[d.riskLevel] ?? '#f0f4f8';
    const date = new Date(d.createdAt).toLocaleDateString(localStorage.getItem('artes_language') || 'en', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const subHtml = this.subAnalyses().map((s) => {
      const sc = rc[s.riskLevel] ?? '#9aa5b4';
      const scBg = rcBg[s.riskLevel] ?? '#f0f4f8';
      return `<div class="sub-row" style="border-left-color:${sc}">
        <div class="sub-top">
          <span class="sub-type">${s.focusConflictType ?? ''}</span>
          <span class="sub-score" style="background:${scBg};color:${sc}">${s.riskScore} — ${s.riskLevel.toUpperCase()}</span>
        </div>
        <div class="sub-bar-track"><div class="sub-bar" style="width:${s.riskScore}%;background:${sc}"></div></div>
        <p class="sub-narrative">${s.aiNarrative}</p>
      </div>`;
    }).join('');

    const scriptHtml = (() => {
      const sections = this.scriptSections();
      if (!sections.length && d.managerScript) return `<pre class="script-raw">${d.managerScript}</pre>`;
      return sections.map((sec) => {
        let body = '';
        if (sec.type === 'string') body = `<p>${sec.value}</p>`;
        if (sec.type === 'list') body = `<ul>${sec.items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
        if (sec.type === 'topics') body = `<table><thead><tr><th>Topic</th><th>Talking Points</th></tr></thead><tbody>${sec.topics.map((t) => `<tr><td class="topic-name">${t.topic}</td><td><ul>${t.points.map((p) => `<li>${p}</li>`).join('')}</ul></td></tr>`).join('')}</tbody></table>`;
        return `<div class="script-section"><div class="script-title">${sec.label}</div>${body}</div>`;
      }).join('');
    })();

    const conflictChips = d.conflictTypes
      .map((t) => `<span class="chip">${parseConflictType(t).label}</span>`)
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Conflict Analysis — ${d.departmentId || 'All Departments'}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: var(--artes-primary); margin: 0; padding: 0; background: var(--artes-bg); }
  .page { max-width: 860px; margin: 0 auto; background: white; min-height: 100vh; }

  /* Print bar */
  .print-bar { display: flex; gap: 10px; padding: 14px 32px; background: var(--artes-primary); }
  .print-bar button { padding: 8px 22px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
  .print-bar .btn-print { background: var(--artes-accent); color: white; }
  .print-bar .btn-print:hover { background: #2d8bc2; }
  .print-bar .btn-save { background: #27C4A0; color: white; }
  .print-bar .btn-save:hover { background: #1da888; }
  .print-bar .btn-close { background: rgba(255,255,255,0.15); color: white; }
  .print-bar .btn-close:hover { background: rgba(255,255,255,0.25); }

  .content { padding: 32px; }

  /* Header */
  .header-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .header-row h1 { font-size: 22px; margin: 0; color: var(--artes-primary); }
  .header-row .ci-badge { font-size: 11px; background: #e86c3a; color: white; padding: 3px 10px; border-radius: 999px; font-weight: 700; }
  .meta-line { font-size: 12px; color: #5a6a7e; margin-bottom: 20px; }

  /* Score block */
  .score-row { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 24px; }
  .score-block {
    width: 88px; height: 88px; border-radius: 16px; flex-shrink: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: ${colorBg}; color: ${color};
  }
  .score-num { font-size: 34px; font-weight: 700; line-height: 1; }
  .score-lbl { font-size: 11px; margin-top: 4px; opacity: 0.8; }
  .score-meta { display: flex; flex-direction: column; gap: 6px; padding-top: 4px; }
  .score-meta-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #5a6a7e; }
  .score-meta-icon { font-size: 14px; color: #9aa5b4; }
  .risk-badge { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; background: ${colorBg}; color: ${color}; margin-top: 4px; }

  /* Conflict type chips */
  .chips-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
  .chip { background: rgba(58,159,214,0.1); color: #2080b0; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 500; }

  /* Sections */
  .section { padding: 0 0 16px; }
  .section-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: var(--artes-primary); margin: 0 0 12px; padding-top: 16px; border-top: 2px solid #edf2f7; }
  .section-icon { color: var(--artes-accent); font-size: 18px; }
  .narrative { font-size: 14px; color: #374151; line-height: 1.7; margin: 0; white-space: pre-wrap; }
  .divider { border: none; border-top: 1px solid #edf2f7; margin: 8px 0; }

  /* Sub-analyses */
  .sub-row { background: #f8fafc; border-left: 4px solid #e8edf4; border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; }
  .sub-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .sub-type { font-size: 14px; font-weight: 700; color: var(--artes-primary); }
  .sub-score { padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .sub-bar-track { background: #e8edf4; border-radius: 4px; height: 6px; margin-bottom: 8px; overflow: hidden; }
  .sub-bar { height: 100%; border-radius: 4px; }
  .sub-narrative { font-size: 13px; color: #5a6a7e; line-height: 1.6; margin: 0; }

  /* Script sections */
  .script-section { background: #f8fafc; border-left: 3px solid var(--artes-accent); border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; }
  .script-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--artes-accent); margin-bottom: 8px; }
  .script-section p { font-size: 13px; color: #374151; line-height: 1.7; margin: 0; }
  .script-section ul { margin: 0; padding-left: 18px; }
  .script-section li { font-size: 13px; color: #374151; line-height: 1.7; margin-bottom: 2px; }
  .script-raw { font-family: inherit; font-size: 13px; color: #374151; line-height: 1.7; margin: 0; white-space: pre-wrap; word-break: break-word; background: #f8fafc; border-left: 3px solid var(--artes-accent); border-radius: 8px; padding: 14px 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 10px; background: #edf2f7; color: var(--artes-primary); font-weight: 600; font-size: 12px; }
  th:first-child { border-radius: 6px 0 0 0; width: 30%; }
  th:last-child { border-radius: 0 6px 0 0; }
  td { padding: 8px 10px; vertical-align: top; color: #374151; border-bottom: 1px solid #e8edf4; }
  tr:last-child td { border-bottom: none; }
  .topic-name { font-weight: 600; color: var(--artes-primary); }

  /* Escalation */
  .escalation-banner { display: flex; align-items: center; gap: 8px; background: rgba(229,62,62,0.08); border-radius: 8px; padding: 12px 14px; color: #c53030; font-size: 13px; font-weight: 600; margin-top: 8px; }

  /* Footer */
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #edf2f7; font-size: 11px; color: #9aa5b4; text-align: center; }

  @media print {
    body { background: white; }
    .print-bar { display: none; }
    .page { box-shadow: none; max-width: 100%; }
    .content { padding: 20px; }
  }
</style></head><body>
<div class="print-bar">
  <button class="btn-print" onclick="window.print()">&#128424; Print / Save as PDF</button>
  <button class="btn-close" onclick="window.close()">Close</button>
</div>
<div class="page">
<div class="content">

<div class="header-row">
  <h1>Conflict Intelligence&#8482; Analysis</h1>
  <span class="ci-badge">REPORT</span>
</div>
<div class="meta-line">
  ${d.departmentId || 'All Departments'} &nbsp;&middot;&nbsp; ${d.name} &nbsp;&middot;&nbsp; ${date}
</div>

<div class="score-row">
  <div class="score-block">
    <div class="score-num">${d.riskScore}</div>
    <div class="score-lbl">Risk Score</div>
  </div>
  <div class="score-meta">
    <div class="score-meta-item">&#128197; ${d.name}</div>
    <div class="score-meta-item">&#127970; ${d.departmentId || 'All Departments'}</div>
    <div class="risk-badge">${d.riskLevel.toUpperCase()} RISK</div>
  </div>
</div>

${d.conflictTypes.length ? `<div class="chips-row">${conflictChips}</div>` : ''}

<div class="section">
  <div class="section-title"><span class="section-icon">&#10024;</span> AI Analysis</div>
  <p class="narrative">${d.aiNarrative}</p>
</div>

${this.subAnalyses().length ? `
<div class="section">
  <div class="section-title"><span class="section-icon">&#128269;</span> Drill-down by Conflict Type</div>
  ${subHtml}
</div>` : ''}

${d.managerScript ? `
<div class="section">
  <div class="section-title"><span class="section-icon">&#128483;</span> Manager Conversation Guide</div>
  ${scriptHtml}
</div>` : ''}

${d.escalationRequested ? '<div class="escalation-banner">&#9888; Escalation has been requested — HR / Coach has been notified.</div>' : ''}

<div class="footer">
  ARTES &nbsp;&middot;&nbsp; Conflict Intelligence&#8482; &nbsp;&middot;&nbsp; HeadSoft Tech &times; Helena Coaching
</div>

</div>
</div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  escalate(): void {
    this.dialogRef.close({ action: 'escalate', id: this.data._id });
  }
}
