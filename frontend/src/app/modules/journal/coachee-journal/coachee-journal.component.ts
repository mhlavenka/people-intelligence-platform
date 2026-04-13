import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { JournalService, SessionNote } from '../journal.service';
import { ApiService } from '../../../core/api.service';

interface CoachingSession {
  _id: string;
  date: string;
  duration: number;
  format: string;
  status: string;
  googleMeetLink?: string;
  inSession?: { observations?: string; openingState?: string; keyThemes?: string[] };
}

/**
 * Coachee-facing journal:
 *   - Lists every session note for the engagement
 *   - Per-note tabs: Pre (editable), During (read-only coach observations),
 *     Post (editable)
 *   - Coachee writes coacheePre / coacheePost; everything else is read-only
 */
@Component({
  selector: 'app-coachee-journal',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterLink,
    MatTabsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page">
      <div class="header">
        <a mat-icon-button [routerLink]="['/coaching', engagementId]"><mat-icon>arrow_back</mat-icon></a>
        <h1>My session journal</h1>
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="36" /></div>
      } @else if (sessions().length === 0) {
        <div class="empty">
          <mat-icon>menu_book</mat-icon>
          <p>No sessions yet. Once your coach schedules a session you can capture pre- and post-session notes here.</p>
        </div>
      } @else {
        <div class="note-list">
          @for (s of sessions(); track s._id; let idx = $index) {
            <section class="note-card">
              <header class="note-head">
                <strong>Session #{{ sessions().length - idx }}</strong>
                <span class="muted">{{ s.date | date:'mediumDate' }} · {{ s.date | date:'shortTime' }}</span>
                <span class="muted-status" [class]="'st-' + s.status">{{ s.status }}</span>
              </header>

              <mat-tab-group animationDuration="0ms">
                <mat-tab label="Pre">
                  <div class="tab-body">
                    <p class="hint">Filled by you. Your coach can read this.</p>

                    <p class="section-label"><span class="pip-accent"></span>Current state</p>

                    <div class="field">
                      <label>How would you describe your energy and mood right now?</label>
                      <div class="stars" role="radiogroup" aria-label="Mood rating">
                        @for (i of [1,2,3,4,5]; track i) {
                          <button type="button" class="star-btn"
                                  [class.filled]="(forms[s._id].pre.moodRating || 0) >= i"
                                  (click)="forms[s._id].pre.moodRating = i"
                                  [attr.aria-label]="i + ' stars'">
                            <mat-icon>{{ (forms[s._id].pre.moodRating || 0) >= i ? 'star' : 'star_border' }}</mat-icon>
                          </button>
                        }
                        @if (forms[s._id].pre.moodRating) {
                          <button type="button" class="clear-btn"
                                  (click)="forms[s._id].pre.moodRating = undefined">Clear</button>
                        }
                      </div>
                      <div class="scale-labels"><span>1 — very low</span><span>5 — very high</span></div>
                    </div>

                    <mat-form-field appearance="outline" class="full">
                      <mat-label>What feels most present or top of mind for you today?</mat-label>
                      <textarea matInput rows="3" [(ngModel)]="forms[s._id].pre.topOfMind"
                                placeholder="Share what's occupying your thoughts or attention right now…"></textarea>
                    </mat-form-field>

                    <p class="section-label"><span class="pip-accent"></span>Session intent</p>

                    <mat-form-field appearance="outline" class="full">
                      <mat-label>What is the main topic or challenge you want to explore in this session?</mat-label>
                      <textarea matInput rows="3" [(ngModel)]="forms[s._id].pre.mainTopic"
                                placeholder="Be as specific as possible — the clearer the focus, the more useful the session…"></textarea>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full">
                      <mat-label>What would make this session feel truly valuable to you?</mat-label>
                      <textarea matInput rows="3" [(ngModel)]="forms[s._id].pre.valueDefinition"
                                placeholder="What outcome, insight, or clarity would feel like success?"></textarea>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full">
                      <mat-label>What has shifted or happened since your last session? (if applicable)</mat-label>
                      <textarea matInput rows="3" [(ngModel)]="forms[s._id].pre.recentShifts"
                                placeholder="Progress, setbacks, new developments…"></textarea>
                    </mat-form-field>

                    <p class="section-label"><span class="pip-accent"></span>Anything else</p>

                    <mat-form-field appearance="outline" class="full">
                      <mat-label>Is there anything you'd like your coach to know before you begin?</mat-label>
                      <textarea matInput rows="3" [(ngModel)]="forms[s._id].pre.contextForCoach"
                                placeholder="Context, boundaries, or anything on your mind…"></textarea>
                    </mat-form-field>

                    <button mat-flat-button color="primary"
                            (click)="save(s, 'pre')" [disabled]="forms[s._id].saving">
                      @if (forms[s._id].saving) { <mat-spinner diameter="16" /> }
                      Save pre-session
                    </button>
                  </div>
                </mat-tab>

                <mat-tab label="During">
                  <div class="tab-body">
                    <p class="hint">Read-only. Notes your coach made during the session.</p>
                    @if (noteForSession(s._id); as note) {
                      @if (note.inSession?.observations) {
                        <div class="ro-field"><label>Observations</label><p>{{ note.inSession!.observations }}</p></div>
                      }
                      @if (note.inSession?.openingState) {
                        <div class="ro-field"><label>Opening state</label><p>{{ note.inSession!.openingState }}</p></div>
                      }
                      @if (note.inSession?.keyThemes?.length) {
                        <div class="ro-field"><label>Key themes</label>
                          <div class="chips">
                            @for (t of note.inSession!.keyThemes; track t) { <span class="chip">{{ t }}</span> }
                          </div>
                        </div>
                      }
                      @if (!note.inSession?.observations && !note.inSession?.openingState && !note.inSession?.keyThemes?.length) {
                        <p class="muted">No notes added by your coach yet.</p>
                      }
                    } @else {
                      <p class="muted">No notes added by your coach yet.</p>
                    }
                  </div>
                </mat-tab>

                <mat-tab label="Post">
                  <div class="tab-body">
                    <p class="hint">Filled by you after the session. Your coach can read this.</p>
                    <mat-form-field appearance="outline" class="full">
                      <mat-label>Takeaways — what I learned</mat-label>
                      <textarea matInput rows="3" [(ngModel)]="forms[s._id].post.takeaways"></textarea>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="full">
                      <mat-label>Reflection — how the session felt</mat-label>
                      <textarea matInput rows="3" [(ngModel)]="forms[s._id].post.reflection"></textarea>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="full">
                      <mat-label>Commitments — what I'll do before next session</mat-label>
                      <textarea matInput rows="3" [(ngModel)]="forms[s._id].post.commitments"></textarea>
                    </mat-form-field>
                    <button mat-flat-button color="primary"
                            (click)="save(s, 'post')" [disabled]="forms[s._id].saving">
                      @if (forms[s._id].saving) { <mat-spinner diameter="16" /> }
                      Save post-session
                    </button>
                  </div>
                </mat-tab>
              </mat-tab-group>
            </section>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 24px; max-width: 900px; margin: 0 auto; }
    .header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
      h1 { margin: 0; color: #1B2A47; font-size: 22px; }
    }
    .loading { display: flex; justify-content: center; padding: 60px 0; }
    .empty {
      text-align: center; padding: 60px 24px; color: #6b7c93;
      mat-icon { font-size: 40px; width: 40px; height: 40px; color: #c8d3df; }
    }
    .note-list { display: flex; flex-direction: column; gap: 16px; }
    .note-card { background: #fff; border: 1px solid #eef2f7; border-radius: 12px; overflow: hidden; }
    .note-head {
      padding: 14px 18px; background: #f7f9fc; border-bottom: 1px solid #eef2f7;
      display: flex; align-items: center; gap: 12px;
      strong { color: #1B2A47; font-size: 15px; }
      .muted { color: #6b7c93; font-size: 13px; }
      .muted-status {
        margin-left: auto; text-transform: uppercase; letter-spacing: 0.5px;
        font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px;
        background: #f0f4f8; color: #6b7c93;
        &.st-scheduled { background: #EBF5FB; color: #3A9FD6; }
        &.st-completed { background: #e8f9f2; color: #0f8a5f; }
        &.st-cancelled { background: #fef2f2; color: #dc2626; }
      }
    }
    .tab-body { padding: 16px 18px; }
    .hint { color: #6b7c93; font-size: 12px; margin: 0 0 10px; font-style: italic; }
    .full { width: 100%; }
    .muted { color: #9aa5b4; font-size: 13px; }
    .ro-field {
      margin-bottom: 10px;
      label { display: block; font-size: 11px; color: #9aa5b4; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
      p { margin: 0; color: #1B2A47; font-size: 14px; white-space: pre-line; }
    }
    .chips { display: flex; gap: 4px; flex-wrap: wrap; }
    .chip { background: #EBF5FB; color: #3A9FD6; font-size: 12px; padding: 2px 8px; border-radius: 999px; }
    mat-spinner { display: inline-block; margin-right: 6px; }

    .section-label {
      display: flex; align-items: center; gap: 8px;
      margin: 18px 0 8px;
      color: #1B2A47; font-size: 13px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.6px;
    }
    .pip-accent {
      display: inline-block; width: 4px; height: 16px;
      background: #3A9FD6; border-radius: 2px;
    }
    .field {
      margin-bottom: 12px;
      label {
        display: block; margin-bottom: 6px;
        font-size: 13px; color: #1B2A47; font-weight: 500;
      }
    }
    .stars { display: flex; align-items: center; gap: 4px; }
    .star-btn {
      background: none; border: none; cursor: pointer; padding: 4px;
      color: #c8d3df; transition: color 0.1s;
      &:hover, &.filled { color: #f5b042; }
      mat-icon { font-size: 28px; width: 28px; height: 28px; }
    }
    .clear-btn {
      background: none; border: none; cursor: pointer;
      color: #6b7c93; font-size: 12px; padding: 4px 8px; margin-left: 6px;
      &:hover { color: #1B2A47; }
    }
    .scale-labels {
      display: flex; justify-content: space-between;
      font-size: 11px; color: #9aa5b4; margin-top: 4px; max-width: 200px;
    }
  `],
})
export class CoacheeJournalComponent implements OnInit {
  loading = signal(true);
  sessions = signal<CoachingSession[]>([]);
  private notesBySession = new Map<string, SessionNote>();
  engagementId = '';

  forms: Record<string, {
    pre: {
      moodRating?: number;
      topOfMind: string;
      mainTopic: string;
      valueDefinition: string;
      recentShifts: string;
      contextForCoach: string;
    };
    post: { takeaways: string; reflection: string; commitments: string };
    saving: boolean;
  }> = {};

  constructor(
    private route: ActivatedRoute,
    private journal: JournalService,
    private api: ApiService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.engagementId = this.route.snapshot.params['engagementId'];
    this.load();
  }

  noteForSession(sessionId: string): SessionNote | undefined {
    return this.notesBySession.get(sessionId);
  }

  private load(): void {
    Promise.all([
      this.api.get<CoachingSession[]>(`/coaching/sessions?engagementId=${this.engagementId}`).toPromise(),
      this.journal.getEngagementNotes(this.engagementId).toPromise().catch(() => [] as SessionNote[]),
    ]).then(([sessions, notes]) => {
      const sorted = (sessions || []).slice().sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      this.sessions.set(sorted);
      this.notesBySession.clear();
      for (const n of notes || []) {
        if (n.sessionId) this.notesBySession.set(n.sessionId, n);
      }
      for (const s of sorted) {
        const n = this.notesBySession.get(s._id);
        this.forms[s._id] = {
          pre: {
            moodRating: n?.coacheePre?.moodRating,
            topOfMind: n?.coacheePre?.topOfMind || '',
            mainTopic: n?.coacheePre?.mainTopic || '',
            valueDefinition: n?.coacheePre?.valueDefinition || '',
            recentShifts: n?.coacheePre?.recentShifts || '',
            contextForCoach: n?.coacheePre?.contextForCoach || '',
          },
          post: {
            takeaways: n?.coacheePost?.takeaways || '',
            reflection: n?.coacheePost?.reflection || '',
            commitments: n?.coacheePost?.commitments || '',
          },
          saving: false,
        };
      }
      this.loading.set(false);
    }).catch(() => this.loading.set(false));
  }

  save(s: CoachingSession, which: 'pre' | 'post'): void {
    const f = this.forms[s._id];
    f.saving = true;
    const payload = which === 'pre'
      ? { coacheePre: f.pre }
      : { coacheePost: f.post };

    const existing = this.notesBySession.get(s._id);
    const op = existing
      ? this.journal.updateNote(existing._id, payload)
      // No note yet — find-or-create one bound to this session. The
      // backend POST is idempotent on sessionId so racing creates won't
      // produce duplicates.
      : this.journal.createNote(this.engagementId, {
          sessionId: s._id,
          sessionDate: s.date,
          durationMinutes: s.duration || 60,
          format: (s.format as 'video' | 'phone' | 'in_person') || 'video',
          ...payload,
        });

    op.subscribe({
      next: (note) => {
        f.saving = false;
        this.notesBySession.set(s._id, note);
        this.snack.open('Saved', 'OK', { duration: 2000 });
      },
      error: () => {
        f.saving = false;
        this.snack.open('Failed to save', 'OK', { duration: 3000 });
      },
    });
  }
}
