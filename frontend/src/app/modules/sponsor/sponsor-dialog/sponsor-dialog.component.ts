import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { ProvinceTaxInfo, Sponsor, SponsorService } from '../sponsor.service';

export interface SponsorDialogData {
  sponsor?: Sponsor;
}

@Component({
  selector: 'app-sponsor-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSlideToggleModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.sponsor ? 'Edit sponsor' : 'New sponsor' }}</h2>
    <mat-dialog-content>
      <div class="row">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Name *</mat-label>
          <input matInput [(ngModel)]="form.name" required />
        </mat-form-field>
      </div>

      <div class="row two">
        <mat-form-field appearance="outline">
          <mat-label>Email *</mat-label>
          <input matInput type="email" [(ngModel)]="form.email" required />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Phone</mat-label>
          <input matInput [(ngModel)]="form.phone" />
        </mat-form-field>
      </div>

      <div class="row">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Organization (company)</mat-label>
          <input matInput [(ngModel)]="form.organization" />
        </mat-form-field>
      </div>

      <div class="section-label">Billing address</div>
      <div class="row">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Address line 1</mat-label>
          <input matInput [(ngModel)]="form.billingAddress.line1" />
        </mat-form-field>
      </div>
      <div class="row">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Address line 2</mat-label>
          <input matInput [(ngModel)]="form.billingAddress.line2" />
        </mat-form-field>
      </div>
      <div class="row two">
        <mat-form-field appearance="outline">
          <mat-label>City</mat-label>
          <input matInput [(ngModel)]="form.billingAddress.city" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Postal code</mat-label>
          <input matInput [(ngModel)]="form.billingAddress.postalCode" />
        </mat-form-field>
      </div>
      <div class="row two">
        <mat-form-field appearance="outline">
          <mat-label>Country</mat-label>
          <mat-select [(ngModel)]="form.billingAddress.country">
            <mat-option value="CA">Canada</mat-option>
            <mat-option value="US">United States</mat-option>
            <mat-option value="GB">United Kingdom</mat-option>
            <mat-option value="">Other</mat-option>
          </mat-select>
        </mat-form-field>
        @if (form.billingAddress.country === 'CA') {
          <mat-form-field appearance="outline">
            <mat-label>Province</mat-label>
            <mat-select [(ngModel)]="form.billingAddress.state">
              @for (p of provinces(); track p.code) {
                <mat-option [value]="p.code">{{ p.name }} ({{ p.label }})</mat-option>
              }
            </mat-select>
          </mat-form-field>
        } @else {
          <mat-form-field appearance="outline">
            <mat-label>State / region</mat-label>
            <input matInput [(ngModel)]="form.billingAddress.state" />
          </mat-form-field>
        }
      </div>

      <div class="section-label">Tax</div>
      <div class="row two">
        <mat-form-field appearance="outline">
          <mat-label>Tax ID (GST/HST/VAT)</mat-label>
          <input matInput [(ngModel)]="form.taxId" />
        </mat-form-field>
        <div class="exempt-toggle">
          <mat-slide-toggle [(ngModel)]="form.taxExempt">Tax-exempt</mat-slide-toggle>
          <span class="exempt-hint">Skips tax calculation entirely</span>
        </div>
      </div>

      <div class="section-label">Defaults</div>
      <div class="row">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Default hourly rate</mat-label>
          <input matInput type="number" min="0" step="0.01" [(ngModel)]="form.defaultHourlyRate" />
          <span matTextSuffix>per hour</span>
        </mat-form-field>
      </div>

      <div class="row">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Notes</mat-label>
          <textarea matInput rows="2" [(ngModel)]="form.notes"></textarea>
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
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .row { margin-bottom: 4px; }
    .row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .full { width: 100%; }
    .row.two mat-form-field { width: 100%; }
    .section-label {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px;
      color: #6b7c93; font-weight: 600; margin: 14px 0 6px;
    }
    .exempt-toggle {
      display: flex; flex-direction: column; gap: 4px; padding: 8px 0;
      .exempt-hint { font-size: 11px; color: #9aa5b4; }
    }
    .error {
      display: flex; align-items: center; gap: 6px;
      color: #dc2626; font-size: 13px; margin: 4px 0 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    mat-spinner { display: inline-block; margin-right: 6px; }
  `],
})
export class SponsorDialogComponent implements OnInit {
  saving = signal(false);
  errorMsg = signal('');
  provinces = signal<ProvinceTaxInfo[]>([]);

  form: {
    name: string; email: string; organization?: string; phone?: string;
    billingAddress: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string };
    taxId?: string; taxExempt?: boolean;
    defaultHourlyRate?: number; notes?: string;
  } = {
    name: '', email: '', organization: '', phone: '',
    billingAddress: { country: 'CA' },
    taxId: '', taxExempt: false,
    defaultHourlyRate: undefined, notes: '',
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SponsorDialogData,
    private dialogRef: MatDialogRef<SponsorDialogComponent, Sponsor | null>,
    private sponsorSvc: SponsorService,
    private snack: MatSnackBar,
  ) {
    if (data.sponsor) {
      this.form = {
        name: data.sponsor.name,
        email: data.sponsor.email,
        organization: data.sponsor.organization,
        phone: data.sponsor.phone,
        billingAddress: data.sponsor.billingAddress
          ? { ...data.sponsor.billingAddress }
          : { country: 'CA' },
        taxId: data.sponsor.taxId,
        taxExempt: !!data.sponsor.taxExempt,
        defaultHourlyRate: data.sponsor.defaultHourlyRate,
        notes: data.sponsor.notes,
      };
    }
  }

  ngOnInit(): void {
    this.sponsorSvc.taxRates().subscribe({
      next: (r) => this.provinces.set(r.provinces),
      error: () => {},
    });
  }

  isValid(): boolean {
    return !!(this.form.name?.trim() && this.form.email?.trim());
  }

  cancel(): void { this.dialogRef.close(null); }

  save(): void {
    if (!this.isValid()) return;
    this.saving.set(true);
    this.errorMsg.set('');
    const op = this.data.sponsor
      ? this.sponsorSvc.update(this.data.sponsor._id, this.form)
      : this.sponsorSvc.create(this.form);
    op.subscribe({
      next: (sponsor) => {
        this.saving.set(false);
        this.snack.open(this.data.sponsor ? 'Sponsor updated' : 'Sponsor created', 'OK', { duration: 2500 });
        this.dialogRef.close(sponsor);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMsg.set(err?.error?.error || 'Failed to save sponsor');
      },
    });
  }
}
