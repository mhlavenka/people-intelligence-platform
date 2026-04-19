import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Sponsor, SponsorInvoice, SponsorService } from '../sponsor.service';
import { TranslateModule } from '@ngx-translate/core';

interface FullInvoice extends SponsorInvoice {
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
  period: { from: string; to: string };
  taxRate: number;
  tax: number;
  taxBreakdown?: { gst: number; hst: number; pst: number; qst: number };
  taxId?: string;
  billingAddress?: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string };
  notes?: string;
}

@Component({
  selector: 'app-sponsor-invoice-view',
  standalone: true,
  imports: [
    CommonModule, CurrencyPipe, DatePipe, RouterLink,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
    TranslateModule,
  ],
  template: `
    <div class="screen-toolbar no-print">
      <a mat-icon-button [routerLink]="['/billing/sponsors', sponsorId]"
         [matTooltip]="'SPONSOR.backToBilling' | translate">
        <mat-icon>arrow_back</mat-icon>
      </a>
      <span class="spacer"></span>
      <button mat-stroked-button (click)="print()">
        <mat-icon>print</mat-icon> {{ "COMMON.print" | translate }}
      </button>
    </div>

    @if (loading()) {
      <div class="loading no-print"><mat-spinner diameter="36" /></div>
    } @else if (invoice() && sponsor()) {
      <div class="invoice-page">
        <header class="head">
          <div class="brand">
            <h1>{{ "SPONSOR.invoice" | translate }}</h1>
            <span class="inv-no">{{ invoice()!.invoiceNumber }}</span>
          </div>
          <div class="status-block">
            <span class="inv-status" [class]="'is-' + invoice()!.status">
              {{ invoice()!.status }}
            </span>
          </div>
        </header>

        <section class="meta-grid">
          <div class="meta-block">
            <div class="meta-label">{{ "SPONSOR.billTo" | translate }}</div>
            <strong>{{ sponsor()!.name }}</strong>
            <div>{{ sponsor()!.email }}</div>
            @if (sponsor()!.organization) { <div>{{ sponsor()!.organization }}</div> }
            @if (invoice()!.billingAddress; as a) {
              @if (a.line1) { <div>{{ a.line1 }}</div> }
              @if (a.line2) { <div>{{ a.line2 }}</div> }
              @if (a.city || a.state || a.postalCode) {
                <div>{{ a.city }}{{ a.city && (a.state || a.postalCode) ? ', ' : '' }}{{ a.state }} {{ a.postalCode }}</div>
              }
              @if (a.country) { <div>{{ a.country }}</div> }
            }
            @if (invoice()!.taxId) {
              <div class="muted">Tax ID: {{ invoice()!.taxId }}</div>
            }
          </div>
          <div class="meta-block right">
            <div><span class="meta-label">{{ "SPONSOR.issuedDate" | translate }}</span> {{ invoice()!.createdAt | date:'mediumDate' }}</div>
            <div><span class="meta-label">{{ "SPONSOR.dueDate" | translate }}</span> {{ invoice()!.dueDate | date:'mediumDate' }}</div>
            <div><span class="meta-label">{{ "SPONSOR.periodLabel" | translate }}</span>
              {{ invoice()!.period.from | date:'mediumDate' }} – {{ invoice()!.period.to | date:'mediumDate' }}
            </div>
          </div>
        </section>

        <table class="lines">
          <thead>
            <tr>
              <th class="desc">{{ "SPONSOR.descriptionCol" | translate }}</th>
              <th class="num">{{ "SPONSOR.qtyCol" | translate }}</th>
              <th class="num">{{ "SPONSOR.unitPriceCol" | translate }}</th>
              <th class="num">{{ "SPONSOR.amountCol" | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (li of invoice()!.lineItems; track $index) {
              <tr>
                <td class="desc">{{ li.description }}</td>
                <td class="num">{{ li.quantity }}</td>
                <td class="num">{{ (li.unitPrice / 100) | currency:invoice()!.currency }}</td>
                <td class="num">{{ (li.amount / 100) | currency:invoice()!.currency }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="totals-label">{{ "SPONSOR.subtotal" | translate }}</td>
              <td class="num">{{ (invoice()!.subtotal / 100) | currency:invoice()!.currency }}</td>
            </tr>
            @if (invoice()!.taxBreakdown; as tb) {
              @if (tb.gst > 0) {
                <tr><td colspan="3" class="totals-label">GST</td><td class="num">{{ (tb.gst / 100) | currency:invoice()!.currency }}</td></tr>
              }
              @if (tb.hst > 0) {
                <tr><td colspan="3" class="totals-label">HST</td><td class="num">{{ (tb.hst / 100) | currency:invoice()!.currency }}</td></tr>
              }
              @if (tb.pst > 0) {
                <tr><td colspan="3" class="totals-label">PST</td><td class="num">{{ (tb.pst / 100) | currency:invoice()!.currency }}</td></tr>
              }
              @if (tb.qst > 0) {
                <tr><td colspan="3" class="totals-label">QST</td><td class="num">{{ (tb.qst / 100) | currency:invoice()!.currency }}</td></tr>
              }
            } @else if (invoice()!.tax > 0) {
              <tr>
                <td colspan="3" class="totals-label">Tax ({{ (invoice()!.taxRate * 100) | number:'1.0-2' }}%)</td>
                <td class="num">{{ (invoice()!.tax / 100) | currency:invoice()!.currency }}</td>
              </tr>
            }
            <tr class="grand">
              <td colspan="3" class="totals-label">{{ "SPONSOR.totalDue" | translate }}</td>
              <td class="num">{{ (invoice()!.total / 100) | currency:invoice()!.currency }}</td>
            </tr>
          </tfoot>
        </table>

        @if (invoice()!.notes) {
          <section class="notes">
            <div class="meta-label">Notes</div>
            <p>{{ invoice()!.notes }}</p>
          </section>
        }

        <footer class="foot">
          Generated {{ invoice()!.createdAt | date:'medium' }} · ARTES
        </footer>
      </div>
    }
  `,
  styles: [`
    .screen-toolbar {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 24px; background: #f7f9fc; border-bottom: 1px solid #eef2f7;
    }
    .spacer { flex: 1; }
    .loading { display: flex; justify-content: center; padding: 60px 0; }

    .invoice-page {
      max-width: 800px; margin: 24px auto; padding: 48px 56px;
      background: #fff; color: var(--artes-primary);
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      font-size: 14px; line-height: 1.5;
    }

    .head {
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 3px solid #1B2A47; padding-bottom: 16px; margin-bottom: 24px;
    }
    .brand h1 {
      margin: 0; font-size: 32px; letter-spacing: 4px; color: var(--artes-primary);
    }
    .inv-no { color: #6b7c93; font-size: 14px; letter-spacing: 1px; }
    .inv-status {
      text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;
      font-size: 11px; padding: 4px 12px; border-radius: 999px;
      background: #f0f4f8; color: #6b7c93;
      &.is-draft   { background: #fef6e6; color: #b87e08; }
      &.is-sent    { background: var(--artes-bg); color: var(--artes-accent); }
      &.is-paid    { background: #e8f9f2; color: #0f8a5f; }
      &.is-overdue { background: #fef2f2; color: #dc2626; }
      &.is-void    { background: #f0f4f8; color: #9aa5b4; text-decoration: line-through; }
    }

    .meta-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 32px;
      margin-bottom: 28px;
    }
    .meta-block {
      strong { display: block; margin-top: 4px; font-size: 15px; }
      div { color: #46546b; }
      .muted { color: #9aa5b4; font-size: 12px; margin-top: 4px; }
      &.right { text-align: right;
        div { margin-bottom: 4px; }
      }
    }
    .meta-label {
      display: inline-block; min-width: 90px;
      color: #9aa5b4; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px;
    }
    .meta-block.right .meta-label { text-align: right; margin-right: 6px; }

    .lines {
      width: 100%; border-collapse: collapse; margin-bottom: 24px;
      th, td {
        padding: 10px 12px; border-bottom: 1px solid #eef2f7;
      }
      thead th {
        background: #f7f9fc; text-align: left; font-size: 11px;
        text-transform: uppercase; letter-spacing: 0.6px; color: #6b7c93;
      }
      .num { text-align: right; }
      tfoot td {
        border-bottom: none; font-weight: 600;
      }
      .totals-label { text-align: right; color: #6b7c93; font-weight: 500; }
      .grand td {
        font-size: 17px; font-weight: 700; color: var(--artes-primary);
        border-top: 2px solid var(--artes-primary); padding-top: 14px;
      }
    }

    .notes {
      background: #f7f9fc; border-left: 3px solid var(--artes-accent);
      padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 24px;
      p { margin: 4px 0 0; color: #46546b; }
    }

    .foot {
      text-align: center; color: #9aa5b4; font-size: 11px;
      border-top: 1px solid #eef2f7; padding-top: 12px;
    }

    @media print {
      .no-print { display: none !important; }
      .invoice-page { box-shadow: none; margin: 0; padding: 32px; max-width: none; }
      body { background: #fff; }
    }
  `],
})
export class SponsorInvoiceViewComponent implements OnInit {
  loading = signal(true);
  sponsor = signal<Sponsor | null>(null);
  invoice = signal<FullInvoice | null>(null);
  sponsorId = '';

  constructor(private route: ActivatedRoute, private sponsorSvc: SponsorService) {}

  ngOnInit(): void {
    this.sponsorId = this.route.snapshot.params['sponsorId'];
    const invoiceId = this.route.snapshot.params['invoiceId'];
    this.sponsorSvc.getInvoice(this.sponsorId, invoiceId).subscribe({
      next: (d) => {
        this.invoice.set(d.invoice as FullInvoice);
        this.sponsor.set(d.sponsor);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  print(): void { window.print(); }
}
