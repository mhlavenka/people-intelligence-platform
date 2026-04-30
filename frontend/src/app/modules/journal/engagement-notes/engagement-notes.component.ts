import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { JournalService, SessionNote, EngagementInsight } from '../journal.service';
import { ApiService } from '../../../core/api.service';

import { TranslateModule } from '@ngx-translate/core';
interface EngagementInfo {
  _id: string;
  status: string;
  coacheeId: { _id: string; firstName: string; lastName: string } | null;
}

@Component({
  selector: 'app-engagement-notes',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatCheckboxModule, MatDividerModule,
    TranslateModule,
  ],
  template: `
    <div class="journal-page">
      <!-- Header -->
      <div class="page-header">
        <a [routerLink]="'/coaching/' + engagementId" class="back-link"><mat-icon>arrow_back</mat-icon> {{ 'COACHING.backToEngagement' | translate }}</a>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {
        <div class="eng-header">
          <div class="eng-title">
            <mat-icon>auto_stories</mat-icon>
            <div>
              <h1>{{ 'JOURNAL.sessionJournalTitle' | translate }}</h1>
              @if (engagement()) {
                <span class="coachee-name">{{ engagement()!.coacheeId?.firstName }} {{ engagement()!.coacheeId?.lastName }}</span>
                <span class="eng-status" [class]="engagement()!.status">{{ engagement()!.status }}</span>
              }
            </div>
          </div>
          <div class="header-actions">
            <a mat-flat-button color="primary" [routerLink]="'/journal/note/new/' + engagementId">
              <mat-icon>add</mat-icon> {{ 'JOURNAL.newSessionNote' | translate }}
            </a>
            @if (notes().length >= 2) {
              <button mat-stroked-button (click)="generateInsights()" [disabled]="insightsLoading()">
                <mat-icon>auto_awesome</mat-icon> {{ insights() ? ('JOURNAL.regenerateInsights' | translate) : ('JOURNAL.generateInsightsLabel' | translate) }} {{ 'JOURNAL.insights' | translate }}
              </button>
            }
          </div>
        </div>

        <!-- Timeline -->
        @if (notes().length === 0) {
          <div class="empty-state">
            <mat-icon>description</mat-icon>
            <h3>{{ 'JOURNAL.noSessionNotes' | translate }}</h3>
            <p>{{ 'JOURNAL.captureFirstSession' | translate }}</p>
          </div>
        } @else {
          <div class="timeline">
            @for (note of notes(); track note._id) {
              <div class="timeline-item">
                <div class="timeline-node" [class.complete]="note.status === 'complete'" [class.draft]="note.status === 'draft'">
                  <span>{{ note.sessionNumber }}</span>
                </div>
                <a class="timeline-card" [routerLink]="'/journal/note/' + note._id">
                  <div class="tc-header">
                    <span class="tc-date">{{ note.sessionDate | date:'MMM d, y' }}</span>
                    <span class="tc-format">{{ note.format | titlecase }}</span>
                    <span class="tc-status" [class]="note.status">{{ note.status }}</span>
                  </div>
                  <div class="tc-body">
                    {{ note.aiSummary || note.inSession?.observations?.slice(0, 120) || 'No observations yet' }}
                  </div>
                  @if (note.aiThemes.length) {
                    <div class="tc-themes">
                      @for (t of note.aiThemes; track t) {
                        <span class="theme-chip">{{ t }}</span>
                      }
                    </div>
                  }
                </a>
              </div>
            }
          </div>
        }

        <!-- AI Insights -->
        @if (insightsLoading()) {
          <div class="ai-loading"><mat-spinner diameter="24" /> <span>{{ 'JOURNAL.generatingInsights' | translate }}</span></div>
        }
        @if (insights()) {
          <div class="ai-panel">
            <div class="ai-header"><mat-icon>auto_awesome</mat-icon> {{ 'JOURNAL.engagementInsights' | translate }}</div>
            <div class="ai-section">
              <h4>{{ 'JOURNAL.recurringThemes' | translate }}</h4>
              <div class="theme-list">
                @for (t of insights()!.recurringThemes; track t) {
                  <span class="theme-chip">{{ t }}</span>
                }
              </div>
            </div>
            <div class="ai-section">
              <h4>{{ 'JOURNAL.growthArc' | translate }}</h4>
              <p>{{ insights()!.growthArc }}</p>
            </div>
            <div class="ai-section">
              <h4>{{ 'JOURNAL.coachObservations' | translate }}</h4>
              <p>{{ insights()!.coachObservations }}</p>
            </div>
            @if (insights()!.openThreads.length) {
              <div class="ai-section">
                <h4>{{ 'JOURNAL.openThreads' | translate }}</h4>
                <ul>@for (t of insights()!.openThreads; track t) { <li>{{ t }}</li> }</ul>
              </div>
            }
            <div class="ai-section">
              <h4>{{ 'JOURNAL.suggestedNextFocus' | translate }}</h4>
              <p>{{ insights()!.suggestedNextFocus }}</p>
            </div>
          </div>
        }

        <!-- Accountability tracker -->
        @if (openItems().length > 0) {
          <mat-divider style="margin: 24px 0" />
          <h2 class="section-title"><mat-icon>checklist</mat-icon> {{ 'JOURNAL.openAccountabilityItems' | translate }}</h2>
          @for (group of accountabilityGroups(); track group.noteId) {
            <div class="acc-group">
              <div class="acc-session">Session #{{ group.sessionNumber }}</div>
              @for (item of group.items; track item._id) {
                <div class="acc-item">
                  <mat-checkbox [checked]="item.completed" (change)="toggleAccountability(group.noteId, item._id!)">
                    {{ item.item }}
                  </mat-checkbox>
                  @if (item.dueDate) {
                    <span class="acc-due">Due {{ item.dueDate | date:'MMM d' }}</span>
                  }
                </div>
              }
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .journal-page { padding: 32px; max-width: 960px; background: #F8F6F1; min-height: 100%; }
    .back-link { display: flex; align-items: center; gap: 4px; color: var(--artes-accent); text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 16px; }
    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .eng-header {
      display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px;
      background: white; border-radius: 16px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .eng-title {
      display: flex; align-items: center; gap: 12px;
      mat-icon { font-size: 28px; width: 28px; height: 28px; color: #7c5cbf; }
      h1 { font-size: 20px; color: var(--artes-primary); margin: 0; }
      .coachee-name { font-size: 14px; color: #5a6a7e; margin-right: 8px; }
    }
    .eng-status {
      font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 10px; border-radius: 999px;
      &.active { background: #e8faf4; color: #1a9678; }
      &.completed { background: #e8faf4; color: #1a9678; }
      &.prospect { background: #f0f4f8; color: #9aa5b4; }
      &.contracted { background: var(--artes-bg); color: var(--artes-accent); }
      &.paused { background: #fefce8; color: #b07800; }
    }
    .header-actions { display: flex; gap: 8px; }

    .empty-state {
      text-align: center; padding: 48px; color: #9aa5b4;
      background: white; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      > mat-icon { font-size: 36px; width: 36px; height: 36px; display: block; margin: 0 auto 12px; }
      h3 { color: var(--artes-primary); margin-bottom: 8px; }
      p { margin: 0; }
    }

    /* Timeline */
    .timeline { position: relative; padding-left: 40px; }
    .timeline::before {
      content: ''; position: absolute; left: 17px; top: 0; bottom: 0; width: 2px;
      background: #e0e4ea;
    }
    .timeline-item { position: relative; margin-bottom: 16px; }
    .timeline-node {
      position: absolute; left: -40px; top: 12px;
      width: 34px; height: 34px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: white; z-index: 1;
      &.complete { background: #27C4A0; }
      &.draft { background: #9aa5b4; }
    }
    .timeline-card {
      display: block; background: white; border-radius: 12px; padding: 16px;
      box-shadow: 0 1px 6px rgba(0,0,0,0.06); text-decoration: none; color: inherit;
      transition: box-shadow 0.15s;
      &:hover { box-shadow: 0 3px 12px rgba(0,0,0,0.1); }
    }
    .tc-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .tc-date { font-size: 13px; font-weight: 600; color: var(--artes-primary); }
    .tc-format { font-size: 12px; color: #5a6a7e; }
    .tc-status {
      font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 1px 8px; border-radius: 999px;
      &.complete { background: #e8faf4; color: #1a9678; }
      &.draft { background: #f0f4f8; color: #9aa5b4; }
    }
    .tc-body { font-size: 13px; color: #5a6a7e; line-height: 1.5; }
    .tc-themes { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .theme-chip {
      font-size: 11px; padding: 2px 8px; border-radius: 999px;
      background: #f3eeff; color: #7c5cbf; font-weight: 500;
    }

    /* AI Panel */
    .ai-loading { display: flex; align-items: center; gap: 10px; padding: 16px; color: #5a6a7e; font-size: 14px; }
    .ai-panel {
      background: #f0faf6; border-left: 4px solid #27C4A0; border-radius: 12px;
      padding: 20px; margin-top: 24px;
    }
    .ai-header {
      display: flex; align-items: center; gap: 6px; font-size: 16px; font-weight: 700; color: var(--artes-primary); margin-bottom: 16px;
      mat-icon { color: #27C4A0; }
    }
    .ai-section {
      margin-bottom: 14px;
      h4 { font-size: 13px; font-weight: 700; color: var(--artes-primary); margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.3px; }
      p { font-size: 14px; color: #374151; line-height: 1.6; margin: 0; }
      ul { margin: 4px 0 0; padding-left: 18px; font-size: 14px; color: #374151; }
      .theme-list { display: flex; flex-wrap: wrap; gap: 4px; }
    }

    /* Accountability */
    .section-title {
      font-size: 16px; color: var(--artes-primary); display: flex; align-items: center; gap: 6px; margin: 0 0 12px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--artes-accent); }
    }
    .acc-group { margin-bottom: 12px; }
    .acc-session { font-size: 12px; font-weight: 600; color: #9aa5b4; text-transform: uppercase; margin-bottom: 4px; }
    .acc-item { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
    .acc-due { font-size: 11px; color: #9aa5b4; }

    @media (max-width: 768px) {
      .eng-header { flex-direction: column; gap: 12px; }
    }
  `],
})
export class EngagementNotesComponent implements OnInit {
  engagementId = '';
  loading = signal(true);
  engagement = signal<EngagementInfo | null>(null);
  notes = signal<SessionNote[]>([]);
  insights = signal<EngagementInsight | null>(null);
  insightsLoading = signal(false);

