import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { SponsorBilling, SponsorService } from '../sponsor.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { SponsorInvoiceEditDialogComponent } from '../sponsor-invoice-edit-dialog/sponsor-invoice-edit-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-sponsor-billing',
  standalone: true,
  imports: [
    CommonModule, CurrencyPipe, DatePipe, RouterLink,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
    MatMenuModule, MatDialogModule,
    TranslateModule,
  ],
  template: `
    <div class="page">
      <div class="header">
        <a mat-icon-button routerLink="/sponsors"><mat-icon>arrow_back</mat-icon></a>
        <div class="header-text">
          <h1>{{ "SPONSOR.billing" | translate }}</h1>
          @if (data()) {
            <p>{{ data()!.sponsor.name }} · {{ data()!.sponsor.email }}</p>
          }
        </div>
        @if (data() && data()!.engagements.length > 0) {
          <button mat-flat-button color="primary"
                  (click)="generate()" [disabled]="generating()">
            @if (generating()) { <mat-spinner diameter="18" /> }
            <mat-icon>request_quote</mat-icon> {{ "SPONSOR.generateInvoice" | translate }}
          </button>
        }
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="36" /></div>
      } @else if (data()) {
        @if (data()!.engagements.length === 0) {
          <div class="empty">
            <mat-icon>receipt_long</mat-icon>
            <p>{{ "SPONSOR.noBillableEngagementsMsg" | translate }}</p>
          </div>
        } @else {
          <!-- Estimate + total -->
          <div class="totals-row">
            <div class="totals estimate">
              <span class="totals-label">{{ "SPONSOR.pendingInvoicing" | translate }}</span>
              <span class="totals-value">{{ data()!.unbilledEstimate | currency }}</span>
              <span class="totals-hint">{{ "SPONSOR.pendingInvoicingHint" | translate }}</span>
            </div>
            <div class="totals">
              <span class="totals-label">{{ "SPONSOR.totalBilled" | translate }}</span>
              <span class="totals-value">{{ data()!.grandTotal | currency }}</span>
              <span class="totals-hint">{{ "SPONSOR.totalBilledHint" | translate }}</span>
            </div>
          </div>

          <!-- Coachee groups -->
          <h2 class="section-h">{{ "SPONSOR.billsByCoachee" | translate }}</h2>
          @for (group of data()!.coacheeGroups; track group.coachee._id) {
            <div class="coachee-group">
              <div class="coachee-head">
                <div>
                  <strong>{{ group.coachee.firstName }} {{ group.coachee.lastName }}</strong>
                  <span class="coachee-email">{{ group.coachee.email }}</span>
                </div>
                <span class="coachee-subtotal">{{ group.subtotal | currency }}</span>
              </div>
              <div class="eng-list">
                @for (e of group.engagements; track e.engagementId) {
                  <a class="eng-row" [routerLink]="['/coaching', e.engagementId]">
                    <div class="eng-row-left">
                      <div class="eng-row-status-line">
                        <span class="eng-status" [class]="'st-' + e.status">{{ e.status }}</span>
                        @if (e.billed) {
                          <span class="billed-flag"
                                [matTooltip]="'On invoice ' + e.billedInvoiceNumber + ' (' + e.billedInvoiceStatus + ')'">
                            <mat-icon>check_circle</mat-icon> Billed · {{ e.billedInvoiceNumber }}
                          </span>
                        }
                      </div>
                      <span class="eng-meta">
                        Coach {{ e.coach.firstName }} {{ e.coach.lastName }} ·
                        {{ e.sessionsCompleted }}/{{ e.sessionsPurchased }} sessions
                      </span>
                    </div>
                    <div class="eng-row-right">
                      <span class="eng-rate">{{ e.hourlyRate | currency }}/hr</span>
                      <span class="eng-amt">{{ e.totalAmount | currency }}</span>
                    </div>
                  </a>
                }
              </div>
            </div>
          }

          <!-- Invoices -->
          <h2 class="section-h">{{ "SPONSOR.invoicesSection" | translate }}</h2>
          @if (data()!.invoices.length === 0) {
            <p class="muted-row">{{ "SPONSOR.noInvoicesYet" | translate }}</p>
          } @else {
            <div class="invoice-list">
              @for (inv of data()!.invoices; track inv._id) {
                <div class="invoice-row">
                  <div class="inv-id">
                    <strong>{{ inv.invoiceNumber }}</strong>
                    <span class="muted">created {{ inv.createdAt | date:'mediumDate' }}</span>
                  </div>
                  <span class="inv-status" [class]="'is-' + inv.status">{{ inv.status }}</span>
                  <span class="inv-total">{{ (inv.total / 100) | currency:inv.currency }}</span>
                  <span class="muted">due {{ inv.dueDate | date:'mediumDate' }}</span>
                  <div class="inv-actions">
                    <a mat-icon-button matTooltip="View / Print"
                       [routerLink]="['/billing/sponsors', sponsorId, 'invoices', inv._id]">
                      <mat-icon>visibility</mat-icon>
                    </a>
                    <button mat-icon-button [matMenuTriggerFor]="invMenu">
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #invMenu="matMenu">
                      @if (inv.status === 'draft') {
                        <button mat-menu-item (click)="editInvoice(inv)">
                          <mat-icon>edit</mat-icon> {{ "SPONSOR.editInvoiceMenu" | translate }}
                        </button>
                        <button mat-menu-item (click)="sendInvoice(inv)">
                          <mat-icon>send</mat-icon> {{ "SPONSOR.sendToSponsor" | translate }}
                        </button>
                      }
                      @if (inv.status === 'overdue') {
                        <button mat-menu-item (click)="sendInvoice(inv)">
                          <mat-icon>send</mat-icon> {{ "SPONSOR.resend" | translate }}
                        </button>
                      }
                      @if (inv.status !== 'void' && inv.status !== 'paid') {
                        <button mat-menu-item (click)="voidInvoice(inv)">
                          <mat-icon>block</mat-icon> {{ "SPONSOR.voidInvoiceMenu" | translate }}
                        </button>
                      }
                      @if (inv.status === 'draft' || inv.status === 'void') {
                        <button mat-menu-item class="delete-item" (click)="deleteInvoice(inv)">
                          <mat-icon>delete</mat-icon> {{ "SPONSOR.deleteInvoiceMenu" | translate }}
                        </button>
                      }
                    </mat-menu>
                  </div>
                </div>
              }
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1100px; margin: 0 auto; }
    .header {
      display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
      .header-text { flex: 1; min-width: 0; }
      h1 { margin: 0; font-size: 22px; color: var(--artes-primary); }
      p  { margin: 4px 0 0; color: #6b7c93; font-size: 13px; }
      mat-spinner { display: inline-block; margin-right: 6px; }
    }
    .loading { display: flex; justify-content: center; padding: 40px 0; }
    .empty {
      text-align: center; color: #6b7c93; padding: 40px 24px;
      mat-icon { font-size: 40px; width: 40px; height: 40px; color: #c8d3df; }
    }
    .totals-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;
    }
    .totals {
      display: flex; flex-direction: column; gap: 4px;
      background: #fff; color: var(--artes-primary);
      border: 1px solid #eef2f7; border-radius: 12px; padding: 18px 22px;
      .totals-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; color: #6b7c93; }
      .totals-value { font-size: 26px; font-weight: 700; }
      .totals-hint  { font-size: 11px; color: #9aa5b4; }
      &.estimate {
        background: linear-gradient(135deg, var(--artes-primary), var(--artes-accent)); color: #fff;
        border: none;
        .totals-label { color: rgba(255,255,255,0.85); }
        .totals-hint  { color: rgba(255,255,255,0.7); }
      }
    }
    @media (max-width: 600px) {
      .totals-row { grid-template-columns: 1fr; }
    }

    .section-h {
      font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px;
      color: #6b7c93; font-weight: 600; margin: 24px 0 8px;
    }

    .coachee-group {
      background: #fff; border: 1px solid #eef2f7; border-radius: 12px;
      margin-bottom: 12px; overflow: hidden;
    }
    .coachee-head {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 18px; background: #f7f9fc;
      border-bottom: 1px solid #eef2f7;
      strong { color: var(--artes-primary); font-size: 15px; }
      .coachee-email { display: block; color: #9aa5b4; font-size: 12px; margin-top: 2px; }
      .coachee-subtotal { font-size: 16px; font-weight: 700; color: #0f8a5f; }
    }
    .eng-list { padding: 4px 0; }
    .eng-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 18px; border-bottom: 1px solid #f5f7fa;
      text-decoration: none; color: inherit;
      &:last-child { border-bottom: none; }
      &:hover { background: #fafbfd; }
    }
    .eng-row-left { display: flex; flex-direction: column; gap: 4px; }
    .eng-row-right { display: flex; align-items: center; gap: 12px; }
    .eng-status {
      text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
      font-size: 10px; padding: 2px 8px; border-radius: 999px;
      background: #f0f4f8; color: #6b7c93; align-self: flex-start;
      &.st-active   { background: #e8f9f2; color: #0f8a5f; }
      &.st-completed { background: var(--artes-bg); color: var(--artes-accent); }
      &.st-paused   { background: #fef6e6; color: #b87e08; }
    }
    .eng-meta { font-size: 13px; color: #6b7c93; }
    .eng-rate { font-size: 13px; color: #9aa5b4; }
    .eng-amt  { font-size: 15px; font-weight: 600; color: var(--artes-primary); min-width: 80px; text-align: right; }

    .muted-row { color: #9aa5b4; font-size: 14px; padding: 10px 0; }
    .muted { color: #9aa5b4; font-size: 12px; margin-left: 8px; }
    .invoice-list {
      background: #fff; border: 1px solid #eef2f7; border-radius: 12px; overflow: hidden;
    }
    .invoice-row {
      display: grid; grid-template-columns: 2fr 100px 110px 1fr 100px;
      gap: 12px; align-items: center;
      padding: 8px 18px; border-bottom: 1px solid #f5f7fa;
      font-size: 14px; color: var(--artes-primary);
      &:last-child { border-bottom: none; }
    }
    .inv-id strong { display: block; }
    .inv-actions { display: flex; gap: 4px; justify-content: flex-end; }
    .delete-item { color: #dc2626 !important; }

    .eng-row-status-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .billed-flag {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 11px; font-weight: 600; color: #0f8a5f;
      background: #e8f9f2; padding: 2px 8px; border-radius: 999px;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
    }
    .inv-status {
      text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
      font-size: 10px; padding: 2px 10px; border-radius: 999px; text-align: center;
      background: #f0f4f8; color: #6b7c93;
      &.is-draft  { background: #fef6e6; color: #b87e08; }
      &.is-sent   { background: var(--artes-bg); color: var(--artes-accent); }
      &.is-paid   { background: #e8f9f2; color: #0f8a5f; }
      &.is-overdue { background: #fef2f2; color: #dc2626; }
      &.is-void   { background: #f0f4f8; color: #9aa5b4; }
    }
    .inv-total { font-weight: 700; }
  `],
})
export class SponsorBillingComponent implements OnInit {
  loading = signal(true);
  generating = signal(false);
  data = signal<SponsorBilling | null>(null);
  sponsorId = '';

