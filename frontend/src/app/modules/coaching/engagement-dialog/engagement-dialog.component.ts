import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../../core/api.service';

interface Coachee { _id: string; firstName: string; lastName: string; email: string; department?: string; }

@Component({
  selector: 'app-engagement-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatDatepickerModule, MatNativeDateModule, MatChipsModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>psychology_alt</mat-icon>
      {{ isEdit ? 'Edit Engagement' : 'New Coaching Engagement' }}
    </h2>
    <mat-dialog-content>
      @if (!isEdit) {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Coachee</mat-label>
          <mat-select [(ngModel)]="form.coacheeId" required>
            @for (c of coachees(); track c._id) {
              <mat-option [value]="c._id">{{ c.firstName }} {{ c.lastName }} ({{ c.email }})</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Status</mat-label>
        <mat-select [(ngModel)]="form.status">
          <mat-option value="prospect">Prospect</mat-option>
          <mat-option value="contracted">Contracted</mat-option>
          <mat-option value="active">Active</mat-option>
          <mat-option value="paused">Paused</mat-option>
          <mat-option value="completed">Completed</mat-option>
          <mat-option value="alumni">Alumni</mat-option>
        </mat-select>
      </mat-form-field>

      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>Sessions Purchased</mat-label>
          <input matInput type="number" [(ngModel)]="form.sessionsPurchased" min="0" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Cadence</mat-label>
          <mat-select [(ngModel)]="form.cadence">
            <mat-option value="weekly">Weekly</mat-option>
            <mat-option value="biweekly">Biweekly</mat-option>
            <mat-option value="monthly">Monthly</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>Format</mat-label>
          <mat-select [(ngModel)]="form.sessionFormat">
            <mat-option value="video">Video</mat-option>
            <mat-option value="phone">Phone</mat-option>
            <mat-option value="in_person">In Person</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Start Date</mat-label>
          <input matInput [matDatepicker]="startPicker" [(ngModel)]="form.startDate" />
          <mat-datepicker-toggle matIconSuffix [for]="startPicker" /><mat-datepicker #startPicker />
        </mat-form-field>
      </div>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Goals (comma separated)</mat-label>
        <input matInput [(ngModel)]="goalsRaw" placeholder="e.g. Leadership development, Communication skills" />
      </mat-form-field>

      <div class="section-label">Sponsor (optional)</div>
      <div class="form-row">
        <mat-form-field appearance="outline"><mat-label>Sponsor Name</mat-label>
          <input matInput [(ngModel)]="form.sponsorName" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Sponsor Email</mat-label>
          <input matInput [(ngModel)]="form.sponsorEmail" type="email" /></mat-form-field>
      </div>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Notes (private)</mat-label>
        <textarea matInput [(ngModel)]="form.notes" rows="3" placeholder="Coach-only notes about this engagement"></textarea>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="saving()">
        @if (saving()) { <mat-spinner diameter="18" /> }
        @else { <mat-icon>{{ isEdit ? 'save' : 'add' }}</mat-icon> }
        {{ isEdit ? 'Save' : 'Create' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] { display: flex; align-items: center; gap: 8px; color: #1B2A47; mat-icon { color: #3A9FD6; } }
    mat-dialog-content { min-width: 480px; padding-top: 8px !important; }
    .full-width { width: 100%; }
    .form-row { display: flex; gap: 12px; mat-form-field { flex: 1; } }
    .section-label { font-size: 12px; font-weight: 600; color: #5a6a7e; text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 4px; }
  `],
})
export class EngagementDialogComponent implements OnInit {
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<EngagementDialogComponent>);
  data = inject<any>(MAT_DIALOG_DATA, { optional: true });

  coachees = signal<Coachee[]>([]);
  saving = signal(false);
  isEdit = false;
  goalsRaw = '';

  form = {
    coacheeId: '', status: 'prospect', sessionsPurchased: 6, sessionsUsed: 0,
    cadence: 'biweekly', sessionFormat: 'video', startDate: null as Date | null,
    sponsorName: '', sponsorEmail: '', sponsorOrg: '', notes: '', goals: [] as string[],
  };

  ngOnInit(): void {
    if (this.data?._id) {
      this.isEdit = true;
      Object.assign(this.form, this.data);
      this.form.coacheeId = typeof this.data.coacheeId === 'object' ? this.data.coacheeId._id : this.data.coacheeId;
      this.goalsRaw = (this.data.goals || []).join(', ');
    }
    this.api.get<Coachee[]>('/users').subscribe({ next: (u) => this.coachees.set(u) });
  }

  save(): void {
    this.saving.set(true);
    this.form.goals = this.goalsRaw.split(',').map((g: string) => g.trim()).filter(Boolean);
    const req = this.isEdit
      ? this.api.put(`/coaching/engagements/${this.data._id}`, this.form)
      : this.api.post('/coaching/engagements', this.form);
    req.subscribe({
      next: (r) => { this.saving.set(false); this.dialogRef.close(r); },
      error: () => { this.saving.set(false); },
    });
  }
}
