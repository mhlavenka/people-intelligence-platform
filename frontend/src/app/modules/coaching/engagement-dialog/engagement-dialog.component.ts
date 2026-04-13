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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../../core/api.service';
import { OrgContextService } from '../../../core/org-context.service';
import { Sponsor, SponsorService } from '../../sponsor/sponsor.service';
import { SponsorDialogComponent } from '../../sponsor/sponsor-dialog/sponsor-dialog.component';

interface Coachee { _id: string; firstName: string; lastName: string; email: string; department?: string; }

@Component({
  selector: 'app-engagement-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatDatepickerModule, MatNativeDateModule, MatChipsModule, MatSlideToggleModule,
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

      <div class="section-label">Billing</div>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>How is this engagement paid?</mat-label>
        <mat-select [(ngModel)]="form.billingMode" (selectionChange)="onBillingModeChange()">
          <mat-option value="subscription">Covered by subscription plan</mat-option>
          <mat-option value="sponsor">Sponsor pays per engagement</mat-option>
        </mat-select>
      </mat-form-field>

      @if (form.billingMode === 'sponsor') {
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Sponsor</mat-label>
            <mat-select [(ngModel)]="form.sponsorId" required>
              @for (s of sponsors(); track s._id) {
                <mat-option [value]="s._id">
                  {{ s.name }} <span class="muted">— {{ s.email }}</span>
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-stroked-button class="new-sponsor-btn" (click)="createSponsor()">
            <mat-icon>add</mat-icon> New
          </button>
        </div>
        <mat-form-field appearance="outline" class="rate-field">
          <mat-label>Hourly rate (override)</mat-label>
          <input matInput type="number" [(ngModel)]="form.hourlyRate" min="0" step="0.01" />
          <mat-icon matPrefix>attach_money</mat-icon>
          <mat-hint>Leave blank to use the sponsor's default rate</mat-hint>
        </mat-form-field>
      }

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
    .form-row { display: flex; gap: 12px; align-items: flex-start;
      mat-form-field { flex: 1; }
      .new-sponsor-btn { margin-top: 6px; height: 56px; white-space: nowrap; }
    }
    .section-label { font-size: 12px; font-weight: 600; color: #5a6a7e; text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 4px; }
    .rate-field { width: 100%; }
    .muted { color: #9aa5b4; font-size: 12px; }
  `],
})
export class EngagementDialogComponent implements OnInit {
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<EngagementDialogComponent>);
  private orgCtx = inject(OrgContextService);
  private sponsorSvc = inject(SponsorService);
  private dialog = inject(MatDialog);
  data = inject<any>(MAT_DIALOG_DATA, { optional: true });

  coachees = signal<Coachee[]>([]);
  sponsors = signal<Sponsor[]>([]);
  saving = signal(false);
  isEdit = false;
  goalsRaw = '';

  form = {
    coacheeId: '', status: 'prospect', sessionsPurchased: 6, sessionsUsed: 0,
    cadence: 'biweekly', sessionFormat: 'video', startDate: null as Date | null,
    notes: '', goals: [] as string[],
    billingMode: 'subscription' as 'subscription' | 'sponsor',
    sponsorId: '' as string,
    hourlyRate: null as number | null,
  };

  ngOnInit(): void {
    if (this.orgCtx.defaultCoachRate?.()) {
      this.form.hourlyRate = this.orgCtx.defaultCoachRate() ?? null;
    }

    if (this.data?._id) {
      this.isEdit = true;
      Object.assign(this.form, this.data);
      this.form.coacheeId = typeof this.data.coacheeId === 'object' ? this.data.coacheeId._id : this.data.coacheeId;
      // Normalize sponsorId in case it was returned populated
      this.form.sponsorId = typeof this.data.sponsorId === 'object' && this.data.sponsorId
        ? this.data.sponsorId._id
        : (this.data.sponsorId || '');
      this.form.billingMode = this.data.billingMode || (this.form.sponsorId ? 'sponsor' : 'subscription');
      this.goalsRaw = (this.data.goals || []).join(', ');
    }
    this.api.get<Coachee[]>('/users').subscribe({ next: (u) => this.coachees.set(u) });
    this.sponsorSvc.list().subscribe({ next: (s) => this.sponsors.set(s) });
  }

  onBillingModeChange(): void {
    if (this.form.billingMode === 'subscription') {
      this.form.sponsorId = '';
      this.form.hourlyRate = null;
    }
  }

  createSponsor(): void {
    const ref = this.dialog.open(SponsorDialogComponent, { data: {}, width: '560px' });
    ref.afterClosed().subscribe((sponsor: Sponsor | null) => {
      if (!sponsor) return;
      this.sponsors.update((list) => [sponsor, ...list]);
      this.form.sponsorId = sponsor._id;
    });
  }

  save(): void {
    if (this.form.billingMode === 'sponsor' && !this.form.sponsorId) {
      // Avoid silent failure — let UI know required field is missing.
      return;
    }
    this.saving.set(true);
    this.form.goals = this.goalsRaw.split(',').map((g: string) => g.trim()).filter(Boolean);

    // Strip sponsorId when subscription mode so the backend stores null.
    const payload: Record<string, unknown> = { ...this.form };
    if (this.form.billingMode === 'subscription') {
      payload['sponsorId'] = null;
      payload['hourlyRate'] = null;
    }

    const req = this.isEdit
      ? this.api.put(`/coaching/engagements/${this.data._id}`, payload)
      : this.api.post('/coaching/engagements', payload);
    req.subscribe({
      next: (r) => { this.saving.set(false); this.dialogRef.close(r); },
      error: () => { this.saving.set(false); },
    });
  }
}
