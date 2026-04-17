import { Component, Inject, OnInit, signal, computed } from '@angular/core';
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
import { AvailableSlot, BookingRecord, BookingService } from '../booking.service';

export interface RescheduleDialogData {
  booking: BookingRecord;
  /** When true, show a "Message to coach" textarea; the submitted note
   *  is returned alongside the new start time. */
  withNote?: boolean;
  noteLabel?: string;
  notePlaceholder?: string;
}

export interface RescheduleDialogResult {
  newStartTime: string;
  note?: string;
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
          <input matInput [matDatepicker]="picker" [ngModel]="newDate"
                 (ngModelChange)="onDateChange($event)"
                 [min]="minDate" required />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
        </mat-form-field>
      </div>

      <div class="slots-section">
        <div class="slots-label">
          <mat-icon>schedule</mat-icon> Available times
        </div>
        @if (slotsLoading()) {
          <div class="slots-loading"><mat-spinner diameter="22" /></div>
        } @else if (!slotsForDay().length) {
          <p class="no-slots">No available times on this day. Try another date.</p>
        } @else {
          <div class="slot-grid">
            @for (slot of slotsForDay(); track slot.startUtc) {
              <button type="button" class="slot-btn"
                      [class.selected]="selectedSlot()?.startUtc === slot.startUtc"
                      (click)="pickSlot(slot)">
                {{ slot.startLocal | date:'shortTime' }}
              </button>
            }
          </div>
        }
      </div>

      @if (data.withNote) {
        <mat-form-field appearance="outline" class="note-field">
          <mat-label>{{ data.noteLabel || 'Message to coach (optional)' }}</mat-label>
          <textarea matInput rows="3"
                    [(ngModel)]="note"
                    [placeholder]="data.notePlaceholder || 'Let the coach know why you\\'re rescheduling…'">
          </textarea>
        </mat-form-field>
      }

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
    .pickers { display: block; }
    .date-field { width: 100%; }
    .note-field { width: 100%; margin-top: 12px; display: block; }

    .slots-section { margin: 4px 0 12px; }
    .slots-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 600; color: #5a6a7e;
      text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 8px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--artes-accent); }
    }
    .slots-loading { display: flex; justify-content: center; padding: 20px; }
    .no-slots {
      color: #9aa5b4; font-size: 13px; margin: 0; text-align: center;
      padding: 16px; background: #f8fafc; border-radius: 8px;
    }
    .slot-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
      gap: 6px; max-height: 180px; overflow-y: auto;
    }
    .slot-btn {
      padding: 8px 10px; border-radius: 6px; font-size: 13px; font-weight: 500;
      background: #fff; border: 1px solid #dbe3ec; color: var(--artes-primary);
      cursor: pointer; transition: all 0.12s;
      font: inherit; font-size: 13px; font-weight: 500;
    }
    .slot-btn:hover { border-color: var(--artes-accent); color: var(--artes-accent); }
    .slot-btn.selected {
      background: var(--artes-accent); color: #fff; border-color: var(--artes-accent);
    }
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
export class RescheduleDialogComponent implements OnInit {
  minDate = new Date();
  newDate: Date;
  note = '';
  saving = signal(false);
  errorMsg = signal('');
  slotsLoading = signal(false);
  allSlots = signal<AvailableSlot[]>([]);
  selectedSlot = signal<AvailableSlot | null>(null);
  private clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  slotsForDay = computed(() => {
    const target = this.toDateKey(this.newDate);
    return this.allSlots().filter((s) => this.toDateKey(new Date(s.startLocal)) === target);
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: RescheduleDialogData,
    private dialogRef: MatDialogRef<RescheduleDialogComponent, RescheduleDialogResult | null>,
    private bookingSvc: BookingService,
  ) {
    const d = new Date(data.booking.startTime);
    this.newDate = d;
  }

  ngOnInit(): void {
    this.loadSlotsForRange(this.newDate);
  }

  isValid(): boolean {
    return !!this.selectedSlot();
  }

  onDateChange(d: Date): void {
    this.newDate = d;
    this.selectedSlot.set(null);
    this.loadSlotsForRange(d);
  }

  pickSlot(slot: AvailableSlot): void {
    this.selectedSlot.set(slot);
  }

  /** Load a week window around the selected date so close-by days are
   *  already populated if the coachee changes dates. */
  private loadSlotsForRange(around: Date): void {
    const from = new Date(around); from.setDate(from.getDate() - 1);
    const to   = new Date(around); to.setDate(to.getDate() + 14);
    this.slotsLoading.set(true);
    this.bookingSvc.getBookingSlots(
      this.data.booking._id,
      from.toISOString().slice(0, 10),
      to.toISOString().slice(0, 10),
      this.clientTimezone,
    ).subscribe({
      next: (slots) => { this.allSlots.set(slots); this.slotsLoading.set(false); },
      error: (err) => {
        this.slotsLoading.set(false);
        this.errorMsg.set(err?.error?.error || 'Could not load availability.');
      },
    });
  }

  private toDateKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  cancel(): void { this.dialogRef.close(null); }

  save(): void {
    const slot = this.selectedSlot();
    if (!slot) {
      this.errorMsg.set('Please pick a time slot.');
      return;
    }
    this.errorMsg.set('');
    const trimmed = this.note.trim();
    this.dialogRef.close({
      newStartTime: slot.startUtc,
      ...(trimmed ? { note: trimmed } : {}),
    });
  }
}
