import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';

interface AnalysisLite {
  _id: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  parentId?: string | null;
  teamAlignmentScore?: number;
}

interface Pillar {
  icon: string;
  color: string;
  titleKey: string;
  descKey: string;
}

interface ProcessStep {
  icon: string;
  color: string;
  titleKey: string;
  descKey: string;
}

interface RiskSlice {
  key: 'low' | 'medium' | 'high' | 'critical';
  labelKey: string;
  count: number;
}

interface LinkCard {
  route?: string;
  url?: string;
  titleKey: string;
  descKey: string;
  icon: string;
  color: string;
}

interface ToolkitCard {
  titleKey: string;
  descKey: string;
  icon: string;
  color: string;
  pdfUrl: string;
}

@Component({
  selector: 'app-conflict-dashboard-home',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, MatTooltipModule, TranslateModule],
  template: `
    <!-- ── Hero ────────────────────────────────────────────────────────── -->
    <div class="hero">
      <div class="hero-glow"></div>
      <div class="hero-inner">
        <div class="hero-badge">
          <mat-icon>verified</mat-icon>
          <span>Harvard Negotiation Project</span>
        </div>
        <h1>{{ 'CONFLICT.dashTitle' | translate }}</h1>
        <p class="hero-lead">{{ 'CONFLICT.dashSubtitle' | translate }}</p>
        <div class="hero-pills">
          <span class="hero-pill"><mat-icon>poll</mat-icon> {{ 'CONFLICT.pillSurveys' | translate }}</span>
          <span class="hero-pill"><mat-icon>psychology</mat-icon> {{ 'CONFLICT.pillAIMapping' | translate }}</span>
          <span class="hero-pill"><mat-icon>escalator_warning</mat-icon> {{ 'CONFLICT.pillEscalation' | translate }}</span>
          <span class="hero-pill"><mat-icon>trending_up</mat-icon> {{ 'CONFLICT.pillTrend' | translate }}</span>
          <span class="hero-pill"><mat-icon>handshake</mat-icon> {{ 'CONFLICT.pillNegotiation' | translate }}</span>
        </div>
      </div>
    </div>

    <!-- ── Live risk snapshot (directly under hero) ────────────────────── -->
    <section class="block">
      <div class="block-heading">
        <div class="block-icon" style="background: rgba(240,165,0,0.14); color:#f0a500;">
          <mat-icon>monitoring</mat-icon>
        </div>
        <div>
          <h2>{{ 'CONFLICT.riskOverviewTitle' | translate }}</h2>
          <p>{{ 'CONFLICT.riskOverviewDesc' | translate }}</p>
        </div>
        <a class="block-link" routerLink="/conflict/analysis">
          {{ 'CONFLICT.viewAllAnalyses' | translate }}
          <mat-icon>arrow_forward</mat-icon>
        </a>
      </div>

      <div class="risk-grid">
        @for (r of riskSlices(); track r.key) {
          <a class="risk-card" [class]="'risk-card--' + r.key" routerLink="/conflict/analysis">
            <div class="risk-count">{{ r.count }}</div>
            <div class="risk-label">{{ r.labelKey | translate }}</div>
          </a>
        }
      </div>

      @if (teamAlignment() !== null) {
        <a class="alignment-tile" [class]="'alignment-tile--' + alignmentBand(teamAlignment()!)" routerLink="/conflict/analysis">
          <div class="alignment-tile-head">
            <mat-icon>insights</mat-icon>
            <div class="alignment-tile-title">
              <h3>{{ 'CONFLICT.teamAlignment' | translate }}</h3>
              <p>{{ 'CONFLICT.teamAlignmentDesc' | translate }}</p>
            </div>
            <span class="alignment-tile-score">{{ teamAlignment() }}<span class="suffix">/100</span></span>
          </div>
          <div class="alignment-tile-bar">
            <div class="alignment-tile-fill" [style.width.%]="teamAlignment()"></div>
          </div>
          <span class="alignment-tile-band">
            {{ ('CONFLICT.alignmentBand_' + alignmentBand(teamAlignment()!)) | translate }}
          </span>
          <!-- A cross-template/cross-department trend strip would be
               misleading: an alignment score is only comparable across the
               same (template, department) pair. Per-team trend lives on
               the analysis-detail page where scope is unambiguous. -->

        </a>
      }
    </section>

    <!-- ── Methodology pillars ─────────────────────────────────────────── -->
    <section class="block">
      <div class="block-heading">
        <div class="block-icon" style="background: rgba(232,108,58,0.14); color:#e86c3a;">
          <mat-icon>menu_book</mat-icon>
        </div>
        <div>
          <h2>{{ 'CONFLICT.methodologyTitle' | translate }}</h2>
          <p>{{ 'CONFLICT.methodologyDesc' | translate }}</p>
        </div>
      </div>

      <div class="pillars">
        @for (p of pillars; track p.titleKey) {
          <div class="pillar">
            <div class="pillar-icon" [style.background]="p.color + '1c'" [style.color]="p.color">
              <mat-icon>{{ p.icon }}</mat-icon>
            </div>
            <h3>{{ p.titleKey | translate }}</h3>
            <div class="pillar-body" [innerHTML]="p.descKey | translate"></div>
            <span class="pillar-stripe" [style.background]="p.color"></span>
          </div>
        }
      </div>
    </section>

    <!-- ── Process timeline ────────────────────────────────────────────── -->
    <section class="block timeline-block">
      <div class="block-heading">
        <div class="block-icon" style="background: rgba(58,159,214,0.14); color:#3A9FD6;">
          <mat-icon>route</mat-icon>
        </div>
        <div>
          <h2>{{ 'CONFLICT.processTitle' | translate }}</h2>
          <p>{{ 'CONFLICT.processSubtitle' | translate }}</p>
        </div>
      </div>

      <div class="timeline">
        <div class="timeline-rail"></div>
        @for (s of processSteps; track s.titleKey; let i = $index) {
          <div class="timeline-step">
            <div class="timeline-node" [style.background]="s.color">
              <mat-icon>{{ s.icon }}</mat-icon>
              <span class="timeline-num">{{ i + 1 }}</span>
            </div>
            <div class="timeline-content">
              <h4>{{ s.titleKey | translate }}</h4>
              <p>{{ s.descKey | translate }}</p>
            </div>
          </div>
        }
      </div>
    </section>

    <!-- ── Escalation pathway ─────────────────────────────────────────── -->
    <section class="block escalation-block">
      <div class="block-heading">
        <div class="block-icon" style="background: rgba(229,62,62,0.14); color:#e53e3e;">
          <mat-icon>escalator_warning</mat-icon>
        </div>
        <div>
          <h2>{{ 'CONFLICT.mediationPathway' | translate }}</h2>
          <p>{{ 'CONFLICT.mediationPathwayDesc' | translate }}</p>
        </div>
      </div>

      <div class="escalation-grid">
        @for (step of escalationSteps; track step.titleKey; let i = $index) {
          <div class="escalation-step">
            <div class="escalation-num">{{ i + 1 }}</div>
            <div class="escalation-text">
              <strong>{{ step.titleKey | translate }}</strong>
              <span>{{ step.descKey | translate }}</span>
            </div>
          </div>
        }
      </div>

      <a href="mailto:helena@helenacoaching.com?subject=Mediation%20Escalation%20Request"
         mat-stroked-button class="escalation-cta">
        <mat-icon>email</mat-icon>
        {{ 'CONFLICT.contactHelenaForMediation' | translate }}
      </a>
    </section>

    <!-- ── Knowledge & skill building: 3 columns ──────────────────────── -->
    <section class="block">
      <div class="block-heading">
        <div class="block-icon" style="background: rgba(39,196,160,0.14); color:#27C4A0;">
          <mat-icon>school</mat-icon>
        </div>
        <div>
          <h2>{{ 'CONFLICT.knowledgeSectionTitle' | translate }}</h2>
          <p>{{ 'CONFLICT.knowledgeSectionDesc' | translate }}</p>
        </div>
      </div>

      <div class="knowledge-columns-3">
        <div class="knowledge-col">
          <div class="col-label" style="color:#3A9FD6;">
            <mat-icon>layers</mat-icon> {{ 'CONFLICT.inPlatformModules' | translate }}
          </div>
          @for (item of inPlatformPaths; track item.titleKey) {
            <a class="k-card" [routerLink]="item.route">
              <div class="k-icon" [style.background]="item.color + '18'" [style.color]="item.color">
                <mat-icon>{{ item.icon }}</mat-icon>
              </div>
              <div class="k-info">
                <strong>{{ item.titleKey | translate }}</strong>
                <span>{{ item.descKey | translate }}</span>
              </div>
              <mat-icon class="k-arrow">chevron_right</mat-icon>
            </a>
          }
        </div>

        <div class="knowledge-col">
          <div class="col-label" style="color:#e86c3a;">
            <mat-icon>open_in_new</mat-icon> {{ 'CONFLICT.externalAssessments' | translate }}
          </div>
          @for (item of externalTools; track item.titleKey) {
            <a class="k-card" [href]="item.url" target="_blank" rel="noopener">
              <div class="k-icon" [style.background]="item.color + '18'" [style.color]="item.color">
                <mat-icon>{{ item.icon }}</mat-icon>
              </div>
              <div class="k-info">
                <strong>{{ item.titleKey | translate }}</strong>
                <span>{{ item.descKey | translate }}</span>
              </div>
              <mat-icon class="k-arrow">open_in_new</mat-icon>
            </a>
          }
        </div>

        <div class="knowledge-col">
          <div class="col-label" style="color:#7c3aed;">
            <mat-icon>handshake</mat-icon> {{ 'CONFLICT.negotiationToolkit' | translate }}
          </div>
          @for (res of toolkitResources; track res.titleKey) {
            <a class="k-card" [href]="res.pdfUrl" target="_blank" rel="noopener"
               [matTooltip]="('CONFLICT.downloadResource' | translate) + ' ' + (res.titleKey | translate)">
              <div class="k-icon" [style.background]="res.color + '18'" [style.color]="res.color">
                <mat-icon>{{ res.icon }}</mat-icon>
              </div>
              <div class="k-info">
                <strong>{{ res.titleKey | translate }}</strong>
                <span>{{ res.descKey | translate }}</span>
              </div>
              <mat-icon class="k-arrow">download</mat-icon>
            </a>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }

    /* ── Hero ─────────────────────────────────────────────────────────── */
    .hero {
      position: relative;
      margin: 0 0 28px;
      padding: 44px 48px;
      border-radius: 22px;
      background:
        radial-gradient(circle at 15% 20%, rgba(58,159,214,0.28), transparent 55%),
        radial-gradient(circle at 85% 85%, rgba(232,108,58,0.22), transparent 55%),
        linear-gradient(135deg, #0f1a33 0%, #1B2A47 60%, #243558 100%);
      color: white;
      overflow: hidden;
      box-shadow: 0 8px 28px rgba(27,42,71,0.25);
    }
    .hero-glow {
      position: absolute; inset: 0;
      background:
        repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 12px);
      pointer-events: none;
    }
    .hero-inner { position: relative; z-index: 1; width: 100%; }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 12px; border-radius: 999px;
      background: rgba(240,192,64,0.16);
      border: 1px solid rgba(240,192,64,0.45);
      color: #f0c040;
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.8px;
      margin-bottom: 14px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .hero h1 {
      font-size: 34px; font-weight: 700; line-height: 1.15;
      margin: 0 0 14px; letter-spacing: -0.3px;
      color: #ffffff;   /* override the global h1 navy rule */
    }
    .hero-lead {
      font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.85);
      margin: 0 0 22px;
    }
    .hero-pills { display: flex; flex-wrap: wrap; gap: 8px; }
    .hero-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 14px; border-radius: 20px;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.18);
      font-size: 12px; font-weight: 500;
      color: rgba(255,255,255,0.92);
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    /* ── Generic block layout ─────────────────────────────────────────── */
    .block {
      background: white;
      border-radius: 16px;
      padding: 24px 26px 28px;
      margin-bottom: 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.05);
    }
    .block-heading {
      display: flex; align-items: flex-start; gap: 14px;
      margin-bottom: 22px;
    }
    .block-icon {
      width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }
    .block-heading h2 { font-size: 19px; margin: 0 0 4px; color: var(--artes-primary); font-weight: 700; }
    .block-heading p  { font-size: 13px; margin: 0; color: #5a6a7e; line-height: 1.5; }
    .block-heading > div:nth-child(2) { flex: 1; min-width: 0; }
    .block-link {
      margin-left: auto; align-self: center;
      display: inline-flex; align-items: center; gap: 4px;
      color: var(--artes-accent); text-decoration: none;
      font-size: 13px; font-weight: 600;
      white-space: nowrap;
      &:hover { text-decoration: underline; }
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
    }

    /* ── Methodology pillars ─────────────────────────────────────────── */
    .pillars {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 14px;
    }
    .pillar {
      position: relative; overflow: hidden;
      background: #fafbfc;
      border: 1px solid #e8edf4;
      border-radius: 14px;
      padding: 20px 18px 22px;
      transition: transform 0.15s, box-shadow 0.15s;
      &:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.07); }
    }
    .pillar-icon {
      width: 42px; height: 42px; border-radius: 11px;
      display: inline-flex; align-items: center; justify-content: center;
      margin-bottom: 12px;
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }
    .pillar h3 { font-size: 14px; margin: 0 0 8px; color: var(--artes-primary); font-weight: 700; }
    .pillar-body {
      font-size: 12.5px; line-height: 1.6; color: #5a6a7e;
      p  { margin: 0 0 10px; }
      ul { padding-left: 0; margin: 0; list-style: none; }
      li {
        position: relative;
        padding: 5px 0 5px 16px;
        border-top: 1px solid #eef2f7;
        font-size: 12px; line-height: 1.5;
        &:first-child { border-top: none; }
        &::before {
          content: ''; position: absolute; left: 0; top: 12px;
          width: 6px; height: 6px; border-radius: 50%;
          background: currentColor; opacity: 0.35;
        }
      }
      strong { color: var(--artes-primary); font-weight: 600; }
      em { font-style: italic; color: #6b7280; }
    }
    .pillar-stripe {
      position: absolute; left: 0; bottom: 0;
      width: 100%; height: 3px;
    }

    /* ── Timeline ─────────────────────────────────────────────────────── */
    .timeline-block { background: linear-gradient(180deg, #ffffff 0%, #f6f9fc 100%); }
    .timeline {
      position: relative;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 14px;
      padding-top: 8px;
    }
    .timeline-rail {
      position: absolute;
      top: 34px; left: 8%; right: 8%; height: 3px;
      background: linear-gradient(90deg, #27C4A0, #3A9FD6, #f0a500, #e86c3a, #7c3aed);
      border-radius: 3px;
      z-index: 0;
    }
    .timeline-step {
      position: relative; z-index: 1;
      display: flex; flex-direction: column; align-items: center;
      text-align: center;
    }
    .timeline-node {
      width: 68px; height: 68px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: white;
      box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      margin-bottom: 14px;
      position: relative;
      mat-icon { font-size: 28px; width: 28px; height: 28px; }
    }
    .timeline-num {
      position: absolute;
      top: -6px; right: -6px;
      width: 22px; height: 22px; border-radius: 50%;
      background: white; color: var(--artes-primary);
      font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.18);
    }
    .timeline-content h4 {
      font-size: 13px; font-weight: 700; margin: 0 0 4px;
      color: var(--artes-primary);
    }
    .timeline-content p {
      font-size: 13px; line-height: 1.5; margin: 10px 100px;
      color: #5a6a7e;
    }

    @media (max-width: 960px) {
      .timeline {
        grid-template-columns: 1fr;
        gap: 22px;
      }
      .timeline-rail {
        top: 0; bottom: 0; left: 34px; right: auto;
        width: 3px; height: auto;
      }
      .timeline-step { flex-direction: row; align-items: flex-start; text-align: left; gap: 14px; }
      .timeline-node { margin-bottom: 0; flex-shrink: 0; }
    }

    /* ── Risk snapshot ───────────────────────────────────────────────── */
    .risk-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
    }
    .risk-card {
      display: block; text-decoration: none;
      background: white;
      border: 1px solid #e8edf4;
      border-left: 5px solid transparent;
      border-radius: 12px;
      padding: 22px 18px;
      text-align: center;
      transition: transform 0.15s, box-shadow 0.15s;
      &:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08); }
    }
    .risk-count { font-size: 36px; font-weight: 700; line-height: 1; color: var(--artes-primary); }
    .risk-label {
      font-size: 11px; color: #5a6a7e;
      margin-top: 6px;
      text-transform: uppercase; letter-spacing: 0.5px;
      font-weight: 600;
    }
    .risk-card--low      { border-left-color: #27C4A0; .risk-count { color: #27C4A0; } }
    .risk-card--medium   { border-left-color: #f0a500; .risk-count { color: #f0a500; } }
    .risk-card--high     { border-left-color: #e86c3a; .risk-count { color: #e86c3a; } }
    .risk-card--critical { border-left-color: #e53e3e; .risk-count { color: #e53e3e; } }

    /* Team-alignment tile (Phase 1 divergence — appears below the risk grid) */
    .alignment-tile {
      display: block; margin-top: 16px;
      background: white; border: 1px solid #edf1f6; border-left: 4px solid;
      border-radius: 10px; padding: 16px 18px;
      text-decoration: none; color: inherit;
      transition: box-shadow 0.15s, border-color 0.15s;
      &:hover { box-shadow: 0 4px 16px rgba(27,42,71,0.06); }
    }
    .alignment-tile-head {
      display: flex; align-items: center; gap: 14px; margin-bottom: 10px;
      mat-icon { color: var(--artes-accent); flex-shrink: 0; }
      .alignment-tile-title { flex: 1;
        h3 { margin: 0; font-size: 14px; font-weight: 700; color: var(--artes-primary); text-transform: uppercase; letter-spacing: 0.5px; }
        p  { margin: 2px 0 0; font-size: 12px; color: #7f8ea3; }
      }
      .alignment-tile-score {
        font-size: 28px; font-weight: 700; color: var(--artes-primary); font-variant-numeric: tabular-nums;
        .suffix { font-size: 14px; color: #9aa5b4; font-weight: 500; margin-left: 2px; }
      }
    }
    .alignment-tile-bar {
      width: 100%; height: 8px; border-radius: 999px; background: #f0f4f8; overflow: hidden;
      margin-bottom: 8px;
    }
    .alignment-tile-fill {
      height: 100%; border-radius: 999px;
      background: linear-gradient(90deg, #e53e3e 0%, #f0a500 50%, #27C4A0 100%);
      transition: width 0.3s ease;
    }
    .alignment-tile-band {
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
      padding: 2px 10px; border-radius: 999px;
      display: inline-block;
    }
    .alignment-tile--aligned   { border-left-color: #27C4A0;
      .alignment-tile-band { background: rgba(39,196,160,0.15); color: #1a9678; }
    }
    .alignment-tile--mixed     { border-left-color: #f0a500;
      .alignment-tile-band { background: rgba(240,165,0,0.15);  color: #b07800; }
    }
    .alignment-tile--fractured { border-left-color: #e53e3e;
      .alignment-tile-band { background: rgba(229,62,62,0.15);  color: #c53030; }
    }

    @media (max-width: 720px) {
      .risk-grid { grid-template-columns: repeat(2, 1fr); }
    }

    /* ── Escalation pathway ─────────────────────────────────────────── */
    .escalation-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .escalation-step {
      display: flex; gap: 14px; align-items: flex-start;
      background: linear-gradient(135deg, #fef7f5 0%, #fff 100%);
      border: 1px solid #fce0d4; border-radius: 12px;
      padding: 16px 18px;
    }
    .escalation-num {
      width: 32px; height: 32px; border-radius: 50%;
      background: #e53e3e; color: white;
      font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(229,62,62,0.3);
    }
    .escalation-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .escalation-text strong { font-size: 13px; color: var(--artes-primary); }
    .escalation-text span   { font-size: 12px; color: #5a6a7e; line-height: 1.55; }
    .escalation-cta {
      color: #e53e3e !important;
      border-color: #e53e3e !important;
      font-weight: 600;
    }

    /* ── Knowledge / toolkit (3 columns) ─────────────────────────────── */
    .knowledge-columns-3 {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
    }
    @media (max-width: 1100px) {
      .knowledge-columns-3 { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 720px) {
      .knowledge-columns-3 { grid-template-columns: 1fr; }
    }
    .col-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.7px; color: #9aa5b4; margin-bottom: 10px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .k-card {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border-radius: 10px; margin-bottom: 8px;
      border: 1px solid #e8edf4; text-decoration: none; cursor: pointer;
      background: #fafbfc; transition: background 0.13s, border-color 0.13s;
      &:last-child { margin-bottom: 0; }
      &:hover { background: #f0f8ff; border-color: var(--artes-accent); }
    }
    .k-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 20px; }
    }
    .k-info {
      flex: 1; min-width: 0;
      strong { display: block; font-size: 13px; color: var(--artes-primary); margin-bottom: 2px; }
      span { font-size: 11px; color: #6b7280; line-height: 1.4; display: block; }
    }
    .k-arrow { color: #c4cdd6; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }

  `],
})
export class ConflictDashboardHomeComponent implements OnInit {
  constructor(private api: ApiService, private router: Router) {}

