import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { JournalService, SessionNote } from '../journal.service';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
@Component({
  selector: 'app-session-note-view',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatDividerModule, MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div class="journal-page">
      <div class="page-header">
        @if (note()) {
          <a [routerLink]="'/journal/engagement/' + note()!.engagementId" class="back-link">
            <mat-icon>arrow_back</mat-icon> Back to Timeline
          </a>
        }
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else if (note()) {
        <div class="view-layout">
          <!-- Left: session details -->
          <div class="session-col">
            <div class="session-header">
              <div>
                <h1>Session #{{ note()!.sessionNumber }}</h1>
                <div class="session-meta">
                  <span>{{ note()!.sessionDate | date:'MMMM d, y' }}</span>
                  <span>{{ note()!.durationMinutes }} min</span>
                  <span>{{ note()!.format | titlecase }}</span>
                  <span class="status-badge" [class]="note()!.status">{{ note()!.status }}</span>
                </div>
              </div>
              <a mat-stroked-button [routerLink]="'/journal/note/' + note()!._id + '/edit'">
                <mat-icon>edit</mat-icon> Edit
              </a>
            </div>

            <!-- Pre-session -->
            @if (note()!.preSession?.agenda || note()!.preSession?.hypotheses || note()!.preSession?.coachIntention) {
              <div class="section">
                <h3><mat-icon>flag</mat-icon> Before Session</h3>
                @if (note()!.preSession?.agenda) {
                  <div class="field-block"><label>Agenda</label><p>{{ note()!.preSession!.agenda }}</p></div>
                }
                @if (note()!.preSession?.hypotheses) {
                  <div class="field-block"><label>Hypotheses</label><p>{{ note()!.preSession!.hypotheses }}</p></div>
                }
                @if (note()!.preSession?.coachIntention) {
                  <div class="field-block"><label>Coach Intention</label><p>{{ note()!.preSession!.coachIntention }}</p></div>
                }
              </div>
            }

            <!-- In-session -->
            <div class="section">
              <h3><mat-icon>record_voice_over</mat-icon> During Session</h3>
              @if (note()!.inSession?.openingState) {
                <div class="field-block"><label>Opening State</label><p>{{ note()!.inSession!.openingState }}</p></div>
              }
              @if (note()!.inSession?.keyThemes?.length) {
                <div class="field-block"><label>Key Themes</label>
                  <div class="theme-list">
                    @for (t of note()!.inSession!.keyThemes!; track t) { <span class="theme-chip">{{ t }}</span> }
                  </div>
                </div>
              }
              @if (note()!.inSession?.observations) {
                <div class="field-block"><label>Observations</label><p class="narrative">{{ note()!.inSession!.observations }}</p></div>
              }
              @if (note()!.inSession?.notableQuotes?.length) {
                <div class="field-block"><label>Notable Quotes</label>
                  @for (q of note()!.inSession!.notableQuotes!; track q) {
                    <blockquote>"{{ q }}"</blockquote>
                  }
                </div>
              }
              @if (note()!.inSession?.coachInterventions) {
                <div class="field-block"><label>Coach Interventions</label><p>{{ note()!.inSession!.coachInterventions }}</p></div>
              }
              @if (note()!.inSession?.energyShifts) {
                <div class="field-block"><label>Energy Shifts</label><p>{{ note()!.inSession!.energyShifts }}</p></div>
              }
            </div>

            <!-- Post-session -->
            <div class="section">
              <h3><mat-icon>psychology</mat-icon> After Session</h3>
              @if (note()!.postSession?.coachReflection) {
                <div class="field-block"><label>Coach Reflection</label><p class="narrative">{{ note()!.postSession!.coachReflection }}</p></div>
              }
              @if (note()!.postSession?.whatWorked) {
                <div class="field-block"><label>What Worked</label><p>{{ note()!.postSession!.whatWorked }}</p></div>
              }
              @if (note()!.postSession?.whatToExplore) {
                <div class="field-block"><label>What to Explore Next</label><p>{{ note()!.postSession!.whatToExplore }}</p></div>
              }
              @if (note()!.postSession?.clientGrowthEdge) {
                <div class="field-block"><label>Client's Growth Edge</label><p>{{ note()!.postSession!.clientGrowthEdge }}</p></div>
              }
              @if (note()!.postSession?.accountabilityItems?.length) {
                <div class="field-block"><label>Accountability Items</label>
                  @for (a of note()!.postSession!.accountabilityItems!; track a._id) {
                    <div class="acc-view-item" [class.done]="a.completed">
                      <mat-icon>{{ a.completed ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                      <span>{{ a.item }}</span>
                      @if (a.dueDate) { <span class="acc-due">Due {{ a.dueDate | date:'MMM d' }}</span> }
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Right: AI panel -->
          @if (note()!.aiSummary) {
            <div class="ai-col">
              <div class="ai-panel">
                <div class="ai-header"><mat-icon>auto_awesome</mat-icon> AI Summary</div>
                <p class="ai-body">{{ note()!.aiSummary }}</p>
                @if (note()!.aiThemes.length) {
                  <div class="ai-themes">
                    @for (t of note()!.aiThemes; track t) {
                      <span class="theme-chip">{{ t }}</span>
                    }
                  </div>
                }
                @if (note()!.aiGeneratedAt) {
                  <div class="ai-meta">Generated {{ note()!.aiGeneratedAt | date:'MMM d, y h:mm a' }}</div>
                }
                <button mat-stroked-button class="regen-btn" (click)="regenerate()" [disabled]="aiLoading()">
                  <mat-icon>refresh</mat-icon> Regenerate
                </button>
                @if (aiLoading()) { <mat-spinner diameter="20" /> }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .journal-page { padding: 32px; max-width: 1100px; background: #F8F6F1; min-height: 100%; }
    .back-link { display: flex; align-items: center; gap: 4px; color: var(--artes-accent); text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 16px; }
    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .view-layout { display: grid; grid-template-columns: 1fr 320px; gap: 24px; }

    .session-col {
      background: white; border-radius: 16px; padding: 28px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .session-header {
      display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;
      h1 { font-size: 22px; color: var(--artes-primary); margin: 0 0 4px; }
    }
    .session-meta {
      display: flex; gap: 12px; font-size: 13px; color: #5a6a7e; flex-wrap: wrap;
    }
    .status-badge {
      font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 10px; border-radius: 999px;
      &.complete { background: #e8faf4; color: #1a9678; }
      &.draft { background: #f0f4f8; color: #9aa5b4; }
    }

    .section {
      margin-bottom: 20px;
      h3 { font-size: 15px; font-weight: 700; color: var(--artes-primary); display: flex; align-items: center; gap: 6px; margin: 0 0 12px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #7c5cbf; }
      }
    }
    .field-block {
      margin-bottom: 14px;
      label { font-size: 11px; font-weight: 700; color: #9aa5b4; text-transform: uppercase; letter-spacing: 0.3px; display: block; margin-bottom: 4px; }
      p { font-size: 14px; color: #374151; line-height: 1.6; margin: 0; white-space: pre-wrap; }
      p.narrative { font-size: 14px; line-height: 1.7; }
    }
    .theme-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .theme-chip {
      font-size: 11px; padding: 2px 8px; border-radius: 999px;
      background: #f3eeff; color: #7c5cbf; font-weight: 500;
    }
    blockquote {
      font-size: 14px; color: #374151; font-style: italic; margin: 4px 0 8px 0;
      padding-left: 12px; border-left: 3px solid #e0e4ea;
    }
    .acc-view-item {
      display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 14px; color: #374151;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #9aa5b4; }
      &.done { color: #9aa5b4; text-decoration: line-through;
        mat-icon { color: #27C4A0; }
      }
    }
    .acc-due { font-size: 11px; color: #9aa5b4; margin-left: auto; }

    /* AI panel */
    .ai-col { position: sticky; top: 32px; align-self: start; }
    .ai-panel {
      background: #f0faf6; border-left: 4px solid #27C4A0; border-radius: 12px; padding: 20px;
    }
    .ai-header {
      display: flex; align-items: center; gap: 6px; font-size: 16px; font-weight: 700; color: var(--artes-primary); margin-bottom: 10px;
      mat-icon { color: #27C4A0; }
    }
    .ai-body { font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 12px; }
    .ai-themes { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
    .ai-meta { font-size: 11px; color: #9aa5b4; margin-bottom: 10px; }
    .regen-btn { width: 100%; }

    @media print {
      .page-header, .regen-btn, a[mat-stroked-button] { display: none !important; }
      .journal-page { padding: 0; background: white; }
      .view-layout { display: block; }
      .ai-panel { break-inside: avoid; page-break-inside: avoid; border: 1px solid #27C4A0; }
    }

    @media (max-width: 768px) {
      .view-layout { grid-template-columns: 1fr; }
    }
  `],
})
export class SessionNoteViewComponent implements OnInit {
  loading = signal(true);
  note = signal<SessionNote | null>(null);
  aiLoading = signal(false);

  constructor(
    private route: ActivatedRoute,
    private journal: JournalService,
    private snack: MatSnackBar,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    const noteId = this.route.snapshot.params['noteId'];
    this.journal.getNote(noteId).subscribe({
      next: (n) => { this.note.set(n); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  regenerate(): void {
    const n = this.note();
    if (!n) return;
    this.aiLoading.set(true);
    this.journal.generateAiSummary(n._id).subscribe({
      next: (result) => {
        this.note.update((prev) => prev ? { ...prev, aiSummary: result.aiSummary, aiThemes: result.aiThemes, aiGeneratedAt: result.aiGeneratedAt } : prev);
        this.aiLoading.set(false);
        this.snack.open(this.translate.instant('JOURNAL.aiRegenerated'), '', { duration: 2000 });
      },
      error: () => { this.aiLoading.set(false); this.snack.open(this.translate.instant('JOURNAL.aiRegenerateFailed'), '', { duration: 3000 }); },
    });
  }
}
