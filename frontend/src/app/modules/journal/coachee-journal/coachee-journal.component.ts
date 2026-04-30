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

import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
    TranslateModule,
  ],
  template: `
    <div class="page">
      <div class="header">
        <a mat-icon-button [routerLink]="['/coaching', engagementId]"><mat-icon>arrow_back</mat-icon></a>
        <h1>{{ (focusSessionId ? 'JOURNAL.coacheeThisSessionJournal' : 'JOURNAL.coacheeMySessionJournal') | translate }}</h1>
        @if (focusSessionId) {
          <a class="show-all-link" [routerLink]="['/my-journal/engagement', engagementId]">
            {{ 'JOURNAL.coacheeShowAllSessions' | translate }}
          </a>
        }
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="36" /></div>
      } @else if (sessions().length === 0) {
        <div class="empty">
          <mat-icon>menu_book</mat-icon>
          <p>{{ 'JOURNAL.coacheeEmptyState' | translate }}</p>
        </div>
      } @else {
        <div class="note-list">
          @for (s of sessions(); track s._id; let idx = $index) {
            <section class="note-card">
              <header class="note-head">
                <strong>{{ 'JOURNAL.coacheeSessionNumber' | translate }} #{{ sessions().length - idx }}</strong>
                <span class="muted">{{ s.date | date:'mediumDate' }} · {{ s.date | date:'shortTime' }}</span>
                <span class="muted-status" [class]="'st-' + s.status">{{ s.status }}</span>
              </header>

              <mat-tab-group animationDuration="0ms">
                <mat-tab [label]="'JOURNAL.coacheeTabPre' | translate">
                  <div class="tab-body">
                    <p class="hint">{{ 'JOURNAL.coacheePreHint' | translate }}</p>

                    <p class="section-label"><span class="pip-accent"></span>{{ 'JOURNAL.coacheeCurrentState' | translate }}</p>

                    <div class="field">
                      <label>{{ 'JOURNAL.coacheeMoodQuestion' | translate }}</label>
                      <div class="stars" role="radiogroup" [attr.aria-label]="'JOURNAL.coacheeMoodRatingAria' | translate">
                        @for (i of [1,2,3,4,5]; track i) {
                          <button type="button" class="star-btn"
                                  [class.filled]="(forms[s._id].pre.moodRating || 0) >= i"
                                  (click)="forms[s._id].pre.moodRating = i"
                                  [attr.aria-label]="i + ' ' + ('JOURNAL.coacheeStars' | translate)">
                            <mat-icon>{{ (forms[s._id].pre.moodRating || 0) >= i ? 'star' : 'star_border' }}</mat-icon>
                          </button>
                        }
                        @if (forms[s._id].pre.moodRating) {
                          <button type="button" class="clear-btn"
                                  (click)="forms[s._id].pre.moodRating = undefined">{{ 'JOURNAL.coacheeClear' | translate }}</button>
                        }
                      </div>
                      <div class="scale-labels"><span>{{ 'JOURNAL.coacheeMoodScaleLow' | translate }}</span><span>{{ 'JOURNAL.coacheeMoodScaleHigh' | translate }}</span></div>
                    </div>

                    <mat-form-field appearance="outline" class="full">
                      <mat-label>{{ 'JOURNAL.coacheeTopOfMindLabel' | translate }}</mat-label>
                      <textarea matInput rows="3" [(ngModel)]="forms[s._id].pre.topOfMind"
                                [placeholder]="'JOURNAL.coacheeTopOfMindPlaceholder' | translate"></textarea>
                    </mat-form-field>

                    <p class="section-label"><span class="pip-accent"></span>{{ 'JOURNAL.coacheeSessionIntent' | translate }}</p>

                    <mat-form-field appearance="outline" class="full">
                      <mat-label>{{ 'JOURNAL.coacheeMainTopicLabel' | translate }}</mat-label>
                      <textarea matInput rows="3" [(ngModel)]="forms[s._id].pre.mainTopic"
                                [placeholder]="'JOURNAL.coacheeMainTopicPlaceholder' | translate"></textarea>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full">
                      <mat-label>{{ 'JOURNAL.coacheeValueDefinitionLabel' | translate }}</mat-label>
                      <textarea matInput rows="3" [(ngModel)]="forms[s._id].pre.valueDefinition"
                                [placeholder]="'JOURNAL.coacheeValueDefinitionPlaceholder' | translate"></textarea>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full">
                      <mat-label>{{ 'JOURNAL.coacheeRecentShiftsLabel' | translate }}</mat-label>
                      <textarea matInput rows="3" [(ngModel)]="forms[s._id].pre.recentShifts"
                                [placeholder]="'JOURNAL.coacheeRecentShiftsPlaceholder' | translate"></textarea>
                    </mat-form-field>

                    <p class="section-label"><span class="pip-accent"></span>{{ 'JOURNAL.coacheeAnythingElse' | translate }}</p>

                    <mat-form-field appearance="outline" class="full">
                      <mat-label>{{ 'JOURNAL.coacheeContextForCoachLabel' | translate }}</mat-label>
                      <textarea matInput rows="3" [(ngModel)]="forms[s._id].pre.contextForCoach"
                                [placeholder]="'JOURNAL.coacheeContextForCoachPlaceholder' | translate"></textarea>
                    </mat-form-field>

                    <button mat-flat-button color="primary"
                            (click)="save(s, 'pre')" [disabled]="forms[s._id].saving">
                      @if (forms[s._id].saving) { <mat-spinner diameter="16" /> }
                      {{ 'JOURNAL.savePreSession' | translate }}
                    </button>
                  </div>
                </mat-tab>

                <mat-tab [label]="'JOURNAL.coacheeTabDuring' | translate">
                  <div class="tab-body">
                    <p class="hint">{{ 'JOURNAL.coacheeDuringHint' | translate }}</p>
                    @if (noteForSession(s._id); as note) {
                      @if (note.inSession?.observations) {
                        <div class="ro-field"><label>{{ 'JOURNAL.observations' | translate }}</label><p>{{ note.inSession!.observations }}</p></div>
                      }
                      @if (note.inSession?.openingState) {
                        <div class="ro-field"><label>{{ 'JOURNAL.openingState' | translate }}</label><p>{{ note.inSession!.openingState }}</p></div>
                      }
                      @if (note.inSession?.keyThemes?.length) {
                        <div class="ro-field"><label>{{ 'JOURNAL.keyThemes' | translate }}</label>
                          <div class="chips">
                            @for (t of note.inSession!.keyThemes; track t) { <span class="chip">{{ t }}</span> }
                          </div>
                        </div>
                      }
                      @if (!note.inSession?.observations && !note.inSession?.openingState && !note.inSession?.keyThemes?.length) {
                        <p class="muted">{{ 'JOURNAL.noNotesYetCoach' | translate }}</p>
                      }
                    } @else {
                      <p class="muted">{{ 'JOURNAL.noNotesYetCoach' | translate }}</p>
                    }
                  </div>
                </mat-tab>

                <mat-tab [label]="'JOURNAL.coacheeTabPost' | translate">
                  <div class="tab-body">
                    @if (s.status !== 'completed') {
                      <div class="locked-state">
                        <mat-icon>lock</mat-icon>
                        <p>{{ 'JOURNAL.availableAfterCompletion' | translate }}</p>
                      </div>
                    } @else {
                      <p class="hint">{{ 'JOURNAL.coacheePostHint' | translate }}</p>

                      <p class="section-label"><span class="pip-accent"></span>{{ 'JOURNAL.coacheeReflections' | translate }}</p>
                      <div class="field">
                        <label>{{ 'JOURNAL.coacheeBiggestInsightLabel' | translate }}</label>
                        <mat-form-field appearance="outline" class="full">
                          <textarea matInput rows="3"
                                    [placeholder]="'JOURNAL.coacheeBiggestInsightPlaceholder' | translate"
                                    [(ngModel)]="forms[s._id].post.biggestInsight"></textarea>
                        </mat-form-field>
                      </div>
                      <div class="field">
                        <label>{{ 'JOURNAL.coacheeWhatShiftedLabel' | translate }}</label>
                        <mat-form-field appearance="outline" class="full">
                          <textarea matInput rows="3"
                                    [placeholder]="'JOURNAL.coacheeWhatShiftedPlaceholder' | translate"
                                    [(ngModel)]="forms[s._id].post.whatShifted"></textarea>
                        </mat-form-field>
                      </div>

                      <p class="section-label"><span class="pip-accent"></span>{{ 'JOURNAL.coacheeCommitmentsNextSteps' | translate }}</p>
                      <div class="action-grid">
                        <div class="action-item">
                          <div class="action-num">1</div>
                          <input type="text" class="action-input"
                                 [placeholder]="'JOURNAL.coacheeActionPlaceholder' | translate"
                                 [(ngModel)]="forms[s._id].post.commitment1" />
                        </div>
                        <div class="action-item">
                          <div class="action-num">2</div>
                          <input type="text" class="action-input"
                                 [placeholder]="'JOURNAL.coacheeActionPlaceholder' | translate"
                                 [(ngModel)]="forms[s._id].post.commitment2" />
                        </div>
                        <div class="action-item">
                          <div class="action-num">3</div>
                          <input type="text" class="action-input"
                                 [placeholder]="'JOURNAL.coacheeActionPlaceholder' | translate"
                                 [(ngModel)]="forms[s._id].post.commitment3" />
                        </div>
                      </div>

                      <div class="field" style="margin-top: 1rem">
                        <label>{{ 'JOURNAL.coacheeConfidenceLabel' | translate }}</label>
                        <div class="slider-row">
                          <input type="range" min="1" max="10"
                                 [(ngModel)]="forms[s._id].post.followThroughConfidence" />
                          <span class="slider-val">{{ forms[s._id].post.followThroughConfidence || 1 }}</span>
                        </div>
                        <div class="scale-labels"><span>{{ 'JOURNAL.coacheeConfidenceScaleLow' | translate }}</span><span>{{ 'JOURNAL.coacheeConfidenceScaleHigh' | translate }}</span></div>
                      </div>

                      <p class="section-label"><span class="pip-accent"></span>{{ 'JOURNAL.coacheeSessionFeedback' | translate }}</p>
                      <div class="field">
                        <label>{{ 'JOURNAL.coacheeSessionRatingLabel' | translate }}</label>
                        <div class="stars">
                          @for (i of [1,2,3,4,5]; track i) {
                            <button type="button" class="star-btn"
                                    [class.filled]="(forms[s._id].post.sessionRating || 0) >= i"
                                    (click)="forms[s._id].post.sessionRating = i">
                              <mat-icon>{{ (forms[s._id].post.sessionRating || 0) >= i ? 'star' : 'star_border' }}</mat-icon>
                            </button>
                          }
                          @if (forms[s._id].post.sessionRating) {
                            <button type="button" class="clear-btn"
                                    (click)="forms[s._id].post.sessionRating = undefined">{{ 'JOURNAL.coacheeClear' | translate }}</button>
                          }
                        </div>
                      </div>

                      <div class="field">
                        <label>{{ 'JOURNAL.coacheeExploreNextLabel' | translate }}</label>
                        <mat-form-field appearance="outline" class="full">
                          <textarea matInput rows="3"
                                    [placeholder]="'JOURNAL.coacheeExploreNextPlaceholder' | translate"
                                    [(ngModel)]="forms[s._id].post.exploreNext"></textarea>
                        </mat-form-field>
                      </div>

                      <div class="field">
                        <label>{{ 'JOURNAL.coacheeFeedbackForCoachLabel' | translate }}</label>
                        <mat-form-field appearance="outline" class="full">
                          <textarea matInput rows="3"
                                    [placeholder]="'JOURNAL.coacheeFeedbackForCoachPlaceholder' | translate"
                                    [(ngModel)]="forms[s._id].post.feedbackForCoach"></textarea>
                        </mat-form-field>
                      </div>

                      <button mat-flat-button color="primary"
                              (click)="save(s, 'post')" [disabled]="forms[s._id].saving">
                        @if (forms[s._id].saving) { <mat-spinner diameter="16" /> }
                        {{ 'JOURNAL.savePostSession' | translate }}
                      </button>
                    }
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
      h1 { margin: 0; color: var(--artes-primary); font-size: 22px; }
      .show-all-link {
        margin-left: auto; color: var(--artes-accent); font-size: 13px; font-weight: 500;
        text-decoration: none;
        &:hover { text-decoration: underline; }
      }
    }
    .loading { display: flex; justify-content: center; padding: 60px 0; }
    .empty {
      text-align: center; padding: 60px 24px; color: #6b7c93;
      > mat-icon { font-size: 36px; width: 36px; height: 36px; color: #c8d3df; }
    }
    .note-list { display: flex; flex-direction: column; gap: 16px; }
    .note-card { background: #fff; border: 1px solid #eef2f7; border-radius: 12px; overflow: hidden; }
    .note-head {
      padding: 14px 18px; background: #f7f9fc; border-bottom: 1px solid #eef2f7;
      display: flex; align-items: center; gap: 12px;
      strong { color: var(--artes-primary); font-size: 15px; }
      .muted { color: #6b7c93; font-size: 13px; }
      .muted-status {
        margin-left: auto; text-transform: uppercase; letter-spacing: 0.5px;
        font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px;
        background: #f0f4f8; color: #6b7c93;
        &.st-scheduled { background: var(--artes-bg); color: var(--artes-accent); }
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
      p { margin: 0; color: var(--artes-primary); font-size: 14px; white-space: pre-line; }
    }
    .chips { display: flex; gap: 4px; flex-wrap: wrap; }
    .chip { background: var(--artes-bg); color: var(--artes-accent); font-size: 12px; padding: 2px 8px; border-radius: 999px; }
    mat-spinner { display: inline-block; margin-right: 6px; }

    .section-label {
      display: flex; align-items: center; gap: 8px;
      margin: 18px 0 8px;
      color: var(--artes-primary); font-size: 13px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.6px;
    }
    .pip-accent {
      display: inline-block; width: 4px; height: 16px;
      background: var(--artes-accent); border-radius: 2px;
    }
    .field {
      margin-bottom: 12px;
      label {
        display: block; margin-bottom: 6px;
        font-size: 13px; color: var(--artes-primary); font-weight: 500;
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
      &:hover { color: var(--artes-primary); }
    }
    .scale-labels {
      display: flex; justify-content: space-between;
      font-size: 11px; color: #9aa5b4; margin-top: 4px; max-width: 320px;
    }

    .locked-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 36px 16px; gap: 8px; color: #9aa5b4;
      mat-icon { font-size: 36px; width: 36px; height: 36px; color: #c8d3df; }
      p { margin: 0; font-size: 14px; }
    }

    .action-grid {
      display: flex; flex-direction: column; gap: 8px;
    }
    .action-item {
      display: flex; align-items: center; gap: 10px;
      background: #f7f9fc; border-radius: 8px; padding: 8px 12px;
    }
    .action-num {
      width: 24px; height: 24px; border-radius: 50%;
      background: var(--artes-accent); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 12px; flex-shrink: 0;
    }
    .action-input {
      flex: 1; border: none; background: transparent;
      font: inherit; padding: 6px 4px; min-width: 0;
      &:focus { outline: none; }
    }

    .slider-row {
      display: flex; align-items: center; gap: 12px; max-width: 320px;
      input[type="range"] { flex: 1; }
      .slider-val {
        font-weight: 700; color: var(--artes-primary); min-width: 22px;
        text-align: center;
      }
    }
  `],
})
export class CoacheeJournalComponent implements OnInit {
  loading = signal(true);
  sessions = signal<CoachingSession[]>([]);
  private allSessions: CoachingSession[] = [];
  private notesBySession = new Map<string, SessionNote>();
  engagementId = '';
  /** If present via ?sessionId=..., the page filters down to just that
   *  session. Otherwise the full engagement journal is shown. */
  focusSessionId: string | null = null;

