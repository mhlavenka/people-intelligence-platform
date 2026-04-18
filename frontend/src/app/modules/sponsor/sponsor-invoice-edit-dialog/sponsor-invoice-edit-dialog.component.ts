import { Component, Inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { SponsorInvoice, SponsorService } from '../sponsor.service';
import { TranslateModule } from '@ngx-translate/core';

interface LineItemForm { description: string; quantity: number; unitPriceDollars: number; }

export interface SponsorInvoiceEditData {
  sponsorId: string;
  invoiceId: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
  dueDate: string;
  notes?: string;
  taxRatePercent: number;  // initial value as percentage
  currency: string;
}

@Component({
  selector: 'app-sponsor-invoice-edit-dialog',
  standalone: true,
  imports: [
    CommonModule, CurrencyPipe, FormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ "SPONSOR.editInvoice" | translate }}</h2>
    <mat-dialog-content>
      <div class="line-items">
        <div class="line-head">
          <span class="col desc">Description</span>
          <span class="col qty">Qty</span>
          <span class="col price">Unit price</span>
          <span class="col amt">Amount</span>
          <span class="col act"></span>
        </div>
        @for (li of items; track li; let i = $index) {
          <div class="line-row">
            <input class="col desc" [(ngModel)]="li.description" placeholder="Description" />
            <input class="col qty" type="number" min="0" step="1" [(ngModel)]="li.quantity" (input)="recalc()" />
            <input class="col price" type="number" min="0" step="0.01" [(ngModel)]="li.unitPriceDollars" (input)="recalc()" />
            <span class="col amt">{{ amountOf(li) | currency:data.currency }}</span>
            <button mat-icon-button class="col act" (click)="removeRow(i)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }
        <button mat-button class="add-row" (click)="addRow()">
          <mat-icon>add</mat-icon> {{ "SPONSOR.addLineItem" | translate }}
        </button>
      </div>

      <div class="meta-row">
        <mat-form-field appearance="outline">
          <mat-label>Tax rate (override, %)</mat-label>
          <input matInput type="number" min="0" step="0.001" [(ngModel)]="taxPercent" (input)="recalc()" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Due date</mat-label>
          <input matInput [matDatepicker]="picker" [(ngModel)]="dueDate" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
        </mat-form-field>
      </div>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Notes</mat-label>
        <textarea matInput rows="2" [(ngModel)]="notes"></textarea>
      </mat-form-field>

      <div class="totals">
        <div><span>Subtotal</span><span>{{ subtotal() | currency:data.currency }}</span></div>
        <div><span>Tax ({{ taxPercent || 0 }}%)</span><span>{{ tax() | currency:data.currency }}</span></div>
        <div class="grand"><span>Total</span><span>{{ total() | currency:data.currency }}</span></div>
      </div>

      @if (errorMsg()) {
        <p class="error"><mat-icon>error_outline</mat-icon> {{ errorMsg() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()" [disabled]="saving()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving()">
        @if (saving()) { <mat-spinner diameter="18" /> }
        Save changes
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: 640px; padding-top: 4px !important; }
    .line-items {
      border: 1px solid #eef2f7; border-radius: 8px; margin-bottom: 16px;
    }
    .line-head, .line-row {
      display: grid; grid-template-columns: 1fr 70px 110px 110px 40px;
      gap: 8px; padding: 8px 12px; align-items: center;
    }
    .line-head {
      background: #f7f9fc; color: #6b7c93; font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
      border-bottom: 1px solid #eef2f7;
    }
    .line-row + .line-row { border-top: 1px solid #f5f7fa; }
    .line-row input {
      border: 1px solid #d6dde5; border-radius: 6px; padding: 6px 8px;
      font-size: 13px; min-width: 0;
      &:focus { outline: 2px solid #3A9FD6; outline-offset: -1px; border-color: var(--artes-accent); }
    }
    .col.qty, .col.price { text-align: right; }
    .col.amt { text-align: right; font-weight: 600; }
    .add-row { width: 100%; padding: 8px; color: var(--artes-accent); }
    .meta-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .meta-row mat-form-field { width: 100%; }
    .full { width: 100%; }
    .totals {
      background: #f7f9fc; border-radius: 8px; padding: 12px 16px; margin-top: 8px;
      font-size: 14px;
      div { display: flex; justify-content: space-between; padding: 4px 0; }
      .grand { font-size: 16px; font-weight: 700; color: var(--artes-primary);
        border-top: 1px solid #d6dde5; margin-top: 6px; padding-top: 8px; }
    }
    .error {
      display: flex; align-items: center; gap: 6px;
      color: #dc2626; font-size: 13px; margin: 8px 0 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    mat-spinner { display: inline-block; margin-right: 6px; }
  `],
})
export class SponsorInvoiceEditDialogComponent implements OnInit {
  saving = signal(false);
  errorMsg = signal('');

  items: LineItemForm[] = [];
  taxPercent = 0;
  dueDate: Date = new Date();
  notes = '';

  subtotal = computed(() => 0); // placeholders, see recalc()
  tax = computed(() => 0);
  total = computed(() => 0);

  // simple non-signal cache for repeated access
  private _subtotalDollars = 0;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SponsorInvoiceEditData,
    private dialogRef: MatDialogRef<SponsorInvoiceEditDialogComponent, SponsorInvoice | null>,
    private sponsorSvc: SponsorService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.items = this.data.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPriceDollars: li.unitPrice / 100,
    }));
    this.taxPercent = +(this.data.taxRatePercent || 0).toFixed(4);
    this.dueDate = new Date(this.data.dueDate);
    this.notes = this.data.notes || '';
    this.recalc();
  }

  amountOf(li: LineItemForm): number { return (li.quantity || 0) * (li.unitPriceDollars || 0); }

  recalc(): void {
    this._subtotalDollars = this.items.reduce((s, li) => s + this.amountOf(li), 0);
    const sub = this._subtotalDollars;
    const t = +(sub * (this.taxPercent / 100)).toFixed(2);
    this.subtotal = computed(() => sub);
    this.tax = computed(() => t);
    this.total = computed(() => sub + t);
  }

  addRow(): void {
    this.items.push({ description: '', quantity: 1, unitPriceDollars: 0 });
    this.recalc();
  }
  removeRow(i: number): void { this.items.splice(i, 1); this.recalc(); }
  cancel(): void { this.dialogRef.close(null); }

  save(): void {
    if (!this.items.length) {
      this.errorMsg.set('At least one line item is required.');
      return;
    }
    this.saving.set(true);
    this.errorMsg.set('');
    const payload = {
      lineItems: this.items.map((li) => {
        const unitPrice = Math.round(li.unitPriceDollars * 100);
        const amount = unitPrice * (li.quantity || 0);
        return { description: li.description, quantity: li.quantity || 0, unitPrice, amount };
      }),
      dueDate: this.dueDate.toISOString(),
      notes: this.notes,
      taxRate: this.taxPercent,
    };
    this.sponsorSvc.updateInvoice(this.data.sponsorId, this.data.invoiceId, payload).subscribe({
      next: (inv) => {
        this.saving.set(false);
        this.snack.open('Invoice updated', 'OK', { duration: 2500 });
        this.dialogRef.close(inv);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMsg.set(err?.error?.error || 'Failed to update invoice');
      },
    });
  }
}
