import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { JournalService, ReflectiveEntry, JournalMood } from '../journal.service';

import { TranslateModule } from '@ngx-translate/core';
const MOOD_CONFIG: Record<JournalMood, { icon: string; color: string }> = {
  energized:  { icon: 'bolt',           color: '#f59e0b' },
  reflective: { icon: 'self_improvement', color: '#3A9FD6' },
  challenged: { icon: 'fitness_center', color: '#e53e3e' },
  inspired:   { icon: 'lightbulb',      color: '#27C4A0' },
  depleted:   { icon: 'battery_alert',  color: '#9aa5b4' },
};

@Component({
  selector: 'app-reflective-journal',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterLink,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatSelectModule,
    MatFormFieldModule, MatSlideToggleModule,
    TranslateModule,
  ],
  template: `
    <div class="journal-page">
      <div class="page-header">
        <div>
          <a routerLink="/journal" class="back-link"><mat-icon>arrow_back</mat-icon> Journal Dashboard</a>
          <h1><mat-icon>edit_note</mat-icon> Reflective Journal</h1>
        </div>
        <a mat-fab extended routerLink="/journal/reflective/new" color="primary" class="fab-btn">
          <mat-icon>add</mat-icon> New Entry
        </a>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>{{ 'JOURNAL.moodFilter' | translate }}</mat-label>
          <mat-select [(ngModel)]="moodFilter" (selectionChange)="applyFilters()">
            <mat-option value="">All</mat-option>
            @for (m of moods; track m) {
              <mat-option [value]="m">{{ m | titlecase }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-slide-toggle [(ngModel)]="supervisionFilter" (change)="applyFilters()">Supervision Ready</mat-slide-toggle>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <mat-icon>edit_note</mat-icon>
          <h3>{{ 'JOURNAL.noReflectiveEntries' | translate }}</h3>
          <p>Capture your coaching reflections, professional insights, and supervision preparation notes.</p>
        </div>
      } @else {
        <div class="entry-feed">
          @for (entry of filtered(); track entry._id) {
            <a class="entry-card" [routerLink]="'/journal/reflective/' + entry._id">
              <div class="entry-header">
                <div class="mood-icon" [style.color]="moodColor(entry.mood)">
                  <mat-icon>{{ moodIcon(entry.mood) }}</mat-icon>
                  <span>{{ entry.mood | titlecase }}</span>
                </div>
                <span class="entry-date">{{ entry.entryDate | date:'MMM d, y' }}</span>
              </div>
              <div class="entry-title">{{ entry.title }}</div>
              <div class="entry-preview">{{ entry.body | slice:0:150 }}{{ entry.body.length > 150 ? '...' : '' }}</div>
              <div class="entry-footer">
                @if (entry.tags.length) {
                  <div class="tag-row">
                    @for (t of entry.tags; track t) { <span class="tag">{{ t }}</span> }
                  </div>
                }
                @if (entry.isSupervisionReady) {
                  <span class="supervision-badge"><mat-icon>supervisor_account</mat-icon> Supervision</span>
                }
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .journal-page { padding: 32px; max-width: 960px; background: #F8F6F1; min-height: 100%; }
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px;
      .back-link { display: flex; align-items: center; gap: 4px; color: var(--artes-accent); text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 4px; }
      h1 { font-size: 22px; color: var(--artes-primary); display: flex; align-items: center; gap: 8px; margin: 0;
        mat-icon { color: #7c5cbf; }
      }
    }
    .fab-btn { flex-shrink: 0; }

    .filter-bar {
      display: flex; align-items: center; gap: 16px; margin-bottom: 20px;
      .filter-field { width: 160px; }
    }

    .loading-center { display: flex; justify-content: center; padding: 64px; }
    .empty-state {
      text-align: center; padding: 48px; color: #9aa5b4;
      background: white; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      mat-icon { font-size: 48px; width: 48px; height: 48px; display: block; margin: 0 auto 12px; }
      h3 { color: var(--artes-primary); margin-bottom: 8px; }
      p { margin: 0; }
    }

    .entry-feed { display: flex; flex-direction: column; gap: 10px; }
    .entry-card {
      display: block; background: white; border-radius: 12px; padding: 18px;
      box-shadow: 0 1px 6px rgba(0,0,0,0.05); text-decoration: none; color: inherit;
      transition: box-shadow 0.15s;
      &:hover { box-shadow: 0 3px 12px rgba(0,0,0,0.1); }
    }
    .entry-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .mood-icon {
      display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .entry-date { font-size: 12px; color: #9aa5b4; }
    .entry-title { font-size: 16px; font-weight: 700; color: var(--artes-primary); margin-bottom: 4px; }
    .entry-preview { font-size: 13px; color: #5a6a7e; line-height: 1.5; }
    .entry-footer { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .tag-row { display: flex; gap: 4px; flex-wrap: wrap; }
    .tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #f0f4f8; color: #5a6a7e; }
    .supervision-badge {
      display: flex; align-items: center; gap: 2px; font-size: 11px; font-weight: 600;
      color: #7c5cbf; background: #f3eeff; padding: 2px 8px; border-radius: 999px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
  `],
})
export class ReflectiveJournalComponent implements OnInit {
  loading = signal(true);
  private entries = signal<ReflectiveEntry[]>([]);
  filtered = signal<ReflectiveEntry[]>([]);

  moods: JournalMood[] = ['energized', 'reflective', 'challenged', 'inspired', 'depleted'];
  moodFilter = '';
  supervisionFilter = false;

  constructor(private journal: JournalService) {}

  ngOnInit(): void {
    this.journal.getReflectiveEntries().subscribe({
      next: (data) => { this.entries.set(data); this.filtered.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  moodIcon(mood: JournalMood): string { return MOOD_CONFIG[mood]?.icon || 'mood'; }
  moodColor(mood: JournalMood): string { return MOOD_CONFIG[mood]?.color || '#9aa5b4'; }

  applyFilters(): void {
    let result = this.entries();
    if (this.moodFilter) result = result.filter((e) => e.mood === this.moodFilter);
    if (this.supervisionFilter) result = result.filter((e) => e.isSupervisionReady);
    this.filtered.set(result);
  }
}
