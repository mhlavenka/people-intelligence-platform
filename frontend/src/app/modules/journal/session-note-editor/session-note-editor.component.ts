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

@Component({
  selector: 'app-session-note-editor',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterLink,
    MatIconModule, MatButtonModule, MatTabsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatDatepickerModule, MatNativeDateModule, MatChipsModule,
    MatCheckboxModule, MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <div class="journal-page">
      <div class="page-header">
        <a [routerLink]="backLink" class="back-link"><mat-icon>arrow_back</mat-icon> Back</a>
        <h1>{{ isEdit ? 'Edit' : 'New' }} Session Note</h1>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {
        <!-- Meta fields -->
        <div class="meta-row">
          <mat-form-field appearance="outline">
            <mat-label>Session Date</mat-label>
            <input matInput [matDatepicker]="dp" [(ngModel)]="sessionDate">
            <mat-datepicker-toggle matIconSuffix [for]="dp" />
            <mat-datepicker #dp />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Duration (min)</mat-label>
            <input matInput type="number" [(ngModel)]="durationMinutes">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Format</mat-label>
            <mat-select [(ngModel)]="format">
              <mat-option value="video">Video</mat-option>
              <mat-option value="phone">Phone</mat-option>
              <mat-option value="in_person">In-Person</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Tabs -->
        <mat-tab-group animationDuration="0ms">
          <!-- BEFORE -->
          <mat-tab label="Before">
            <div class="tab-content">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Agenda</mat-label>
                <textarea matInput rows="4" [(ngModel)]="preSession.agenda" placeholder="What topics or goals are planned for this session?"></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Hypotheses</mat-label>
                <textarea matInput rows="4" [(ngModel)]="preSession.hypotheses" placeholder="What might come up? What patterns do you expect?"></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Coach Intention</mat-label>
                <textarea matInput rows="4" [(ngModel)]="preSession.coachIntention" placeholder="What is your coaching intention for this session?"></textarea>
              </mat-form-field>
            </div>
          </mat-tab>

          <!-- DURING -->
          <mat-tab label="During">
            <div class="tab-content">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Opening State</mat-label>
                <textarea matInput rows="3" [(ngModel)]="inSession.openingState" placeholder="How did the coachee present at the start?"></textarea>
              </mat-form-field>

              <!-- Key Themes -->
              <label class="field-label">Key Themes</label>
              <div class="chip-row">
                @for (theme of inSession.keyThemes; track $index) {
                  <span class="editable-chip">
                    {{ theme }}
                    <mat-icon (click)="removeTheme($index)">close</mat-icon>
                  </span>
                }
                <input class="chip-input" placeholder="Add theme + Enter"
                  (keydown.enter)="addTheme($event)" #themeInput>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Observations</mat-label>
                <textarea matInput rows="8" [(ngModel)]="inSession.observations" placeholder="What did you observe during the session?"></textarea>
              </mat-form-field>

              <!-- Notable Quotes -->
              <label class="field-label">Notable Quotes</label>
              @for (q of inSession.notableQuotes; track $index) {
                <div class="repeatable-row">
                  <mat-form-field appearance="outline" class="flex-grow">
                    <input matInput [(ngModel)]="inSession.notableQuotes[$index]" placeholder="Quote...">
                  </mat-form-field>
                  <button mat-icon-button (click)="removeQuote($index)"><mat-icon>remove_circle_outline</mat-icon></button>
                </div>
              }
              <button mat-button (click)="addQuote()"><mat-icon>add</mat-icon> Add Quote</button>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Coach Interventions</mat-label>
                <textarea matInput rows="4" [(ngModel)]="inSession.coachInterventions" placeholder="What coaching tools or interventions did you use?"></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Energy Shifts</mat-label>
                <textarea matInput rows="3" [(ngModel)]="inSession.energyShifts" placeholder="Were there notable shifts in energy or engagement?"></textarea>
              </mat-form-field>
            </div>
          </mat-tab>

          <!-- AFTER -->
          <mat-tab label="After">
            <div class="tab-content">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Coach Reflection</mat-label>
                <textarea matInput rows="6" [(ngModel)]="postSession.coachReflection" placeholder="Your personal reflections on the session..."></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>What Worked</mat-label>
                <textarea matInput rows="4" [(ngModel)]="postSession.whatWorked"></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>What to Explore Next</mat-label>
                <textarea matInput rows="4" [(ngModel)]="postSession.whatToExplore"></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Client's Growth Edge</mat-label>
                <textarea matInput rows="4" [(ngModel)]="postSession.clientGrowthEdge" placeholder="The most significant growth area emerging..."></textarea>
              </mat-form-field>

              <!-- Accountability Items -->
              <label class="field-label">Accountability Items</label>
              @for (item of postSession.accountabilityItems; track $index) {
                <div class="acc-row">
                  <mat-checkbox [(ngModel)]="item.completed" />
                  <mat-form-field appearance="outline" class="flex-grow">
                    <input matInput [(ngModel)]="item.item" placeholder="Action item...">
                  </mat-form-field>
                  <mat-form-field appearance="outline" style="width: 140px">
                    <mat-label>Due</mat-label>
                    <input matInput [matDatepicker]="accDp" [(ngModel)]="item.dueDate">
                    <mat-datepicker-toggle matIconSuffix [for]="accDp" />
                    <mat-datepicker #accDp />
                  </mat-form-field>
                  <button mat-icon-button (click)="removeAccountabilityItem($index)"><mat-icon>remove_circle_outline</mat-icon></button>
                </div>
              }
              <button mat-button (click)="addAccountabilityItem()"><mat-icon>add</mat-icon> Add Item</button>
            </div>
          </mat-tab>
        </mat-tab-group>

        <!-- Action bar -->
        <div class="action-bar">
          <button mat-flat-button (click)="save('draft')" [disabled]="saving()">
            <mat-icon>save</mat-icon> Save Draft
          </button>
          <button mat-flat-button color="primary" (click)="save('complete')" [disabled]="saving()">
            <mat-icon>check_circle</mat-icon> Mark Complete
          </button>
          <button mat-stroked-button (click)="generateAi()" [disabled]="saving() || aiLoading() || noteStatus !== 'complete'">
            <mat-icon>auto_awesome</mat-icon> Generate AI Summary
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
      .back-link { display: flex; align-items: center; gap: 4px; color: #3A9FD6; text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
      h1 { font-size: 22px; color: #1B2A47; margin: 0; }
    }
    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .meta-row {
      display: flex; gap: 12px; margin-bottom: 8px;
      mat-form-field { flex: 1; }
    }

    .tab-content { padding: 20px 0; }
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

    @media (max-width: 768px) {
      .meta-row { flex-direction: column; }
    }
  `],
})
export class SessionNoteEditorComponent implements OnInit {
  isEdit = false;
  noteId = '';
  engagementId = '';
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private journal: JournalService,
    private snack: MatSnackBar,
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
          this.backLink = `/journal/engagement/${this.engagementId}`;
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.backLink = `/journal/engagement/${this.engagementId}`;
      this.loading.set(false);
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

    const obs = this.isEdit
      ? this.journal.updateNote(this.noteId, body)
      : this.journal.createNote(this.engagementId, body);

    obs.subscribe({
      next: (note) => {
        this.saving.set(false);
        this.noteStatus = note.status;
        this.noteId = note._id;
        this.isEdit = true;
        this.snack.open(status === 'complete' ? 'Session marked complete' : 'Draft saved', '', { duration: 2000 });
      },
      error: () => { this.saving.set(false); this.snack.open('Failed to save', '', { duration: 3000 }); },
    });
  }

  generateAi(): void {
    if (!this.noteId) return;
    this.aiLoading.set(true);
    this.journal.generateAiSummary(this.noteId).subscribe({
      next: () => {
        this.aiLoading.set(false);
        this.snack.open('AI summary generated', '', { duration: 2000 });
        this.router.navigate(['/journal/note', this.noteId]);
      },
      error: () => { this.aiLoading.set(false); this.snack.open('Failed to generate summary', '', { duration: 3000 }); },
    });
  }
}