  constructor(
    private route: ActivatedRoute,
    private sponsorSvc: SponsorService,
    private snack: MatSnackBar,
    private dialog: MatDialog,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.sponsorId = this.route.snapshot.params['id'];
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.sponsorSvc.billing(this.sponsorId).subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  generate(): void {
    this.generating.set(true);
    this.sponsorSvc.generateInvoice(this.sponsorId).subscribe({
      next: () => {
        this.generating.set(false);
        this.snack.open(this.translate.instant('SPONSOR.invoiceGenAsDraft'), 'OK', { duration: 3000 });
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.generating.set(false);
        this.snack.open(err?.error?.error || 'Failed to generate invoice', 'OK', { duration: 4000 });
      },
    });
  }

  voidInvoice(inv: { _id: string; invoiceNumber: string }): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Void invoice',
        message: `Void ${inv.invoiceNumber}? Its engagements become billable again on the next invoice.`,
        confirmLabel: 'Void',
        confirmColor: 'warn',
      },
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.sponsorSvc.voidInvoice(this.sponsorId, inv._id).subscribe({
        next: () => { this.snack.open('Invoice voided', 'OK', { duration: 2500 }); this.load(); },
        error: (err: HttpErrorResponse) => this.snack.open(err?.error?.error || 'Failed', 'OK', { duration: 4000 }),
      });
    });
  }

  editInvoice(inv: { _id: string }): void {
    this.sponsorSvc.getInvoice(this.sponsorId, inv._id).subscribe({
      next: ({ invoice }) => {
        const ref = this.dialog.open(SponsorInvoiceEditDialogComponent, {
          width: '780px',
          maxHeight: '92vh',
          data: {
            sponsorId: this.sponsorId,
            invoiceId: inv._id,
            lineItems: invoice.lineItems,
            dueDate: invoice.dueDate,
            notes: (invoice as { notes?: string }).notes,
            taxRatePercent: ((invoice as { taxRate?: number }).taxRate || 0) * 100,
            currency: invoice.currency,
          },
        });
        ref.afterClosed().subscribe((updated) => { if (updated) this.load(); });
      },
      error: () => this.snack.open('Failed to load invoice', 'OK', { duration: 3000 }),
    });
  }

  sendInvoice(inv: { _id: string; invoiceNumber: string }): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Send invoice',
        message: `Email ${inv.invoiceNumber} to the sponsor and mark it as sent?`,
        confirmLabel: 'Send',
      },
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.sponsorSvc.sendInvoice(this.sponsorId, inv._id).subscribe({
        next: () => { this.snack.open('Invoice sent', 'OK', { duration: 2500 }); this.load(); },
        error: (err: HttpErrorResponse) => this.snack.open(err?.error?.error || 'Failed', 'OK', { duration: 4000 }),
      });
    });
  }

  deleteInvoice(inv: { _id: string; invoiceNumber: string }): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete invoice',
        message: `Permanently delete ${inv.invoiceNumber}? This cannot be undone.`,
        confirmLabel: 'Delete',
        confirmColor: 'warn',
      },
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.sponsorSvc.deleteInvoice(this.sponsorId, inv._id).subscribe({
        next: () => { this.snack.open('Invoice deleted', 'OK', { duration: 2500 }); this.load(); },
        error: (err: HttpErrorResponse) => this.snack.open(err?.error?.error || 'Failed', 'OK', { duration: 4000 }),
      });
    });
  }
}
