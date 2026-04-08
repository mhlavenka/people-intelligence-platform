import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { JournalService, JournalMood, ReflectiveEntry } from '../journal.service';

const MOODS: { value: JournalMood; icon: string; label: string }[] = [
  { value: 'energized',  icon: 'bolt',           label: 'Energized' },
  { value: 'reflective', icon: 'self_improvement', label: 'Reflective' },
  { value: 'challenged', icon: 'fitness_center', label: 'Challenged' },
  { value: 'inspired',   icon: 'lightbulb',      label: 'Inspired' },
  { value: 'depleted',   icon: 'battery_alert',  label: 'Depleted' },
];

@Component({
  selector: 'app-reflective-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatDatepickerModule, MatNativeDateModule, MatChipsModule, MatSlideToggleModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <div class="journal-page">
      <div class="page-header">
        <a routerLink="/journal/reflective" class="back-link"><mat-icon>arrow_back</mat-icon> Back to Journal</a>
        <h1>{{ isEdit ? 'Edit' : 'New' }} Reflective Entry</h1>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {
        <div class="editor-card">
          <div class="row-2">
            <mat-form-field appearance="outline" class="flex-grow">
              <mat-label>Title</mat-label>
              <input matInput [(ngModel)]="title" placeholder="What's on your mind?">
            </mat-form-field>
            <mat-form-field appearance="outline" style="width: 160px">
              <mat-label>Date</mat-label>
              <input matInput [matDatepicker]="dp" [(ngModel)]="entryDate">
              <mat-datepicker-toggle matIconSuffix [for]="dp" />
              <mat-datepicker #dp />
            </mat-form-field>
          </div>

          <!-- Mood selector -->
          <label class="field-label">How are you feeling?</label>
          <div class="mood-selector">
            @for (m of moods; track m.value) {
              <button class="mood-btn" [class.selected]="mood === m.value" (click)="mood = m.value">
                <mat-icon>{{ m.icon }}</mat-icon>
                <span>{{ m.label }}</span>
              </button>
            }
          </div>

          <!-- Body -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Your Reflection</mat-label>
            <textarea matInput rows="10" [(ngModel)]="body" placeholder="Write freely about your coaching practice, observations, or professional growth..."></textarea>
          </mat-form-field>

          <!-- Tags -->
          <label class="field-label">Tags</label>
          <div class="chip-row">
            @for (tag of tags; track $index) {
              <span class="editable-chip">
                {{ tag }}
                <mat-icon (click)="removeTag($index)">close</mat-icon>
              </span>
            }
            <input class="chip-input" placeholder="Add tag + Enter"
              (keydown.enter)="addTag($event)" #tagInput>
          </div>

          <!-- Supervision toggle -->
          <div class="toggle-row">
            <mat-slide-toggle [(ngModel)]="isSupervisionReady">Flag for Supervision</mat-slide-toggle>
            <span class="toggle-hint">Mark this entry for inclusion in your supervision digest</span>
          </div>

          <!-- Actions -->
          <div class="action-row">
            <button mat-flat-button color="primary" (click)="save()" [disabled]="saving() || !title">
              <mat-icon>save</mat-icon> Save
            </button>
            @if (isEdit) {
              <button mat-stroked-button color="warn" (click)="deleteEntry()" [disabled]="saving()">
                <mat-icon>delete</mat-icon> Delete
              </button>
            }
            @if (saving()) { <mat-spinner diameter="20" /> }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .journal-page { padding: 32px; max-width: 800px; background: #F8F6F1; min-height: 100%; }
    .page-header {
      margin-bottom: 16px;
      .back-link { display: flex; align-items: center; gap: 4px; color: #3A9FD6; text-decoration: none; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
      h1 { font-size: 22px; color: #1B2A47; margin: 0; }
    }
    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .editor-card {
      background: white; border-radius: 16px; padding: 28px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .row-2 { display: flex; gap: 12px; }
    .flex-grow { flex: 1; }
    .full-width { width: 100%; }
    .field-label { font-size: 13px; font-weight: 600; color: #5a6a7e; display: block; margin: 8px 0 8px; }

    .mood-selector {
      display: flex; gap: 8px; margin-bottom: 20px;
    }
    .mood-btn {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 10px 16px; border-radius: 10px; border: 2px solid #e0e4ea;
      background: transparent; cursor: pointer; transition: all 0.15s;
      mat-icon { font-size: 24px; width: 24px; height: 24px; color: #9aa5b4; }
      span { font-size: 11px; color: #9aa5b4; font-weight: 500; }
      &:hover { border-color: #3A9FD6; }
      &.selected {
        border-color: #3A9FD6; background: #EBF5FB;
        mat-icon { color: #3A9FD6; }
        span { color: #3A9FD6; }
      }
    }

    .chip-row {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 16px;
    }
    .editable-chip {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; padding: 4px 10px; border-radius: 999px;
      background: #f0f4f8; color: #5a6a7e; font-weight: 500;
      mat-icon { font-size: 14px; width: 14px; height: 14px; cursor: pointer; }
    }
    .chip-input {
      border: 1px dashed #ccc; border-radius: 999px; padding: 4px 12px; font-size: 12px;
      outline: none; background: transparent; min-width: 120px;
      &:focus { border-color: #7c5cbf; }
    }

    .toggle-row {
      display: flex; align-items: center; gap: 12px; margin: 16px 0;
      .toggle-hint { font-size: 12px; color: #9aa5b4; }
    }

    .action-row { display: flex; align-items: center; gap: 10px; margin-top: 20px; }

    @media (max-width: 768px) {
      .row-2 { flex-direction: column; }
      .mood-selector { flex-wrap: wrap; }
    }
  `],
})
export class ReflectiveEditorComponent implements OnInit {
  isEdit = false;
  entryId = '';
  moods = MOODS;

  loading = signal(true);
  saving = signal(false);

  title = '';
  entryDate: Date = new Date();
  body = '';
  mood: JournalMood = 'reflective';
  tags: string[] = [];
  isSupervisionReady = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private journal: JournalService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.entryId = this.route.snapshot.params['entryId'] || '';
    this.isEdit = !!this.entryId;

    if (this.isEdit) {
      this.journal.getReflectiveEntry(this.entryId).subscribe({
        next: (e) => {
          this.title = e.title;
          this.entryDate = new Date(e.entryDate);
          this.body = e.body;
          this.mood = e.mood;
          this.tags = [...e.tags];
          this.isSupervisionReady = e.isSupervisionReady;
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.loading.set(false);
    }
  }

  addTag(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.trim();
    if (val && !this.tags.includes(val)) { this.tags.push(val); input.value = ''; }
    event.preventDefault();
  }
  removeTag(i: number): void { this.tags.splice(i, 1); }

  save(): void {
    this.saving.set(true);
    const data: Partial<ReflectiveEntry> = {
      title: this.title,
      entryDate: this.entryDate.toISOString(),
      body: this.body,
      mood: this.mood,
      tags: this.tags,
      isSupervisionReady: this.isSupervisionReady,
    };

    const obs = this.isEdit
      ? this.journal.updateReflectiveEntry(this.entryId, data)
      : this.journal.createReflectiveEntry(data);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('Entry saved', '', { duration: 2000 });
        this.router.navigate(['/journal/reflective']);
      },
      error: () => { this.saving.set(false); this.snack.open('Failed to save', '', { duration: 3000 }); },
    });
  }

  deleteEntry(): void {
    if (!confirm('Delete this reflective entry?')) return;
    this.saving.set(true);
    this.journal.deleteReflectiveEntry(this.entryId).subscribe({
      next: () => { this.router.navigate(['/journal/reflective']); },
      error: () => { this.saving.set(false); this.snack.open('Failed to delete', '', { duration: 3000 }); },
    });
  }
}
