import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { JournalService, SupervisionDigest } from '../journal.service';

@Component({
  selector: 'app-supervision-digest',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="journal-page">
      <div class="page-header">
        <a routerLink="/journal" class="back-link"><mat-icon>arrow_back</mat-icon> Journal Dashboard</a>
        <h1><mat-icon>supervisor_account</mat-icon> Supervision Digest</h1>
        <p class="page-desc">AI-generated preparation material for your next supervision session, drawn from your reflective entries and session reflections.</p>
      </div>

      @if (!data() && !loading() && !error()) {
        <div class="generate-prompt">
          <mat-icon>psychology</mat-icon>
          <h3>Generate Supervision Digest</h3>
          <p>This will analyze your supervision-ready reflective entries and session reflections to prepare discussion material.</p>
          <button mat-flat-button color="primary" (click)="generate()"><mat-icon>auto_awesome</mat-icon> Generate Digest</button>
        </div>
      }

      @if (loading()) {
        <div class="loading-center">
          <mat-spinner diameter="36" />
          <span>Preparing supervision material...</span>
        </div>
      }

      @if (error()) {
        <div class="error-msg"><mat-icon>warning</mat-icon> {{ error() }}</div>
      }

      @if (data()) {
        <div class="report">
          <div class="report-meta">
            Includes {{ data()!.meta.reflectiveEntriesIncluded }} reflective entries and
            {{ data()!.meta.sessionReflectionsIncluded }} session reflections.
            <button mat-stroked-button (click)="generate()" [disabled]="loading()"><mat-icon>refresh</mat-icon> Regenerate</button>
          </div>

          @if (data()!.coachThemes?.length) {
            <div class="report-section">
              <h3>Coach Themes</h3>
              <div class="theme-list">
                @for (t of data()!.coachThemes; track t) { <span class="theme-chip">{{ t }}</span> }
              </div>
            </div>
          }

          <div class="report-section">
            <h3>Cross-Engagement Patterns</h3>
            <p>{{ data()!.crossEngagementPatterns }}</p>
          </div>

          @if (data()!.questionsForSupervisor?.length) {
            <div class="report-section highlight">
              <h3><mat-icon>help_outline</mat-icon> Questions for Supervisor</h3>
              <ol>@for (q of data()!.questionsForSupervisor; track q) { <li>{{ q }}</li> }</ol>
            </div>
          }

          @if (data()!.developmentAreas?.length) {
            <div class="report-section">
              <h3>Development Areas</h3>
              <ul>@for (a of data()!.developmentAreas; track a) { <li>{{ a }}</li> }</ul>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .journal-page { padding: 32px; max-width: 800px; background: #F8F6F1; min-height: 100%; }
    .page-header {
      margin-bottom: 20px;
      .back-link { display: flex; align-items: center; gap: 4px; color: #3A9FD6; text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
      h1 { font-size: 22px; color: #1B2A47; display: flex; align-items: center; gap: 8px; margin: 0 0 4px;
        mat-icon { color: #7c5cbf; }
      }
      .page-desc { font-size: 13px; color: #5a6a7e; margin: 0; }
    }

    .generate-prompt {
      text-align: center; padding: 48px; background: white; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #7c5cbf; display: block; margin: 0 auto 12px; }
      h3 { color: #1B2A47; margin-bottom: 8px; }
      p { color: #9aa5b4; margin: 0 0 16px; max-width: 500px; margin-left: auto; margin-right: auto; }
    }

    .loading-center {
      display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 64px;
      span { font-size: 14px; color: #5a6a7e; }
    }
    .error-msg {
      display: flex; align-items: center; gap: 6px; background: #fef2f2; color: #e53e3e;
      padding: 12px 16px; border-radius: 8px; font-size: 14px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .report {
      background: white; border-radius: 16px; padding: 28px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .report-meta {
      font-size: 13px; color: #5a6a7e; margin-bottom: 20px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .report-section {
      margin-bottom: 20px;
      h3 { font-size: 15px; font-weight: 700; color: #1B2A47; margin: 0 0 8px; display: flex; align-items: center; gap: 6px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #7c5cbf; }
      }
      p { font-size: 14px; color: #374151; line-height: 1.7; margin: 0; }
      ul, ol { margin: 4px 0 0; padding-left: 18px; font-size: 14px; color: #374151; line-height: 1.8; }
      &.highlight { background: #f3eeff; border-left: 4px solid #7c5cbf; border-radius: 8px; padding: 16px; }
    }
    .theme-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .theme-chip { font-size: 12px; padding: 4px 12px; border-radius: 999px; background: #f3eeff; color: #7c5cbf; font-weight: 500; }

    @media print {
      .page-header, .report-meta button { display: none !important; }
      .journal-page { padding: 0; background: white; }
    }
  `],
})
export class SupervisionDigestComponent {
  loading = signal(false);
  data = signal<SupervisionDigest | null>(null);
  error = signal('');

  constructor(private journal: JournalService) {}

  generate(): void {
    this.loading.set(true);
    this.error.set('');
    this.journal.getSupervisionDigest().subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Failed to generate supervision digest');
      },
    });
  }
}