  // Live risk distribution
  private analyses = signal<AnalysisLite[]>([]);
  riskSlices = () => {
    const a = this.analyses();
    return this.BASE_SLICES.map((s) => ({ ...s, count: a.filter((x) => x.riskLevel === s.key).length }));
  };

  /** Org-level rolling team-alignment score: average of teamAlignmentScore
   *  across the most recent 5 analyses that have one. Returns null when no
   *  analysis has been scored yet (legacy data, or first run). */
  teamAlignment(): number | null {
    const scores = this.analyses()
      .map((a) => a.teamAlignmentScore)
      .filter((s): s is number => typeof s === 'number')
      .slice(0, 5);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((sum, v) => sum + v, 0) / scores.length);
  }

  alignmentBand(score: number): 'aligned' | 'mixed' | 'fractured' {
    if (score >= 70) return 'aligned';
    if (score >= 40) return 'mixed';
    return 'fractured';
  }

  private readonly BASE_SLICES: RiskSlice[] = [
    { key: 'low',      labelKey: 'CONFLICT.riskLow',      count: 0 },
    { key: 'medium',   labelKey: 'CONFLICT.riskMedium',   count: 0 },
    { key: 'high',     labelKey: 'CONFLICT.riskHigh',     count: 0 },
    { key: 'critical', labelKey: 'CONFLICT.riskCritical', count: 0 },
  ];

  pillars: Pillar[] = [
    { icon: 'balance',       color: '#1B2A47', titleKey: 'CONFLICT.methodHarvardTitle',   descKey: 'CONFLICT.methodHarvardDesc' },
    { icon: 'forum',         color: '#3A9FD6', titleKey: 'CONFLICT.methodThreeConvTitle', descKey: 'CONFLICT.methodThreeConvDesc' },
    { icon: 'diversity_3',   color: '#27C4A0', titleKey: 'CONFLICT.methodThirdSideTitle', descKey: 'CONFLICT.methodThirdSideDesc' },
    { icon: 'speed',         color: '#e86c3a', titleKey: 'CONFLICT.methodRiskModelTitle', descKey: 'CONFLICT.methodRiskModelDesc' },
  ];

  processSteps: ProcessStep[] = [
    { icon: 'poll',               color: '#27C4A0', titleKey: 'CONFLICT.processAssessmentTitle',     descKey: 'CONFLICT.processAssessmentDesc' },
    { icon: 'psychology',         color: '#3A9FD6', titleKey: 'CONFLICT.processAITitle',         descKey: 'CONFLICT.processAIDesc' },
    { icon: 'task_alt',           color: '#f0a500', titleKey: 'CONFLICT.processActionsTitle',    descKey: 'CONFLICT.processActionsDesc' },
    { icon: 'escalator_warning',  color: '#e86c3a', titleKey: 'CONFLICT.processEscalationTitle', descKey: 'CONFLICT.processEscalationDesc' },
    { icon: 'handshake',          color: '#7c3aed', titleKey: 'CONFLICT.processResolutionTitle', descKey: 'CONFLICT.processResolutionDesc' },
  ];

  escalationSteps = [
    { titleKey: 'CONFLICT.step1Title', descKey: 'CONFLICT.step1Desc' },
    { titleKey: 'CONFLICT.step2Title', descKey: 'CONFLICT.step2Desc' },
    { titleKey: 'CONFLICT.step3Title', descKey: 'CONFLICT.step3Desc' },
    { titleKey: 'CONFLICT.step4Title', descKey: 'CONFLICT.step4Desc' },
  ];

  inPlatformPaths: LinkCard[] = [
    { route: '/neuroinclusion',  titleKey: 'CONFLICT.neuroInclusionTitle', descKey: 'CONFLICT.neuroInclusionDesc', icon: 'psychology',        color: '#27C4A0' },
    { route: '/succession',      titleKey: 'CONFLICT.leadershipIDPTitle',  descKey: 'CONFLICT.leadershipIDPDesc',  icon: 'trending_up',       color: '#3A9FD6' },
    { route: '/coach/interview', titleKey: 'CONFLICT.coachInterviewTitle', descKey: 'CONFLICT.coachInterviewDesc', icon: 'record_voice_over', color: '#7c3aed' },
  ];

  externalTools: LinkCard[] = [
    { url: 'https://kilmanndiagnostics.com/overview-thomas-kilmann-conflict-mode-instrument-tki/', titleKey: 'CONFLICT.tkiTitle',   descKey: 'CONFLICT.tkiDesc',   icon: 'swap_horiz',   color: '#3A9FD6' },
    { url: 'https://cad.storefront.mhs.com/collections/eq-i-2-0/',                                  titleKey: 'CONFLICT.eqi20Title', descKey: 'CONFLICT.eqi20Desc', icon: 'insights',     color: '#e86c3a' },
    { url: 'https://cad.storefront.mhs.com/collections/eq-360/',                                    titleKey: 'CONFLICT.eq360Title', descKey: 'CONFLICT.eq360Desc', icon: '360',          color: '#f0a500' },
    { url: 'https://www.discprofile.com/',                                                          titleKey: 'CONFLICT.discTitle',  descKey: 'CONFLICT.discDesc',  icon: 'groups',       color: '#1B2A47' },
    { url: 'https://www.themyersbriggs.com/en-US/Products-and-Services/Myers-Briggs',               titleKey: 'CONFLICT.mbtiTitle',  descKey: 'CONFLICT.mbtiDesc',  icon: 'people_alt',   color: '#7c3aed' },
    { url: 'https://www.viacharacter.org/',                                                         titleKey: 'CONFLICT.viaTitle',   descKey: 'CONFLICT.viaDesc',   icon: 'star_outline', color: '#27C4A0' },
  ];

  private readonly cdnBase = 'https://artes-assets.s3.us-east-1.amazonaws.com/toolkit';

  toolkitResources: ToolkitCard[] = [
    { titleKey: 'CONFLICT.positionsFrameworkTitle',  descKey: 'CONFLICT.positionsFrameworkDesc',  icon: 'compare_arrows', color: '#3A9FD6', pdfUrl: `${this.cdnBase}/positions-vs-interests-framework.pdf` },
    { titleKey: 'CONFLICT.interestMappingTitle',     descKey: 'CONFLICT.interestMappingDesc',     icon: 'account_tree',   color: '#27C4A0', pdfUrl: `${this.cdnBase}/interest-mapping-worksheet.pdf` },
    { titleKey: 'CONFLICT.batnaGuideTitle',          descKey: 'CONFLICT.batnaGuideDesc',          icon: 'route',          color: '#f0a500', pdfUrl: `${this.cdnBase}/batna-assessment-guide.pdf` },
    { titleKey: 'CONFLICT.reframingExercisesTitle',  descKey: 'CONFLICT.reframingExercisesDesc',  icon: 'swap_vert',      color: '#e53e3e', pdfUrl: `${this.cdnBase}/reframing-exercises.pdf` },
    { titleKey: 'CONFLICT.managerPlannerTitle',      descKey: 'CONFLICT.managerPlannerDesc',      icon: 'edit_note',      color: '#7c3aed', pdfUrl: `${this.cdnBase}/manager-conversation-planner.pdf` },
    { titleKey: 'CONFLICT.balconyTechniqueTitle',    descKey: 'CONFLICT.balconyTechniqueDesc',    icon: 'visibility',     color: '#1B2A47', pdfUrl: `${this.cdnBase}/balcony-technique.pdf` },
    { titleKey: 'CONFLICT.conflictDiagnosticTitle',  descKey: 'CONFLICT.conflictDiagnosticDesc',  icon: 'category',       color: '#e86c3a', pdfUrl: `${this.cdnBase}/conflict-type-diagnostic.pdf` },
  ];


  ngOnInit(): void {
    this.api.get<AnalysisLite[]>('/conflict/analyses').subscribe({
      next: (data) => this.analyses.set(data.filter((a) => !a.parentId)),
      error: () => {},
    });
  }
}
