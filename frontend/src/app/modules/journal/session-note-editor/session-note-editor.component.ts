import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { JournalService, SessionNote, AccountabilityItem } from '../journal.service';
import { ApiService } from '../../../core/api.service';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
@Component({
  selector: 'app-session-note-editor',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterLink,
    MatIconModule, MatButtonModule, MatTabsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatDatepickerModule, MatNativeDateModule, MatChipsModule,
    MatCheckboxModule, MatProgressSpinnerModule, MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div class="journal-page">
      <div class="page-header">
        <a [routerLink]="backLink" class="back-link"><mat-icon>arrow_back</mat-icon> {{ 'COMMON.back' | translate }}</a>
        <h1>{{ isEdit ? ('JOURNAL.editSessionNote' | translate) : ('JOURNAL.newSessionNoteTitle' | translate) }}</h1>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {
        <!-- Meta fields -->
        <div class="meta-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'JOURNAL.sessionDate' | translate }}</mat-label>
            <input matInput [matDatepicker]="dp" [(ngModel)]="sessionDate">
            <mat-datepicker-toggle matIconSuffix [for]="dp" />
            <mat-datepicker #dp />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'JOURNAL.durationMin' | translate }}</mat-label>
            <input matInput type="number" [(ngModel)]="durationMinutes">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'JOURNAL.format' | translate }}</mat-label>
            <mat-select [(ngModel)]="format">
              <mat-option value="video">{{ 'JOURNAL.video' | translate }}</mat-option>
              <mat-option value="phone">{{ 'JOURNAL.phone' | translate }}</mat-option>
              <mat-option value="in_person">{{ 'JOURNAL.inPerson' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Tabs -->
        <mat-tab-group animationDuration="0ms">
          <!-- BEFORE — read-only view of what the coachee filled in -->
          <mat-tab [label]="'JOURNAL.before' | translate">
            <div class="tab-content">
              @if (!hasCoacheePre()) {
                <p class="empty-tab">{{ 'JOURNAL.coacheePreNotFilled' | translate }}</p>
              }
              @if (hasCoacheePre()) {
                <div class="coachee-panel">
                  <div class="coachee-panel-head">
                    <mat-icon>person_outline</mat-icon>
                    <span>Coachee's pre-session input</span>
                  </div>
                  @if (note.coacheePre?.moodRating) {
                    <div class="ro-field">
                      <label>Energy / mood</label>
                      <p class="stars-ro">
                        @for (i of [1,2,3,4,5]; track i) {
                          <mat-icon>{{ (note.coacheePre!.moodRating || 0) >= i ? 'star' : 'star_border' }}</mat-icon>
                        }
                        <span class="rating-num">({{ note.coacheePre!.moodRating }}/5)</span>
                      </p>
                    </div>
                  }
                  @if (note.coacheePre?.topOfMind) {
                    <div class="ro-field"><label>Top of mind</label><p>{{ note.coacheePre!.topOfMind }}</p></div>
                  }
                  @if (note.coacheePre?.mainTopic) {
                    <div class="ro-field"><label>Main topic to explore</label><p>{{ note.coacheePre!.mainTopic }}</p></div>
                  }
                  @if (note.coacheePre?.valueDefinition) {
                    <div class="ro-field"><label>What would feel valuable</label><p>{{ note.coacheePre!.valueDefinition }}</p></div>
                  }
                  @if (note.coacheePre?.recentShifts) {
                    <div class="ro-field"><label>Since last session</label><p>{{ note.coacheePre!.recentShifts }}</p></div>
                  }
                  @if (note.coacheePre?.contextForCoach) {
                    <div class="ro-field"><label>Context for coach</label><p>{{ note.coacheePre!.contextForCoach }}</p></div>
                  }
                </div>
              }
            </div>
          </mat-tab>

          <!-- DURING -->
          <mat-tab [label]="'JOURNAL.during' | translate">
            <div class="tab-content">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'JOURNAL.openingState' | translate }}</mat-label>
                <textarea matInput rows="3" [(ngModel)]="inSession.openingState" [placeholder]="'JOURNAL.openingStatePlaceholder' | translate"></textarea>
              </mat-form-field>

              <!-- Key Themes -->
              <label class="field-label">{{ 'JOURNAL.keyThemes' | translate }}</label>
              <div class="chip-row">
                @for (theme of inSession.keyThemes; track $index) {
                  <span class="editable-chip">
                    {{ theme }}
                    <mat-icon (click)="removeTheme($index)">close</mat-icon>
                  </span>
                }
                <input class="chip-input" [placeholder]="'JOURNAL.addThemePlaceholder' | translate"
                  (keydown.enter)="addTheme($event)" #themeInput>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'JOURNAL.observations' | translate }}</mat-label>
                <textarea matInput rows="8" [(ngModel)]="inSession.observations" [placeholder]="'JOURNAL.observationsPlaceholder' | translate"></textarea>
              </mat-form-field>

              <!-- Notable Quotes -->
              <label class="field-label">{{ 'JOURNAL.notableQuotes' | translate }}</label>
              @for (q of inSession.notableQuotes; track $index) {
                <div class="repeatable-row">
                  <mat-form-field appearance="outline" class="flex-grow">
                    <input matInput [(ngModel)]="inSession.notableQuotes[$index]" [placeholder]="'JOURNAL.quotePlaceholder' | translate">
                  </mat-form-field>
                  <button mat-icon-button (click)="removeQuote($index)"><mat-icon>remove_circle_outline</mat-icon></button>
                </div>
              }
              <button mat-button (click)="addQuote()"><mat-icon>add</mat-icon> {{ 'JOURNAL.addQuote' | translate }}</button>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'JOURNAL.coachInterventions' | translate }}</mat-label>
                <textarea matInput rows="4" [(ngModel)]="inSession.coachInterventions" [placeholder]="'JOURNAL.coachInterventionsPlaceholder' | translate"></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'JOURNAL.energyShifts' | translate }}</mat-label>
                <textarea matInput rows="3" [(ngModel)]="inSession.energyShifts" [placeholder]="'JOURNAL.energyShiftsPlaceholder' | translate"></textarea>
              </mat-form-field>
            </div>
          </mat-tab>

          <!-- AFTER — read-only view of what the coachee filled in -->
          <mat-tab [label]="'JOURNAL.after' | translate">
            <div class="tab-content">
              @if (!hasCoacheePost()) {
                <p class="empty-tab">{{ 'JOURNAL.coacheePostNotFilled' | translate }}</p>
              }
              <!-- What the coachee shared after the session (read-only) -->
              @if (hasCoacheePost()) {
                <div class="coachee-panel">
                  <div class="coachee-panel-head">
                    <mat-icon>person_outline</mat-icon>
                    <span>Coachee's post-session reflection</span>
                  </div>
                  @if (note.coacheePost?.biggestInsight) {
                    <div class="ro-field"><label>Biggest insight</label><p>{{ note.coacheePost!.biggestInsight }}</p></div>
                  }
                  @if (note.coacheePost?.whatShifted) {
                    <div class="ro-field"><label>What shifted</label><p>{{ note.coacheePost!.whatShifted }}</p></div>
                  }
                  @if (coacheeCommitments().length) {
                    <div class="ro-field"><label>Commitments</label>
                      <ul class="commitment-list">
                        @for (c of coacheeCommitments(); track $index) { <li>{{ c }}</li> }
                      </ul>
                    </div>
                  }
                  @if (note.coacheePost?.followThroughConfidence) {
                    <div class="ro-field"><label>Follow-through confidence</label>
                      <p>{{ note.coacheePost!.followThroughConfidence }} / 10</p>
                    </div>
                  }
                  @if (note.coacheePost?.sessionRating) {
                    <div class="ro-field">
                      <label>Session rating</label>
                      <p class="stars-ro">
                        @for (i of [1,2,3,4,5]; track i) {
                          <mat-icon>{{ (note.coacheePost!.sessionRating || 0) >= i ? 'star' : 'star_border' }}</mat-icon>
                        }
                        <span class="rating-num">({{ note.coacheePost!.sessionRating }}/5)</span>
                      </p>
                    </div>
                  }
                  @if (note.coacheePost?.exploreNext) {
                    <div class="ro-field"><label>Explore next</label><p>{{ note.coacheePost!.exploreNext }}</p></div>
                  }
                  @if (note.coacheePost?.feedbackForCoach) {
                    <div class="ro-field"><label>Feedback for coach</label><p>{{ note.coacheePost!.feedbackForCoach }}</p></div>
                  }
                </div>
              }
            </div>
          </mat-tab>
        </mat-tab-group>

        <!-- Action bar -->
        <div class="action-bar">
          <button mat-flat-button class="draft-btn" (click)="save('draft')" [disabled]="saving()">
            <mat-icon>save</mat-icon> {{ 'JOURNAL.saveDraft' | translate }}
          </button>
          <button mat-flat-button color="primary" (click)="save('complete')" [disabled]="saving()">
            <mat-icon>check_circle</mat-icon> {{ 'JOURNAL.markComplete' | translate }}
          </button>
          <button mat-stroked-button (click)="generateAi()" [disabled]="saving() || aiLoading() || noteStatus !== 'complete'">
            <mat-icon>auto_awesome</mat-icon> {{ 'JOURNAL.generateAiSummary' | translate }}
          </button>
          @if (saving() || aiLoading()) {
            <mat-spinner diameter="20" />
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .journal-page { padding: 32px; max-width: 900px; background: #F8F6F1; min-height: 100%; }
    .page-header {
      margin-bottom: 16px;
      .back-link { display: flex; align-items: center; gap: 4px; color: var(--artes-accent); text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
      h1 { font-size: 22px; color: var(--artes-primary); margin: 0; }
    }
    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .meta-row {
      display: flex; gap: 12px; margin-bottom: 8px;
      mat-form-field { flex: 1; }
    }

    .tab-content { padding: 20px 0; }
    .empty-tab {
      text-align: center; color: #9aa5b4; font-style: italic;
      padding: 32px 16px; margin: 0;
    }
    .coachee-panel {
      margin-top: 20px;
      background: #f3eafc; border: 1px solid #e0d0f0; border-radius: 10px;
      padding: 14px 16px;
    }
    .coachee-panel-head {
      display: flex; align-items: center; gap: 6px;
      color: #6b3aa0; font-size: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.6px;
      margin-bottom: 8px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .ro-field {
      margin-bottom: 8px;
      label { display: block; font-size: 11px; color: #9aa5b4; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
      p { margin: 0; color: var(--artes-primary); font-size: 14px; white-space: pre-line; }
      .stars-ro { display: flex; align-items: center; gap: 2px;
        mat-icon { color: #f5b042; font-size: 18px; width: 18px; height: 18px; }
        .rating-num { color: #6b7c93; font-size: 12px; margin-left: 6px; }
      }
      .commitment-list { margin: 4px 0 0; padding-left: 20px; color: var(--artes-primary);
        li { font-size: 14px; margin-bottom: 2px; }
      }
    }
    .full-width { width: 100%; }
    .flex-grow { flex: 1; }
    .field-label { font-size: 13px; font-weight: 600; color: #5a6a7e; display: block; margin: 8px 0 6px; }

    .chip-row {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 16px;
    }
    .editable-chip {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; padding: 4px 10px; border-radius: 999px;
      background: #f3eeff; color: #7c5cbf; font-weight: 500;
      mat-icon { font-size: 14px; width: 14px; height: 14px; cursor: pointer; }
    }
    .chip-input {
      border: 1px dashed #ccc; border-radius: 999px; padding: 4px 12px; font-size: 12px;
      outline: none; background: transparent; min-width: 120px;
      &:focus { border-color: #7c5cbf; }
    }

    .repeatable-row { display: flex; align-items: center; gap: 8px; }
    .acc-row { display: flex; align-items: center; gap: 8px; }

    .action-bar {
      position: sticky; bottom: 0; background: white; border-radius: 12px;
      padding: 14px 20px; margin-top: 24px; display: flex; align-items: center; gap: 10px;
      box-shadow: 0 -2px 12px rgba(0,0,0,0.08);
    }
    .draft-btn { background: #5a6a7e !important; color: white !important; }

    @media (max-width: 768px) {
      .meta-row { flex-direction: column; }
    }
  `],
})
export class SessionNoteEditorComponent implements OnInit {
  isEdit = false;
  noteId = '';
  engagementId = '';
  sessionId = '';
  noteStatus: 'draft' | 'complete' = 'draft';
  backLink = '/journal';

  loading = signal(true);
  saving = signal(false);
  aiLoading = signal(false);

  sessionDate: Date = new Date();
  durationMinutes = 60;
  format: 'video' | 'phone' | 'in_person' = 'video';

  preSession = { agenda: '', hypotheses: '', coachIntention: '' };
  inSession = { openingState: '', keyThemes: [] as string[], observations: '', notableQuotes: [] as string[], coachInterventions: '', energyShifts: '' };
  postSession = { coachReflection: '', whatWorked: '', whatToExplore: '', clientGrowthEdge: '', accountabilityItems: [] as AccountabilityItem[] };

  // Read-only mirror of what the coachee wrote (rendered in the Before / After tabs).
  note: {
    coacheePre?: { moodRating?: number; topOfMind?: string; mainTopic?: string; valueDefinition?: string; recentShifts?: string; contextForCoach?: string };
    coacheePost?: {
      biggestInsight?: string; whatShifted?: string;
      commitment1?: string; commitment2?: string; commitment3?: string;
      followThroughConfidence?: number; sessionRating?: number;
      exploreNext?: string; feedbackForCoach?: string;
    };
  } = {};

  hasCoacheePre(): boolean {
    const p = this.note.coacheePre;
    return !!(p && (p.moodRating || p.topOfMind || p.mainTopic || p.valueDefinition || p.recentShifts || p.contextForCoach));
  }
  hasCoacheePost(): boolean {
    const p = this.note.coacheePost;
    return !!(p && (
      p.biggestInsight || p.whatShifted ||
      p.commitment1 || p.commitment2 || p.commitment3 ||
      p.followThroughConfidence || p.sessionRating ||
      p.exploreNext || p.feedbackForCoach
    ));
  }
  coacheeCommitments(): string[] {
    const p = this.note.coacheePost;
    if (!p) return [];
    return [p.commitment1, p.commitment2, p.commitment3].filter(Boolean) as string[];
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private journal: JournalService,
    private api: ApiService,
    private snack: MatSnackBar,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.params;
    this.noteId = params['noteId'] || '';
    this.engagementId = params['engagementId'] || '';
    this.isEdit = !!this.noteId;

    if (this.isEdit) {
      this.journal.getNote(this.noteId).subscribe({
        next: (note) => {
          this.engagementId = note.engagementId;
          this.sessionId = note.sessionId || '';
          this.sessionDate = new Date(note.sessionDate);
          this.durationMinutes = note.durationMinutes;
          this.format = note.format;
          this.noteStatus = note.status;
          this.preSession = { agenda: note.preSession?.agenda || '', hypotheses: note.preSession?.hypotheses || '', coachIntention: note.preSession?.coachIntention || '' };
          this.inSession = {
            openingState: note.inSession?.openingState || '',
            keyThemes: [...(note.inSession?.keyThemes || [])],
            observations: note.inSession?.observations || '',
            notableQuotes: [...(note.inSession?.notableQuotes || [])],
            coachInterventions: note.inSession?.coachInterventions || '',
            energyShifts: note.inSession?.energyShifts || '',
          };
          this.postSession = {
            coachReflection: note.postSession?.coachReflection || '',
            whatWorked: note.postSession?.whatWorked || '',
            whatToExplore: note.postSession?.whatToExplore || '',
            clientGrowthEdge: note.postSession?.clientGrowthEdge || '',
            accountabilityItems: (note.postSession?.accountabilityItems || []).map((a) => ({ ...a })),
          };
          this.note = {
            coacheePre: note.coacheePre ? { ...note.coacheePre } : undefined,
            coacheePost: note.coacheePost ? { ...note.coacheePost } : undefined,
          };
          this.backLink = `/journal/engagement/${this.engagementId}`;
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.sessionId = this.route.snapshot.queryParams['sessionId'] || '';
      this.backLink = `/coaching/${this.engagementId}`;
      // Pre-fill from linked coaching session if provided
      if (this.sessionId) {
        this.api.get<any>(`/coaching/sessions/${this.sessionId}`).subscribe({
          next: (s) => {
            this.sessionDate = new Date(s.date);
            this.durationMinutes = s.duration || 60;
            this.format = s.format || 'video';
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      } else {
        this.loading.set(false);
      }
    }
  }

  addTheme(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.trim();
    if (val) { this.inSession.keyThemes.push(val); input.value = ''; }
    event.preventDefault();
  }
  removeTheme(i: number): void { this.inSession.keyThemes.splice(i, 1); }

  addQuote(): void { this.inSession.notableQuotes.push(''); }
  removeQuote(i: number): void { this.inSession.notableQuotes.splice(i, 1); }

  addAccountabilityItem(): void {
    this.postSession.accountabilityItems.push({ item: '', completed: false });
  }
  removeAccountabilityItem(i: number): void { this.postSession.accountabilityItems.splice(i, 1); }

  save(status: 'draft' | 'complete'): void {
    this.saving.set(true);
    const body: any = {
      sessionDate: this.sessionDate,
      durationMinutes: this.durationMinutes,
      format: this.format,
      status,
      preSession: this.preSession,
      inSession: { ...this.inSession, notableQuotes: this.inSession.notableQuotes.filter(Boolean) },
      postSession: { ...this.postSession, accountabilityItems: this.postSession.accountabilityItems.filter((a) => a.item) },
    };
    if (this.sessionId) body.sessionId = this.sessionId;

    const obs = this.isEdit
      ? this.journal.updateNote(this.noteId, body)
      : this.journal.createNote(this.engagementId, body);

    obs.subscribe({
      next: (note) => {
        this.saving.set(false);
        this.noteStatus = note.status;
        this.noteId = note._id;
        this.isEdit = true;
        this.snack.open(status === 'complete' ? this.translate.instant('JOURNAL.sessionMarkedComplete') : this.translate.instant('JOURNAL.draftSaved'), '', { duration: 2000 });
      },
      error: () => { this.saving.set(false); this.snack.open(this.translate.instant('JOURNAL.failedSave'), '', { duration: 3000 }); },
    });
  }

  generateAi(): void {
    if (!this.noteId) return;
    this.aiLoading.set(true);
    this.journal.generateAiSummary(this.noteId).subscribe({
      next: () => {
        this.aiLoading.set(false);
        this.snack.open(this.translate.instant('JOURNAL.aiSummaryGenerated'), '', { duration: 2000 });
        this.router.navigate(['/journal/note', this.noteId]);
      },
      error: () => { this.aiLoading.set(false); this.snack.open(this.translate.instant('JOURNAL.failedGenerateSummary'), '', { duration: 3000 }); },
    });
  }
}
