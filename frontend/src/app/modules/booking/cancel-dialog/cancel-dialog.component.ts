import { Component, Inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogCloseButtonComponent } from '../../../shared/dialog-close-button/dialog-close-button.component';
export interface CancelDialogData {
  /** What's being cancelled — shown in the confirmation copy. */
  title?: string;
  /** The object's starting time, for a "on <date> at <time>" hint. */
  startTime?: string | Date;
  coachName?: string;
  /** Label + placeholder for the message textarea. */
  noteLabel?: string;
  notePlaceholder?: string;
  /** Button copy. */
  confirmLabel?: string;
  /** Warning banner shown above the textarea for late cancellations etc. */
  warning?: string;
}

export interface CancelDialogResult {
  reason?: string;
}

@Component({
  selector: 'app-cancel-dialog',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    TranslateModule, DialogCloseButtonComponent,
  ],
  template: `
    <app-dialog-close-btn (closed)="cancel()" />
    <h2 mat-dialog-title>{{ data.title || ('BOOKING.cancelSession' | translate) }}</h2>
    <mat-dialog-content>
      @if (data.startTime) {
        <p class="intro">
          {{ 'BOOKING.cancelSessionIntro' | translate }}
          @if (data.coachName) { {{ 'BOOKING.withCoach' | translate }} <strong>{{ data.coachName }}</strong> }
          {{ 'BOOKING.onDate' | translate }} <strong>{{ data.startTime | date:'EEEE, MMM d, y' }}</strong>
          {{ 'BOOKING.atTime' | translate }} <strong>{{ data.startTime | date:'shortTime' }}</strong>?
        </p>
      }

      @if (data.warning) {
        <div class="warning-banner">
          <mat-icon>warning</mat-icon>
          <span>{{ data.warning }}</span>
        </div>
      }

      <mat-form-field appearance="outline" class="note-field">
        <mat-label>{{ data.noteLabel || ('BOOKING.messageToCoach' | translate) }}</mat-label>
        <textarea matInput rows="4"
                  [(ngModel)]="reason"
                  [placeholder]="data.notePlaceholder || translate.instant('BOOKING.cancelPlaceholder')">
        </textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()" [disabled]="saving()">{{ 'BOOKING.keepSession' | translate }}</button>
      <button mat-flat-button color="warn" (click)="confirm()" [disabled]="saving()">
        @if (saving()) { <mat-spinner diameter="18" /> }
        {{ data.confirmLabel || ('BOOKING.cancelSession' | translate) }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .intro { margin: 0 0 16px; color: #46546b; line-height: 1.5; }
    .warning-banner {
      display: flex; align-items: flex-start; gap: 8px;
      background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
      padding: 12px 14px; border-radius: 8px; margin-bottom: 16px;
      font-size: 13px; line-height: 1.5;
      mat-icon { color: #ef4444; flex-shrink: 0; font-size: 18px; width: 18px; height: 18px; margin-top: 1px; }
    }
    .note-field { width: 100%; display: block; }
    mat-spinner { display: inline-block; margin-right: 6px; }
    mat-dialog-content { min-width: 360px; }
  `],
})
export class CancelDialogComponent {
  reason = '';
  saving = signal(false);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CancelDialogData,
    private dialogRef: MatDialogRef<CancelDialogComponent, CancelDialogResult | null>,
    public translate: TranslateService,
  ) {}

  cancel(): void { this.dialogRef.close(null); }

  confirm(): void {
    const trimmed = this.reason.trim();
    this.dialogRef.close({ ...(trimmed ? { reason: trimmed } : {}) });
  }
}
