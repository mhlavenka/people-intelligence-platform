import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpErrorResponse } from '@angular/common/http';
import { SponsorBilling, SponsorService } from '../sponsor.service';

@Component({
  selector: 'app-sponsor-billing',
  standalone: true,
  imports: [
    CommonModule, CurrencyPipe, DatePipe, RouterLink,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    <div class="page">
      <div class="header">
        <a mat-icon-button routerLink="/sponsors"><mat-icon>arrow_back</mat-icon></a>
        <div class="header-text">
          <h1>Sponsor billing</h1>
          @if (data()) {
            <p>{{ data()!.sponsor.name }} · {{ data()!.sponsor.email }}</p>
          }
        </div>
        @if (data() && data()!.engagements.length > 0) {
          <button mat-flat-button color="primary"
                  (click)="generate()" [disabled]="generating()">
            @if (generating()) { <mat-spinner diameter="18" /> }
            <mat-icon>request_quote</mat-icon> Generate invoice
          </button>
        }
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="36" /></div>
      } @else if (data()) {
        @if (data()!.engagements.length === 0) {
          <div class="empty">
            <mat-icon>receipt_long</mat-icon>
            <p>No billable engagements for this sponsor yet.</p>
          </div>
        } @else {
          <!-- Grand total -->
          <div class="totals">
            <span class="totals-label">Total billable</span>
            <span class="totals-value">{{ data()!.grandTotal | currency }}</span>
          </div>

          <!-- Coachee groups -->
          <h2 class="section-h">Bills by coachee</h2>
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
                      <span class="eng-status" [class]="'st-' + e.status">{{ e.status }}</span>
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
          <h2 class="section-h">Invoices</h2>
          @if (data()!.invoices.length === 0) {
            <p class="muted-row">No invoices generated yet — use the button above to create one.</p>
          } @else {
            <div class="invoice-list">
              @for (inv of data()!.invoices; track inv._id) {
                <div class="invoice-row">
                  <div>
                    <strong>{{ inv.invoiceNumber }}</strong>
                    <span class="muted">created {{ inv.createdAt | date:'mediumDate' }}</span>
                  </div>
                  <span class="inv-status" [class]="'is-' + inv.status">{{ inv.status }}</span>
                  <span class="inv-total">{{ (inv.total / 100) | currency:inv.currency }}</span>
                  <span class="muted">due {{ inv.dueDate | date:'mediumDate' }}</span>
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
      h1 { margin: 0; font-size: 22px; color: #1B2A47; }
      p  { margin: 4px 0 0; color: #6b7c93; font-size: 13px; }
      mat-spinner { display: inline-block; margin-right: 6px; }
    }
    .loading { display: flex; justify-content: center; padding: 40px 0; }
    .empty {
      text-align: center; color: #6b7c93; padding: 40px 24px;
      mat-icon { font-size: 40px; width: 40px; height: 40px; color: #c8d3df; }
    }
    .totals {
      display: flex; align-items: center; justify-content: space-between;
      background: linear-gradient(135deg, #1B2A47, #3A9FD6); color: #fff;
      border-radius: 12px; padding: 18px 22px; margin-bottom: 20px;
      .totals-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; opacity: 0.85; }
      .totals-value { font-size: 26px; font-weight: 700; }
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
      strong { color: #1B2A47; font-size: 15px; }
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
      &.st-completed { background: #EBF5FB; color: #3A9FD6; }
      &.st-paused   { background: #fef6e6; color: #b87e08; }
    }
    .eng-meta { font-size: 13px; color: #6b7c93; }
    .eng-rate { font-size: 13px; color: #9aa5b4; }
    .eng-amt  { font-size: 15px; font-weight: 600; color: #1B2A47; min-width: 80px; text-align: right; }

    .muted-row { color: #9aa5b4; font-size: 14px; padding: 10px 0; }
    .muted { color: #9aa5b4; font-size: 12px; margin-left: 8px; }
    .invoice-list {
      background: #fff; border: 1px solid #eef2f7; border-radius: 12px; overflow: hidden;
    }
    .invoice-row {
      display: grid; grid-template-columns: 2fr 100px 100px 1fr;
      gap: 12px; align-items: center;
      padding: 12px 18px; border-bottom: 1px solid #f5f7fa;
      font-size: 14px; color: #1B2A47;
      &:last-child { border-bottom: none; }
    }
    .inv-status {
      text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
      font-size: 10px; padding: 2px 10px; border-radius: 999px; text-align: center;
      background: #f0f4f8; color: #6b7c93;
      &.is-draft  { background: #fef6e6; color: #b87e08; }
      &.is-sent   { background: #EBF5FB; color: #3A9FD6; }
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

  constructor(
    private route: ActivatedRoute,
    private sponsorSvc: SponsorService,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    const id = this.route.snapshot.params['id'];
    this.loading.set(true);
    this.sponsorSvc.billing(id).subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  generate(): void {
    const id = this.route.snapshot.params['id'];
    this.generating.set(true);
    this.sponsorSvc.generateInvoice(id).subscribe({
      next: () => {
        this.generating.set(false);
        this.snack.open('Invoice generated as draft', 'OK', { duration: 3000 });
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.generating.set(false);
        this.snack.open(err?.error?.error || 'Failed to generate invoice', 'OK', { duration: 4000 });
      },
    });
  }
}