  forms: Record<string, {
    pre: {
      moodRating?: number;
      topOfMind: string;
      mainTopic: string;
      valueDefinition: string;
      recentShifts: string;
      contextForCoach: string;
    };
    post: {
      biggestInsight: string;
      whatShifted: string;
      commitment1: string;
      commitment2: string;
      commitment3: string;
      followThroughConfidence?: number;
      sessionRating?: number;
      exploreNext: string;
      feedbackForCoach: string;
    };
    saving: boolean;
  }> = {};

  constructor(
    private route: ActivatedRoute,
    private journal: JournalService,
    private api: ApiService,
    private snack: MatSnackBar,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.engagementId = this.route.snapshot.params['engagementId'];
    this.load();
    // Re-apply the filter whenever ?sessionId= changes so the
    // "Show all sessions" link works without a full page reload
    // (Angular reuses the same component instance when only query
    // params change).
    this.route.queryParamMap.subscribe((params) => {
      this.focusSessionId = params.get('sessionId');
      this.applyFocusFilter();
    });
  }

  private applyFocusFilter(): void {
    if (!this.allSessions.length) return;
    const filtered = this.focusSessionId
      ? this.allSessions.filter((s) => s._id === this.focusSessionId)
      : this.allSessions;
    this.sessions.set(filtered);
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
      this.allSessions = sorted;
      this.notesBySession.clear();
      for (const n of notes || []) {
        if (n.sessionId) this.notesBySession.set(n.sessionId, n);
      }
      // Initialise the form for EVERY session so that when the focus
      // filter is later cleared via "Show all sessions", the template
      // bindings (forms[s._id].pre...) still resolve.
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
            biggestInsight: n?.coacheePost?.biggestInsight || '',
            whatShifted: n?.coacheePost?.whatShifted || '',
            commitment1: n?.coacheePost?.commitment1 || '',
            commitment2: n?.coacheePost?.commitment2 || '',
            commitment3: n?.coacheePost?.commitment3 || '',
            followThroughConfidence: n?.coacheePost?.followThroughConfidence,
            sessionRating: n?.coacheePost?.sessionRating,
            exploreNext: n?.coacheePost?.exploreNext || '',
            feedbackForCoach: n?.coacheePost?.feedbackForCoach || '',
          },
          saving: false,
        };
      }
      this.applyFocusFilter();
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
        this.snack.open(this.translate.instant('JOURNAL.coacheeSaved'), this.translate.instant('JOURNAL.coacheeOk'), { duration: 2000 });
      },
      error: () => {
        f.saving = false;
        this.snack.open(this.translate.instant('JOURNAL.failedSave'), this.translate.instant('JOURNAL.coacheeOk'), { duration: 3000 });
      },
    });
  }
}
