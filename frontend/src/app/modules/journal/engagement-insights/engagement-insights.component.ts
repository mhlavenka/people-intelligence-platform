import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { JournalService, EngagementInsight } from '../journal.service';

@Component({
  selector: 'app-engagement-insights',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="journal-page">
      <div class="page-header">
        <a [routerLink]="'/journal/engagement/' + engagementId" class="back-link"><mat-icon>arrow_back</mat-icon> Back to Notes</a>
        <h1><mat-icon>auto_awesome</mat-icon> Engagement Insights</h1>
      </div>

      @if (!data() && !loading() && !error()) {
        <div class="generate-prompt">
          <mat-icon>insights</mat-icon>
          <h3>Generate Cross-Session Insights</h3>
          <p>Analyze patterns across all completed session notes for this engagement.</p>
          <button mat-flat-button color="primary" (click)="generate()"><mat-icon>auto_awesome</mat-icon> Generate Insights</button>
        </div>
      }

      @if (loading()) {
        <div class="loading-center">
          <mat-spinner diameter="36" />
          <span>Analyzing session patterns...</span>
        </div>
      }

      @if (error()) {
        <div class="error-msg"><mat-icon>warning</mat-icon> {{ error() }}</div>
      }

      @if (data()) {
        <div class="report">
          <div class="report-actions">
            <button mat-stroked-button (click)="generate()" [disabled]="loading()"><mat-icon>refresh</mat-icon> Regenerate</button>
          </div>

          <div class="report-section">
            <h3>Recurring Themes</h3>
            <div class="theme-list">
              @for (t of data()!.recurringThemes; track t) { <span class="theme-chip">{{ t }}</span> }
            </div>
          </div>

          <div class="report-section">
            <h3>Growth Arc</h3>
            <p>{{ data()!.growthArc }}</p>
          </div>

          <div class="report-section">
            <h3>Coach Observations</h3>
            <p>{{ data()!.coachObservations }}</p>
          </div>

          @if (data()!.openThreads?.length) {
            <div class="report-section">
              <h3>Open Threads</h3>
              <ul>@for (t of data()!.openThreads; track t) { <li>{{ t }}</li> }</ul>
            </div>
          }

          <div class="report-section highlight">
            <h3><mat-icon>lightbulb</mat-icon> Suggested Next Focus</h3>
            <p>{{ data()!.suggestedNextFocus }}</p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .journal-page { padding: 32px; max-width: 800px; background: #F8F6F1; min-height: 100%; }
    .page-header {
      margin-bottom: 20px;
      .back-link { display: flex; align-items: center; gap: 4px; color: #3A9FD6; text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
      h1 { font-size: 22px; color: #1B2A47; display: flex; align-items: center; gap: 8px; margin: 0;
        mat-icon { color: #27C4A0; }
      }
    }

    .generate-prompt {
      text-align: center; padding: 48px; background: white; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #27C4A0; display: block; margin: 0 auto 12px; }
      h3 { color: #1B2A47; margin-bottom: 8px; }
      p { color: #9aa5b4; margin: 0 0 16px; }
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
    .report-actions { text-align: right; margin-bottom: 16px; }
    .report-section {
      margin-bottom: 20px;
      h3 { font-size: 15px; font-weight: 700; color: #1B2A47; margin: 0 0 8px; display: flex; align-items: center; gap: 6px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #27C4A0; }
      }
      p { font-size: 14px; color: #374151; line-height: 1.7; margin: 0; }
      ul { margin: 4px 0 0; padding-left: 18px; font-size: 14px; color: #374151; line-height: 1.7; }
      &.highlight { background: #f0faf6; border-left: 4px solid #27C4A0; border-radius: 8px; padding: 16px; }
    }
    .theme-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .theme-chip { font-size: 12px; padding: 4px 12px; border-radius: 999px; background: #f3eeff; color: #7c5cbf; font-weight: 500; }

    @media print {
      .page-header, .report-actions { display: none !important; }
      .journal-page { padding: 0; background: white; }
    }
  `],
})
export class EngagementInsightsComponent implements OnInit {
  engagementId = '';
  loading = signal(false);
  data = signal<EngagementInsight | null>(null);
  error = signal('');

  constructor(private route: ActivatedRoute, private journal: JournalService) {}

  ngOnInit(): void {
    this.engagementId = this.route.snapshot.params['engagementId'];
  }

  generate(): void {
    this.loading.set(true);
    this.error.set('');
    this.journal.getEngagementInsights(this.engagementId).subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Failed to generate insights');
      },
    });
  }
}
