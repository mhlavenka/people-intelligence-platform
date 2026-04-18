import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { TranslateModule } from '@ngx-translate/core';
export interface BookSessionData {
  coachName: string;
  engagementId: string;
}

@Component({
  selector: 'app-book-session-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>calendar_month</mat-icon>
      {{ 'COACHING.bookASession' | translate }}
    </h2>
    <mat-dialog-content>
      @if (!submitted()) {
        <p class="subtitle">{{ 'COACHING.scheduleWithCoach' | translate }} <strong>{{ data.coachName }}</strong></p>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'COACHING.preferredDate' | translate }}</mat-label>
          <input matInput [matDatepicker]="picker" [(ngModel)]="preferredDate" [min]="minDate">
          <mat-datepicker-toggle matSuffix [for]="picker" />
          <mat-datepicker #picker />
        </mat-form-field>

        <div class="time-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.preferredTime' | translate }}</mat-label>
            <mat-select [(ngModel)]="preferredTime">
              @for (t of timeSlots; track t) {
                <mat-option [value]="t">{{ t }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.formatLabel' | translate }}</mat-label>
            <mat-select [(ngModel)]="format">
              <mat-option value="video">{{ 'COACHING.video' | translate }}</mat-option>
              <mat-option value="phone">{{ 'COACHING.phone' | translate }}</mat-option>
              <mat-option value="in_person">{{ 'COACHING.inPerson' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'COACHING.notesOptional' | translate }}</mat-label>
          <textarea matInput [(ngModel)]="notes" rows="3" placeholder="Anything you'd like to discuss or prepare for..."></textarea>
        </mat-form-field>
      } @else {
        <div class="confirmation">
          <mat-icon class="confirm-icon">check_circle</mat-icon>
          <h3>{{ 'COACHING.requestSent' | translate }}</h3>
          <p>Your booking request has been sent to <strong>{{ data.coachName }}</strong>. You'll receive a confirmation once the session is scheduled.</p>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (!submitted()) {
        <button mat-button mat-dialog-close>{{ 'COMMON.cancel' | translate }}</button>
        <button mat-raised-button color="primary" [disabled]="!preferredDate || !preferredTime" (click)="submit()">
          <mat-icon>send</mat-icon> {{ 'COACHING.sendRequest' | translate }}
        </button>
      } @else {
        <button mat-raised-button color="primary" mat-dialog-close>{{ 'BOOKING.done' | translate }}</button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex; align-items: center; gap: 8px;
      mat-icon { color: var(--artes-accent); }
    }
    .subtitle { font-size: 14px; color: #5a6a7e; margin: 0 0 16px; }
    .full-width { width: 100%; }
    .time-row { display: flex; gap: 12px; }
    .time-row mat-form-field { flex: 1; }
    .confirmation {
      text-align: center; padding: 24px 0;
      h3 { font-size: 18px; color: var(--artes-primary); margin: 12px 0 8px; }
      p { font-size: 14px; color: #5a6a7e; max-width: 320px; margin: 0 auto; }
    }
    .confirm-icon { font-size: 56px; width: 56px; height: 56px; color: #27C4A0; }
  `],
})
export class BookSessionDialogComponent {
  preferredDate: Date | null = null;
  preferredTime = '';
  format = 'video';
  notes = '';
  submitted = signal(false);
  minDate = new Date();

  timeSlots = [
    '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
    '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
    '5:00 PM', '5:30 PM', '6:00 PM',
  ];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: BookSessionData,
    private dialogRef: MatDialogRef<BookSessionDialogComponent>,
  ) {}

  submit(): void {
    // TODO: Integrate with Google Calendar Booking API
    // For now, just show the confirmation state
    this.submitted.set(true);
  }
}
