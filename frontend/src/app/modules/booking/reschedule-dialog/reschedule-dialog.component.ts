import { Component, Inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BookingRecord } from '../booking.service';

export interface RescheduleDialogData {
  booking: BookingRecord;
}

@Component({
  selector: 'app-reschedule-dialog',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Reschedule booking</h2>
    <mat-dialog-content>
      <p class="intro">
        Current session: <strong>{{ data.booking.clientName }}</strong> on
        {{ data.booking.startTime | date:'EEEE, MMM d, y' }} at
        {{ data.booking.startTime | date:'shortTime' }}.
      </p>

      <div class="pickers">
        <mat-form-field appearance="outline" class="date-field">
          <mat-label>New date</mat-label>
          <input matInput [matDatepicker]="picker" [(ngModel)]="newDate"
                 [min]="minDate" required />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
        </mat-form-field>

        <mat-form-field appearance="outline" class="time-field">
          <mat-label>New time</mat-label>
          <input matInput type="time" [(ngModel)]="newTime" required />
        </mat-form-field>
      </div>

      @if (errorMsg()) {
        <p class="error"><mat-icon>error_outline</mat-icon> {{ errorMsg() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()" [disabled]="saving()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving() || !isValid()">
        @if (saving()) { <mat-spinner diameter="18" /> }
        Reschedule
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .intro { margin: 0 0 16px; color: #46546b; line-height: 1.5; }
    .pickers {
      display: grid; grid-template-columns: 1fr 140px; gap: 12px;
    }
    .date-field { width: 100%; }
    .time-field { width: 100%; }
    .error {
      display: flex; align-items: center; gap: 6px;
      color: #dc2626; font-size: 13px; margin: 8px 0 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    mat-spinner { display: inline-block; margin-right: 6px; }
    @media (max-width: 500px) {
      .pickers { grid-template-columns: 1fr; }
    }
  `],
})
export class RescheduleDialogComponent {
  minDate = new Date();
  newDate: Date;
  newTime: string;
  saving = signal(false);
  errorMsg = signal('');

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: RescheduleDialogData,
    private dialogRef: MatDialogRef<RescheduleDialogComponent, string | null>,
  ) {
    const d = new Date(data.booking.startTime);
    this.newDate = d;
    this.newTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  isValid(): boolean {
    return !!(this.newDate && this.newTime && this.composeStart() > new Date());
  }

  composeStart(): Date {
    const [h, m] = (this.newTime || '00:00').split(':').map(Number);
    const d = new Date(this.newDate);
    d.setHours(h, m, 0, 0);
    return d;
  }

  cancel(): void { this.dialogRef.close(null); }

  save(): void {
    const start = this.composeStart();
    if (start <= new Date()) {
      this.errorMsg.set('New time must be in the future.');
      return;
    }
    this.errorMsg.set('');
    this.dialogRef.close(start.toISOString());
  }
}