  openItems = computed(() =>
    this.notes().flatMap((n) =>
      (n.postSession?.accountabilityItems || []).filter((a) => !a.completed)
    )
  );

  accountabilityGroups = computed(() =>
    this.notes()
      .filter((n) => n.postSession?.accountabilityItems?.some((a) => !a.completed))
      .map((n) => ({
        noteId: n._id,
        sessionNumber: n.sessionNumber,
        items: (n.postSession?.accountabilityItems ?? []).filter((a) => !a.completed),
      }))
  );

  constructor(
    private route: ActivatedRoute,
    private journal: JournalService,
    private api: ApiService,
  ) {}

  ngOnInit(): void {
    this.engagementId = this.route.snapshot.params['engagementId'];
    this.loadData();
  }

  private loadData(): void {
    this.api.get<EngagementInfo>(`/coaching/engagements/${this.engagementId}`).subscribe({
      next: (eng) => this.engagement.set(eng),
    });

    this.journal.getEngagementNotes(this.engagementId).subscribe({
      next: (notes) => { this.notes.set(notes); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  generateInsights(): void {
    this.insightsLoading.set(true);
    this.journal.getEngagementInsights(this.engagementId).subscribe({
      next: (data) => { this.insights.set(data); this.insightsLoading.set(false); },
      error: () => this.insightsLoading.set(false),
    });
  }

  toggleAccountability(noteId: string, itemId: string): void {
    const note = this.notes().find((n) => n._id === noteId);
    if (!note) return;
    const items = (note.postSession?.accountabilityItems ?? []).map((a) =>
      a._id === itemId ? { ...a, completed: !a.completed } : a
    );
    this.journal.updateNote(noteId, { postSession: { ...(note.postSession ?? {}), accountabilityItems: items } } as any).subscribe({
      next: (updated) => {
        this.notes.update((prev) => prev.map((n) => n._id === noteId ? updated : n));
      },
    });
  }
}
