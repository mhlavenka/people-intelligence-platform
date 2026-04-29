import { Component, OnInit, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import { AuthService, AppRole } from '../../../core/auth.service';
import { OrgContextService } from '../../../core/org-context.service';
import { BookingService, BookingRecord } from '../../booking/booking.service';

interface DashboardStats {
  conflict:       { value: number | null; label: string };
  neuroinclusion: { value: number | null; label: string };
  succession:     { value: number | null; label: string };
  surveys:        { responses: number; activeSurveys: number };
}

interface ModuleCard {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  route: string;
  metric: string | null;
  metricLabel: string;
  status: 'active' | 'warning' | 'inactive';
  /** Two-to-three short bullet excerpts shown on the card describing
   *  what the module does and the methodology behind it. */
  highlights: string[];
  module?: string;        // org subscription module key required
  roles?: AppRole[];      // user roles allowed (undefined = all)
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatProgressBarModule, MatProgressSpinnerModule, MatTooltipModule, DatePipe, TranslateModule],
  template: `
    <div class="dashboard-page">

      <!-- Hero header -->
      <header class="hero">
        <svg class="hero-deco" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="heroGrad" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stop-color="#3A9FD6" stop-opacity="0.18"/>
              <stop offset="100%" stop-color="#27C4A0" stop-opacity="0.08"/>
            </linearGradient>
          </defs>
          <path d="M0,140 C300,40 700,200 1200,80 L1200,200 L0,200 Z" fill="url(#heroGrad)"/>
          <circle cx="120" cy="50" r="60" fill="rgba(58,159,214,0.06)"/>
          <circle cx="1080" cy="160" r="80" fill="rgba(39,196,160,0.07)"/>
        </svg>
        <div class="hero-content">
          <div class="hero-text">
            <span class="hero-eyebrow">{{ 'DASHBOARD.heroEyebrow' | translate }}</span>
            <h1>{{ 'DASHBOARD.title' | translate }}</h1>
            <p>{{ 'DASHBOARD.welcomeBack' | translate:{ name: firstName() } }}</p>
          </div>
          <div class="hero-side">
            <span class="last-updated">
              <mat-icon>update</mat-icon>
              {{ 'DASHBOARD.updatedJustNow' | translate }}
            </span>
          </div>
        </div>
      </header>

      <!-- How ARTES works -->
      <section class="how-it-works">
        <svg class="how-deco" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="howGrad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stop-color="#1B2A47"/>
              <stop offset="100%" stop-color="#243558"/>
            </linearGradient>
          </defs>
          <rect width="1200" height="300" fill="url(#howGrad)"/>
          <circle cx="200" cy="80" r="120" fill="rgba(58,159,214,0.10)"/>
          <circle cx="1000" cy="220" r="160" fill="rgba(39,196,160,0.08)"/>
          <path d="M0,250 C400,180 800,290 1200,220" stroke="rgba(255,255,255,0.05)" stroke-width="2" fill="none"/>
        </svg>
        <div class="how-content">
          <span class="section-eyebrow light">{{ 'DASHBOARD.howEyebrow' | translate }}</span>
          <h2>{{ 'DASHBOARD.howTitle' | translate }}</h2>
          <div class="how-steps">
            <div class="how-step">
              <div class="how-step-num">1</div>
              <mat-icon>poll</mat-icon>
              <h4>{{ 'DASHBOARD.howStep1Title' | translate }}</h4>
              <p>{{ 'DASHBOARD.howStep1Desc' | translate }}</p>
            </div>
            <div class="how-step-arrow"><mat-icon>arrow_forward</mat-icon></div>
            <div class="how-step">
              <div class="how-step-num">2</div>
              <mat-icon>auto_awesome</mat-icon>
              <h4>{{ 'DASHBOARD.howStep2Title' | translate }}</h4>
              <p>{{ 'DASHBOARD.howStep2Desc' | translate }}</p>
            </div>
            <div class="how-step-arrow"><mat-icon>arrow_forward</mat-icon></div>
            <div class="how-step">
              <div class="how-step-num">3</div>
              <mat-icon>handshake</mat-icon>
              <h4>{{ 'DASHBOARD.howStep3Title' | translate }}</h4>
              <p>{{ 'DASHBOARD.howStep3Desc' | translate }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Module cards -->
      <div class="module-grid">
        @for (card of visibleCards(); track card.route) {
          <article class="module-card" [class]="'module-card--' + card.status" [routerLink]="card.route">
            <div class="card-accent" [style.background]="card.color"></div>
            <div class="card-header">
              <div class="card-icon" [style.background]="card.color">
                <mat-icon>{{ card.icon }}</mat-icon>
              </div>
              <span class="status-dot" [class]="card.status"
                    [matTooltip]="('DASHBOARD.status_' + card.status) | translate"></span>
            </div>
            <div class="card-body">
              <h3>{{ card.title }}</h3>
              <p class="card-subtitle">{{ card.subtitle }}</p>
              <ul class="card-highlights">
                @for (h of card.highlights; track $index) {
                  <li>
                    <mat-icon>check_circle</mat-icon>
                    <span>{{ h }}</span>
                  </li>
                }
              </ul>
            </div>
            <div class="card-metric-row">
              <div class="card-metric">
                @if (card.metric !== null) {
                  <span class="metric-value">{{ card.metric }}</span>
                  <span class="metric-label">{{ card.metricLabel }}</span>
                } @else {
                  <span class="metric-value metric-none">—</span>
                  <span class="metric-label">{{ 'DASHBOARD.noDataYet' | translate }}</span>
                }
              </div>
              <span class="card-cta">
                {{ 'DASHBOARD.open' | translate }}
                <mat-icon>arrow_forward</mat-icon>
              </span>
            </div>
          </article>
        }
      </div>

      @if (visibleCards().length === 0 && orgCtx.loaded()) {
        <div class="empty-state">
          <mat-icon>dashboard_customize</mat-icon>
          <h3>{{ 'DASHBOARD.noModulesTitle' | translate }}</h3>
          <p>{{ 'DASHBOARD.noModulesDesc' | translate }}</p>
        </div>
      }

      <!-- Compact upcoming events -->
      @if (showUpcoming()) {
        <section class="section-card upcoming-card">
          <div class="section-header">
            <h2><mat-icon class="sh-icon">event</mat-icon> {{ 'DASHBOARD.upcomingEvents' | translate }}</h2>
            <a mat-button color="primary" routerLink="/booking">{{ 'DASHBOARD.viewAll' | translate }}</a>
          </div>
          @if (upcomingLoading()) {
            <div class="upcoming-loading"><mat-spinner diameter="28" /></div>
          } @else if (!upcomingEvents().length) {
            <div class="upcoming-empty">
              <mat-icon>event_available</mat-icon>
              <span>{{ 'DASHBOARD.noUpcomingSessions' | translate }}</span>
            </div>
          } @else {
            <ul class="upcoming-list">
              @for (b of upcomingEvents(); track b._id) {
                <li class="upcoming-item">
                  <div class="upcoming-date">
                    <span class="upcoming-day">{{ b.startTime | date:'d' }}</span>
                    <span class="upcoming-month">{{ b.startTime | date:'MMM' }}</span>
                  </div>
                  <div class="upcoming-body">
                    <div class="upcoming-title">{{ b.clientName }}</div>
                    <div class="upcoming-meta">
                      {{ b.startTime | date:'shortTime' }} &middot;
                      <span class="upcoming-type">{{ b.eventTypeName || 'Session' }}</span>
                    </div>
                  </div>
                  @if (b.googleMeetLink) {
                    <a mat-icon-button [href]="b.googleMeetLink" target="_blank"
                       [matTooltip]="'DASHBOARD.joinGoogleMeet' | translate">
                      <mat-icon>videocam</mat-icon>
                    </a>
                  }
                </li>
              }
            </ul>
          }
        </section>
      }

      <!-- Methodology section -->
      <section class="methodology-section">
        <div class="section-intro">
          <span class="section-eyebrow">{{ 'DASHBOARD.methodologyEyebrow' | translate }}</span>
          <h2>{{ 'DASHBOARD.methodologyTitle' | translate }}</h2>
          <p>{{ 'DASHBOARD.methodologyIntro' | translate }}</p>
        </div>
        <div class="methodology-grid">
          <div class="methodology-card hnp">
            <div class="methodology-icon"><mat-icon>balance</mat-icon></div>
            <h3>{{ 'DASHBOARD.methodHNP' | translate }}</h3>
            <p>{{ 'DASHBOARD.methodHNPDesc' | translate }}</p>
            <span class="methodology-cite">{{ 'DASHBOARD.methodHNPCite' | translate }}</span>
          </div>
          <div class="methodology-card three-conv">
            <div class="methodology-icon"><mat-icon>forum</mat-icon></div>
            <h3>{{ 'DASHBOARD.methodThreeConv' | translate }}</h3>
            <p>{{ 'DASHBOARD.methodThreeConvDesc' | translate }}</p>
            <span class="methodology-cite">{{ 'DASHBOARD.methodThreeConvCite' | translate }}</span>
          </div>
          <div class="methodology-card third-side">
            <div class="methodology-icon"><mat-icon>diversity_3</mat-icon></div>
            <h3>{{ 'DASHBOARD.methodThirdSide' | translate }}</h3>
            <p>{{ 'DASHBOARD.methodThirdSideDesc' | translate }}</p>
            <span class="methodology-cite">{{ 'DASHBOARD.methodThirdSideCite' | translate }}</span>
          </div>
          <div class="methodology-card grow">
            <div class="methodology-icon"><mat-icon>psychology_alt</mat-icon></div>
            <h3>{{ 'DASHBOARD.methodGROW' | translate }}</h3>
            <p>{{ 'DASHBOARD.methodGROWDesc' | translate }}</p>
            <span class="methodology-cite">{{ 'DASHBOARD.methodGROWCite' | translate }}</span>
          </div>
        </div>
      </section>

      <!-- Pull quote -->
      <aside class="pull-quote">
        <mat-icon class="quote-mark">format_quote</mat-icon>
        <blockquote>{{ 'DASHBOARD.quoteText' | translate }}</blockquote>
        <cite>{{ 'DASHBOARD.quoteAttr' | translate }}</cite>
      </aside>

    </div>
  `,
  styles: [`
    .dashboard-page {
      padding: 0 0 48px;
      max-width: 100%;
      box-sizing: border-box;
    }

    /* ─── Hero ────────────────────────────────────────────────────────── */
    .hero {
      position: relative;
      padding: 36px 32px 28px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .hero-deco {
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none;
    }
    .hero-content {
      position: relative;
      display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
      flex-wrap: wrap;
    }
    .hero-eyebrow {
      display: inline-block;
      font-size: 11px; font-weight: 800; letter-spacing: 0.7px; text-transform: uppercase;
      color: var(--artes-accent);
      padding: 4px 12px; border-radius: 999px;
      background: rgba(58,159,214,0.12);
      margin-bottom: 8px;
    }
    .hero-text h1 { font-size: 32px; color: var(--artes-primary); margin: 0 0 6px; letter-spacing: -0.3px; }
    .hero-text p  { color: #5a6a7e; margin: 0; font-size: 15px; max-width: 560px; line-height: 1.5; }
    .hero-side .last-updated {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; color: #9aa5b4;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    /* ─── Module grid ─────────────────────────────────────────────────── */
    .module-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      padding: 0 32px;
      margin-bottom: 32px;
    }
    .module-card {
      position: relative;
      background: white;
      border-radius: 16px;
      padding: 22px 22px 16px;
      box-shadow: 0 2px 14px rgba(27,42,71,0.06);
      cursor: pointer;
      transition: transform 0.18s ease, box-shadow 0.18s ease;
      border: 1.5px solid transparent;
      overflow: hidden;
      display: flex; flex-direction: column;
      min-height: 250px;
    }
    .module-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 28px rgba(27,42,71,0.12);
    }
    .module-card--warning { border-color: rgba(240, 165, 0, 0.35); }
    .card-accent {
      position: absolute; top: 0; left: 0; right: 0; height: 3px;
      opacity: 0.85;
    }
    .card-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
    }
    .card-icon {
      width: 44px; height: 44px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(27,42,71,0.12);
      mat-icon { color: white; font-size: 22px; width: 22px; height: 22px; }
    }
    .status-dot {
      width: 10px; height: 10px; border-radius: 50%;
      &.active   { background: #27C4A0; box-shadow: 0 0 0 4px rgba(39,196,160,0.15); }
      &.warning  { background: #f0a500; box-shadow: 0 0 0 4px rgba(240,165,0,0.15); }
      &.inactive { background: #c5d0db; }
    }
    .module-card h3 { font-size: 16px; color: var(--artes-primary); margin: 0 0 4px; font-weight: 700; }
    .card-subtitle {
      font-size: 12.5px; color: #5a6a7e; margin: 0 0 12px; line-height: 1.5;
    }
    .card-highlights {
      list-style: none; margin: 0 0 14px; padding: 0;
      display: flex; flex-direction: column; gap: 6px;
      li {
        display: flex; align-items: flex-start; gap: 7px;
        font-size: 12px; color: #46546b; line-height: 1.4;
        mat-icon { font-size: 14px; width: 14px; height: 14px; color: var(--artes-accent); flex-shrink: 0; margin-top: 1px; }
      }
    }
    .card-metric-row {
      display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
      margin-top: auto;
      padding-top: 12px; border-top: 1px solid #f0f4f8;
    }
    .card-metric {
      display: flex; flex-direction: column; gap: 2px;
      .metric-value { font-size: 26px; font-weight: 800; color: var(--artes-primary); line-height: 1; }
      .metric-value.metric-none { color: #c5d0db; }
      .metric-label { font-size: 11px; color: #9aa5b4; text-transform: uppercase; letter-spacing: 0.4px; }
    }
    .card-cta {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px; font-weight: 700; color: var(--artes-accent);
      text-transform: uppercase; letter-spacing: 0.4px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; transition: transform 0.18s ease; }
    }
    .module-card:hover .card-cta mat-icon { transform: translateX(3px); }

    /* ─── Empty state ─────────────────────────────────────────────────── */
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 48px; gap: 12px; text-align: center;
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin: 0 32px 28px;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #c5d0db; }
      h3 { font-size: 18px; color: var(--artes-primary); margin: 0; }
      p  { font-size: 14px; color: #9aa5b4; margin: 0; max-width: 400px; }
    }

    /* ─── Compact upcoming events ─────────────────────────────────────── */
    .section-card {
      background: white;
      border-radius: 16px;
      padding: 18px 22px;
      box-shadow: 0 2px 12px rgba(27,42,71,0.06);
      margin: 0 32px 28px;
    }
    .upcoming-card { max-height: 280px; display: flex; flex-direction: column; }
    .section-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
      h2 { font-size: 16px; color: var(--artes-primary); margin: 0; display: flex; align-items: center; gap: 8px; font-weight: 700; }
      .sh-icon { color: var(--artes-accent); font-size: 20px; width: 20px; height: 20px; }
    }
    .upcoming-loading { display: flex; justify-content: center; padding: 16px; }
    .upcoming-empty {
      display: flex; align-items: center; gap: 10px;
      padding: 14px; color: #9aa5b4; font-size: 13px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #c8d3df; }
    }
    .upcoming-list {
      list-style: none; margin: 0; padding: 0;
      flex: 1; min-height: 0; overflow-y: auto;
      scrollbar-width: thin; scrollbar-color: #d1d5db transparent;
      &::-webkit-scrollbar { width: 6px; }
      &::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
    }
    .upcoming-item {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 4px;
      border-bottom: 1px solid #f0f4f8;
      &:last-child { border-bottom: none; }
    }
    .upcoming-date {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-width: 42px; padding: 5px 4px; border-radius: 8px;
      background: #f0f9fd; color: var(--artes-primary);
      .upcoming-day   { font-size: 16px; font-weight: 700; line-height: 1; }
      .upcoming-month { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; color: var(--artes-accent); }
    }
    .upcoming-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .upcoming-title { font-size: 13px; font-weight: 600; color: var(--artes-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .upcoming-meta { font-size: 11.5px; color: #5a6a7e; }
    .upcoming-type { color: var(--artes-accent); font-weight: 500; }

    /* ─── Methodology section ─────────────────────────────────────────── */
    .methodology-section {
      padding: 12px 32px 28px;
    }
    .section-intro {
      max-width: 720px; margin-bottom: 22px;
      h2 { font-size: 24px; color: var(--artes-primary); margin: 4px 0 8px; letter-spacing: -0.2px; }
      p  { font-size: 14px; color: #5a6a7e; margin: 0; line-height: 1.6; }
    }
    .section-eyebrow {
      display: inline-block;
      font-size: 11px; font-weight: 800; letter-spacing: 0.7px; text-transform: uppercase;
      color: var(--artes-accent);
      padding: 3px 10px; border-radius: 999px;
      background: rgba(58,159,214,0.12);
      &.light {
        color: #8bd0ff;
        background: rgba(255,255,255,0.10);
      }
    }
    .methodology-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    .methodology-card {
      position: relative;
      background: white;
      border-radius: 14px;
      padding: 20px 22px 18px;
      box-shadow: 0 2px 12px rgba(27,42,71,0.05);
      border: 1px solid #eef2f7;
      transition: transform 0.18s ease, box-shadow 0.18s ease;
      overflow: hidden;
    }
    .methodology-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    }
    .methodology-card.hnp::before        { background: linear-gradient(90deg, #3A9FD6, #2080b0); }
    .methodology-card.three-conv::before { background: linear-gradient(90deg, #e86c3a, #f0a500); }
    .methodology-card.third-side::before { background: linear-gradient(90deg, #27C4A0, #1a9678); }
    .methodology-card.grow::before       { background: linear-gradient(90deg, #7c5cbf, #5a3ea0); }
    .methodology-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 22px rgba(27,42,71,0.10);
    }
    .methodology-icon {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 12px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .methodology-card.hnp .methodology-icon        { background: rgba(58,159,214,0.12);  mat-icon { color: #2080b0; } }
    .methodology-card.three-conv .methodology-icon { background: rgba(232,108,58,0.12);  mat-icon { color: #c04a14; } }
    .methodology-card.third-side .methodology-icon { background: rgba(39,196,160,0.12);  mat-icon { color: #1a9678; } }
    .methodology-card.grow .methodology-icon       { background: rgba(124,92,191,0.12); mat-icon { color: #5e3fa8; } }
    .methodology-card h3 { font-size: 15px; color: var(--artes-primary); margin: 0 0 6px; font-weight: 700; }
    .methodology-card p  { font-size: 12.5px; color: #46546b; margin: 0 0 10px; line-height: 1.55; }
    .methodology-cite {
      display: inline-block; font-size: 11px; color: #9aa5b4;
      font-style: italic;
      padding-top: 8px; border-top: 1px solid #f0f4f8; width: 100%;
    }

    /* ─── How it works (dark band) ────────────────────────────────────── */
    .how-it-works {
      position: relative;
      margin: 8px 0 28px;
      padding: 36px 32px;
      overflow: hidden;
    }
    .how-deco { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .how-content { position: relative; max-width: 1200px; margin: 0 auto; }
    .how-content h2 { font-size: 24px; color: white; margin: 6px 0 22px; letter-spacing: -0.2px; }
    .how-steps {
      display: flex; align-items: stretch; gap: 14px; flex-wrap: wrap;
    }
    .how-step {
      flex: 1; min-width: 220px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 14px;
      padding: 20px 22px;
      color: white;
      backdrop-filter: blur(6px);
      position: relative;
      h4 { font-size: 15px; color: white; margin: 12px 0 6px; font-weight: 700; }
      p  { font-size: 12.5px; color: rgba(255,255,255,0.78); margin: 0; line-height: 1.55; }
      mat-icon { color: #f0c040; font-size: 26px; width: 26px; height: 26px; }
    }
    .how-step-num {
      position: absolute; top: -10px; right: 14px;
      width: 28px; height: 28px; border-radius: 50%;
      background: linear-gradient(135deg, #3A9FD6, #27C4A0);
      color: white; font-size: 12px; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(58,159,214,0.4);
    }
    .how-step-arrow {
      align-self: center; flex: 0 0 auto;
      mat-icon { color: rgba(255,255,255,0.35); font-size: 22px; width: 22px; height: 22px; }
    }

    /* ─── Pull quote ──────────────────────────────────────────────────── */
    .pull-quote {
      max-width: 880px; margin: 8px auto 0;
      padding: 32px 36px;
      text-align: center; position: relative;
      .quote-mark { font-size: 36px; width: 36px; height: 36px; color: var(--artes-accent); opacity: 0.55; }
      blockquote {
        font-size: 18px; line-height: 1.6;
        color: var(--artes-primary); font-style: italic; font-weight: 500;
        margin: 8px 0 12px; max-width: 720px; margin-left: auto; margin-right: auto;
      }
      cite {
        font-size: 12.5px; font-style: normal; font-weight: 700; letter-spacing: 0.4px;
        color: #5a6a7e; text-transform: uppercase;
      }
    }

    @media (max-width: 720px) {
      .module-grid { padding: 0 18px; }
      .methodology-section { padding: 0 18px 20px; }
      .how-it-works { padding: 30px 18px; }
      .section-card { margin: 0 18px 24px; }
      .hero { padding: 28px 18px 22px; }
      .hero-text h1 { font-size: 26px; }
      .how-step-arrow { display: none; }
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private api = inject(ApiService);
  private bookingSvc = inject(BookingService);
  private translateSvc = inject(TranslateService);
  private langSub?: Subscription;
  orgCtx = inject(OrgContextService);

  firstName = signal('');
  upcomingEvents = signal<BookingRecord[]>([]);
  upcomingLoading = signal(true);
  /** Upcoming events are meaningful for anyone who can have bookings
   *  (everyone except coachees, who already see their own sessions
   *  elsewhere). The backend returns coach-scoped bookings, so admins /
   *  HR see their own — typically empty and that's fine. */
  showUpcoming = computed(() => {
    const u = this.authService.currentUser();
    if (!u?.role) return false;
    return u.role !== 'coachee' && u.isCoachee !== true;
  });
  moduleCards = signal<ModuleCard[]>(this.defaultCards());

  /** Module cards filtered by org subscription + user role. */
  visibleCards = computed(() => {
    const cards = this.moduleCards();
    const modules = this.orgCtx.modules();
    const role = this.authService.currentUser()?.role;
    if (!role) return [];

    return cards.filter((card) => {
      if (card.module && !modules.includes(card.module)) return false;
      if (card.roles && !card.roles.includes(role)) return false;
      return true;
    });
  });


  private defaultCards(): ModuleCard[] {
    const t = (key: string) => this.translateSvc.instant(key);
    const arr = (key: string): string[] => {
      const v = this.translateSvc.instant(key);
      return Array.isArray(v) ? v : [];
    };
    return [
      {
        title: t('DASHBOARD.conflictTitle'),
        subtitle: t('DASHBOARD.conflictSubtitle'),
        icon: 'warning_amber',
        color: 'linear-gradient(135deg, #e86c3a, #e53e3e)',
        route: '/conflict',
        metric: null,
        metricLabel: t('DASHBOARD.activeAnalyses'),
        status: 'active',
        highlights: arr('DASHBOARD.conflictHighlights'),
        module: 'conflict',
        roles: ['admin', 'hr_manager', 'manager', 'coach'],
      },
      {
        title: t('DASHBOARD.neuroTitle'),
        subtitle: t('DASHBOARD.neuroSubtitle'),
        icon: 'psychology',
        color: 'linear-gradient(135deg, #27C4A0, #1a9678)',
        route: '/neuroinclusion',
        metric: null,
        metricLabel: t('DASHBOARD.avgMaturityScore'),
        status: 'active',
        highlights: arr('DASHBOARD.neuroHighlights'),
        module: 'neuroinclusion',
        roles: ['admin', 'hr_manager', 'manager'],
      },
      {
        title: t('DASHBOARD.successionTitle'),
        subtitle: t('DASHBOARD.successionSubtitle'),
        icon: 'trending_up',
        color: 'linear-gradient(135deg, #3A9FD6, #2080b0)',
        route: '/succession',
        metric: null,
        metricLabel: t('DASHBOARD.activeIDPs'),
        status: 'active',
        highlights: arr('DASHBOARD.successionHighlights'),
        module: 'succession',
        roles: ['admin', 'hr_manager', 'coach', 'employee', 'coachee'],
      },
      {
        title: t('DASHBOARD.coachingTitle'),
        subtitle: t('DASHBOARD.coachingSubtitle'),
        icon: 'psychology_alt',
        color: 'linear-gradient(135deg, #7c5cbf, #5a3ea0)',
        route: '/coaching',
        metric: null,
        metricLabel: t('DASHBOARD.activeEngagements'),
        status: 'active',
        highlights: arr('DASHBOARD.coachingHighlights'),
        module: 'coaching',
        roles: ['admin', 'hr_manager', 'coach', 'employee', 'coachee'],
      },
      {
        title: t('DASHBOARD.assessmentsTitle'),
        subtitle: t('DASHBOARD.assessmentsSubtitle'),
        icon: 'assignment',
        color: 'linear-gradient(135deg, #9aa5b4, #5a6a7e)',
        route: '/intakes',
        metric: null,
        metricLabel: t('DASHBOARD.responsesCollected'),
        status: 'active',
        highlights: arr('DASHBOARD.assessmentsHighlights'),
        roles: ['admin', 'hr_manager', 'coach'],
      },
    ];
  }

  private applyStats(stats: DashboardStats): void {
    this.moduleCards.update((cards) => cards.map((card) => {
      if (card.route === '/conflict') {
        const v = stats.conflict.value;
        return { ...card, metric: v !== null ? String(v) : null, metricLabel: stats.conflict.label, status: (v && v > 0 ? 'warning' : 'active') as ModuleCard['status'] };
      }
      if (card.route === '/neuroinclusion') {
        const v = stats.neuroinclusion.value;
        return { ...card, metric: v !== null ? String(v) : null, metricLabel: stats.neuroinclusion.label };
      }
      if (card.route === '/succession') {
        const v = stats.succession.value;
        return { ...card, metric: v !== null ? String(v) : null, metricLabel: stats.succession.label };
      }
      if (card.route === '/intakes') {
        const { responses, activeSurveys } = stats.surveys;
        return { ...card, metric: String(activeSurveys), metricLabel: this.translateSvc.instant('DASHBOARD.activeAssessmentsResponses', { responses }) };
      }
      return card;
    }));
  }

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) this.firstName.set(user.firstName);

    this.langSub = this.translateSvc.onLangChange.subscribe(() => {
      this.moduleCards.set(this.defaultCards());
    });

    if (this.showUpcoming()) {
      this.bookingSvc.getBookings('upcoming', 1, 10).subscribe({
        next: (res) => {
          const sorted = [...res.bookings].sort(
            (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
          );
          this.upcomingEvents.set(sorted.slice(0, 8));
          this.upcomingLoading.set(false);
        },
        error: () => this.upcomingLoading.set(false),
      });
    }

    this.api.get<DashboardStats>('/dashboard/stats').subscribe({
      next: (stats) => this.applyStats(stats),
      error: () => {},
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }
}
