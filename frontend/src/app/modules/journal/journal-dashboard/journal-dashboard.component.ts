import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { JournalService, SessionNote, ReflectiveEntry } from '../journal.service';

import { TranslateModule } from '@ngx-translate/core';
interface FeedItem {
  type: 'note' | 'reflective';
  id: string;
  title: string;
  subtitle: string;
  date: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-journal-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    TranslateModule,
  ],
  template: `
    <div class="journal-page">
      <div class="page-header">
        <h1><mat-icon>auto_stories</mat-icon> {{ 'JOURNAL.myJournal' | translate }}</h1>
        <div class="header-actions">
          <a mat-stroked-button routerLink="/journal/reflective"><mat-icon>edit_note</mat-icon> {{ 'JOURNAL.reflectiveJournal' | translate }}</a>
          <a mat-stroked-button routerLink="/journal/supervision"><mat-icon>supervisor_account</mat-icon> {{ 'JOURNAL.supervisionDigest' | translate }}</a>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {
        <!-- Summary cards -->
        <div class="summary-row">
          <div class="summary-card">
            <mat-icon>psychology_alt</mat-icon>
            <div class="sum-num">{{ stats().engagementsWithNotes }}</div>
            <div class="sum-label">{{ 'JOURNAL.engagementsWithNotes' | translate }}</div>
          </div>
          <div class="summary-card">
            <mat-icon>description</mat-icon>
            <div class="sum-num">{{ stats().totalNotes }}</div>
            <div class="sum-label">{{ 'JOURNAL.sessionNotes' | translate }}</div>
          </div>
          <div class="summary-card">
            <mat-icon>checklist</mat-icon>
            <div class="sum-num">{{ stats().openAccountability }}</div>
            <div class="sum-label">{{ 'JOURNAL.openAccountability' | translate }}</div>
          </div>
          <div class="summary-card">
            <mat-icon>auto_awesome</mat-icon>
            <div class="sum-num">{{ stats().awaitingAi }}</div>
            <div class="sum-label">{{ 'JOURNAL.awaitingAi' | translate }}</div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="section-header">
          <h2>{{ 'JOURNAL.recentActivity' | translate }}</h2>
        </div>

        @if (feed().length === 0) {
          <div class="empty-state">
            <mat-icon>auto_stories</mat-icon>
            <h3>{{ 'JOURNAL.emptyJournal' | translate }}</h3>
            <p>{{ 'JOURNAL.emptyJournalDesc' | translate }}</p>
            <a mat-flat-button routerLink="/journal/reflective/new" color="primary">
              <mat-icon>add</mat-icon> {{ 'JOURNAL.newReflectiveEntry' | translate }}
            </a>
          </div>
        }

        <div class="feed">
          @for (item of feed(); track item.id) {
            <a class="feed-item" [routerLink]="item.route">
              <div class="feed-icon" [class]="item.type">
                <mat-icon>{{ item.icon }}</mat-icon>
              </div>
              <div class="feed-content">
                <div class="feed-title">{{ item.title }}</div>
                <div class="feed-subtitle">{{ item.subtitle }}</div>
              </div>
              <div class="feed-date">{{ item.date | date:'MMM d, y' }}</div>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .journal-page { padding: 32px; max-width: 960px; background: #F8F6F1; min-height: 100%; }
    .page-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;
      h1 { font-size: 24px; color: var(--artes-primary); display: flex; align-items: center; gap: 8px; margin: 0;
        mat-icon { color: #7c5cbf; }
      }
    }
    .header-actions { display: flex; gap: 8px; }
    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .summary-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
    .summary-card {
      background: white; border-radius: 12px; padding: 20px; text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      mat-icon { font-size: 24px; width: 24px; height: 24px; color: #7c5cbf; margin-bottom: 4px; }
      .sum-num { font-size: 28px; font-weight: 700; color: var(--artes-primary); }
      .sum-label { font-size: 12px; color: #9aa5b4; margin-top: 2px; }
    }

    .section-header { margin-bottom: 12px; h2 { font-size: 16px; color: var(--artes-primary); margin: 0; } }

    .empty-state {
      text-align: center; padding: 48px; color: #9aa5b4;
      background: white; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      mat-icon { font-size: 34px; width: 34px; height: 34px; display: block; margin: 0 auto 0px; }
      h3 { color: var(--artes-primary); margin-bottom: 8px; }
      p { margin: 0 0 16px; }
    }

    .feed { display: flex; flex-direction: column; gap: 8px; }
    .feed-item {
      display: flex; align-items: center; gap: 12px;
      background: white; border-radius: 10px; padding: 14px 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05); text-decoration: none; color: inherit;
      transition: box-shadow 0.15s;
      &:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    }
    .feed-icon {
      width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: white; }
      &.note { background: var(--artes-accent); }
      &.reflective { background: #7c5cbf; }
    }
    .feed-content { flex: 1; min-width: 0; }
    .feed-title { font-size: 14px; font-weight: 600; color: var(--artes-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .feed-subtitle { font-size: 12px; color: #9aa5b4; }
    .feed-date { font-size: 12px; color: #9aa5b4; flex-shrink: 0; }

    @media (max-width: 768px) {
      .summary-row { grid-template-columns: repeat(2, 1fr); }
      .header-actions { flex-wrap: wrap; }
    }
  `],
})
export class JournalDashboardComponent implements OnInit {
  loading = signal(true);
  private notes = signal<SessionNote[]>([]);
  private entries = signal<ReflectiveEntry[]>([]);

  stats = computed(() => {
    const notes = this.notes();
    const engagementIds = new Set(notes.map((n) => n.engagementId));
    const openItems = notes.reduce((sum, n) =>
      sum + (n.postSession?.accountabilityItems?.filter((a) => !a.completed).length || 0), 0);
    const awaitingAi = notes.filter((n) => n.status === 'complete' && !n.aiSummary).length;
    return {
      engagementsWithNotes: engagementIds.size,
      totalNotes: notes.length,
      openAccountability: openItems,
      awaitingAi,
    };
  });

  feed = computed<FeedItem[]>(() => {
    const noteItems: FeedItem[] = this.notes().slice(0, 5).map((n) => ({
      type: 'note' as const,
      id: n._id,
      title: `Session #${n.sessionNumber}`,
      subtitle: `${n.format} · ${n.durationMinutes}min · ${n.status}`,
      date: n.sessionDate,
      icon: 'description',
      route: `/journal/note/${n._id}`,
    }));
    const entryItems: FeedItem[] = this.entries().slice(0, 5).map((e) => ({
      type: 'reflective' as const,
      id: e._id,
      title: e.title,
      subtitle: `${e.mood}${e.isSupervisionReady ? ' · supervision ready' : ''}`,
      date: e.entryDate,
      icon: 'edit_note',
      route: `/journal/reflective/${e._id}`,
    }));
    return [...noteItems, ...entryItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  });

  constructor(private journal: JournalService) {}

  ngOnInit(): void {
    // Load all notes and reflective entries for the dashboard
    forkJoin({
      entries: this.journal.getReflectiveEntries(),
    }).subscribe({
      next: ({ entries }) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    // Notes require engagementId — we'll load a summary via reflective entries
    // and show the empty state until the coach navigates to a specific engagement.
    // For the dashboard, we use a lightweight approach: fetch recent notes across all engagements
    // by using a dedicated endpoint (or we skip and show reflective entries only).
    // Since the API scopes notes by engagement, we rely on the reflective feed here.
    this.loading.set(false);
  }
}
