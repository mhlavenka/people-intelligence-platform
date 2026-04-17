import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/api.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface BillingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface TaxBreakdown {
  gst: number;
  hst: number;
  pst: number;
  qst: number;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  period: { from: string; to: string };
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  taxBreakdown?: TaxBreakdown;
  tax: number;
  total: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  dueDate: string;
  billingAddress?: BillingAddress;
  taxId?: string;
  paidAt?: string;
  sentAt?: string;
  reminderCount?: number;
  notes?: string;
  createdAt: string;
}

interface OrgPlan {
  name: string;
  plan: string;
  maxUsers: number;
  currentUsers?: number;
  trialEndsAt?: string;
  isActive: boolean;
  billingEmail?: string;
  billingAddress?: BillingAddress;
  taxId?: string;
  modules?: string[];
  suspendedAt?: string;
  suspensionReason?: string;
}

interface AvailablePlan {
  _id: string;
  key: string;
  name: string;
  description: string;
  priceMonthly: number;
  overagePriceCents: number;
  maxUsers: number;
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatDividerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    DatePipe,
    EmptyStateComponent,
  ],
  template: `
    <div class="billing-page">
      <div class="billing-content">

        <!-- Page Header -->
        <div class="page-header">
          <h1 class="page-title">Billing & Plan</h1>
          <p class="page-subtitle">Manage your subscription and view payment history.</p>
        </div>

        <!-- Loading State -->
        @if (loading()) {
          <div class="loading-container">
            <mat-spinner diameter="40"></mat-spinner>
            <span class="loading-text">Loading billing information…</span>
          </div>
        }

        @if (!loading()) {

          <!-- Suspension banner -->
          @if (org()?.suspendedAt) {
            <div class="suspension-banner">
              <mat-icon>block</mat-icon>
              <div class="suspension-content">
                <strong>Account Suspended</strong>
                <span>{{ org()?.suspensionReason || 'Your account has been suspended due to outstanding payments.' }}</span>
                <span class="suspension-date">Suspended {{ org()?.suspendedAt | date:'MMM d, y' }}</span>
              </div>
            </div>
          }

          <div class="billing-grid">

            <!-- LEFT: current plan + estimate + outstanding + history -->
            <div class="billing-main">

              <!-- Current Plan -->
              @if (org(); as orgData) {
                <section class="card plan-card">
                  <div class="card-header">
                    <h2 class="card-title">Current Plan</h2>
                  </div>
                  <div class="plan-body">
                    <div class="plan-left">
                      <div class="plan-name-row">
                        <span class="plan-badge"
                          [style.background-color]="planColorBg(orgData.plan)"
                          [style.color]="planColor(orgData.plan)">
                          {{ orgData.plan | titlecase }}
                        </span>
                        @if (isTrialActive(orgData.trialEndsAt)) {
                          <span class="trial-badge">
                            <mat-icon class="trial-icon">schedule</mat-icon>
                            Trial ends {{ orgData.trialEndsAt | date:'MMM d, y' }}
                          </span>
                        }
                      </div>
                      <div class="plan-price">{{ planPrice(orgData.plan) }}</div>
                      @if (orgData.billingEmail) {
                        <div class="billing-email">
                          <mat-icon class="meta-icon">email</mat-icon>
                          <span>{{ orgData.billingEmail }}</span>
                        </div>
                      }
                      @if (orgData.modules && orgData.modules.length > 0) {
                        <div class="modules-row">
                          @for (mod of orgData.modules; track mod) {
                            <span class="module-chip">{{ mod }}</span>
                          }
                        </div>
                      }
                    </div>
                    <div class="plan-right">
                      <div class="usage-section">
                        <div class="usage-header">
                          <span class="usage-label">Team members</span>
                          <span class="usage-numbers">
                            {{ orgData.currentUsers ?? 0 }}<span class="usage-sep"> / </span>{{ orgData.maxUsers }}
                          </span>
                        </div>
                        <mat-progress-bar mode="determinate"
                          [value]="usagePercent(orgData)"
                          [color]="usagePercent(orgData) >= 90 ? 'warn' : 'primary'"
                          class="usage-bar"></mat-progress-bar>
                        <div class="usage-caption">
                          {{ orgData.maxUsers - (orgData.currentUsers ?? 0) }} seat(s) remaining
                        </div>
                      </div>
                    </div>
                  </div>
                  <mat-divider class="card-divider"></mat-divider>
                  <div class="card-footer">
                    <a href="mailto:sales@headsoft.io?subject=Upgrade%20Plan"
                       mat-stroked-button color="primary" class="upgrade-btn">
                      <mat-icon>arrow_upward</mat-icon>
                      Contact us to upgrade
                    </a>
                  </div>
                </section>
              }

              <!-- Current Month Estimate -->
              @if (currentInvoice(); as inv) {
                <section class="card estimate-card">
                  <div class="card-header">
                    <h2 class="card-title">Current Month Estimate</h2>
                    <div class="card-header-actions">
                      <span class="status-badge" [class]="'status-' + inv.status">{{ inv.status | titlecase }}</span>
                      <button mat-icon-button class="pdf-btn" (click)="downloadPdf(inv)"
                              matTooltip="Download PDF invoice" aria-label="Download invoice as PDF">
                        <mat-icon>picture_as_pdf</mat-icon>
                      </button>
                    </div>
                  </div>
                  <div class="estimate-body">
                    <div class="estimate-meta">
                      <div class="estimate-meta-item">
                        <span class="meta-label">Invoice</span>
                        <span class="invoice-number">{{ inv.invoiceNumber }}</span>
                      </div>
                      <div class="estimate-meta-item">
                        <span class="meta-label">Period</span>
                        <span class="meta-value">{{ inv.period.from | date:'MMM d' }} – {{ inv.period.to | date:'MMM d, y' }}</span>
                      </div>
                      <div class="estimate-meta-item">
                        <span class="meta-label">Due</span>
                        <span class="meta-value" [class.overdue-text]="inv.status === 'overdue'">{{ inv.dueDate | date:'MMM d, y' }}</span>
                      </div>
                    </div>
                    <div class="estimate-amount">
                      <span class="amount-label">Estimated total</span>
                      <span class="amount-value">{{ formatMoney(inv.total) }}</span>
                    </div>
                  </div>
                  <div class="line-items-toggle">
                    <button mat-button class="toggle-btn" (click)="showLineItems.set(!showLineItems())">
                      <mat-icon>{{ showLineItems() ? 'expand_less' : 'expand_more' }}</mat-icon>
                      {{ showLineItems() ? 'Hide' : 'Show' }} line items
                    </button>
                  </div>
                  @if (showLineItems()) {
                    <div class="line-items">
                      <table class="line-items-table">
                        <thead>
                          <tr>
                            <th class="col-desc">Description</th>
                            <th class="col-qty">Qty</th>
                            <th class="col-price">Unit Price</th>
                            <th class="col-amount">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of inv.lineItems; track item.description) {
                            <tr>
                              <td class="col-desc">{{ item.description }}</td>
                              <td class="col-qty">{{ item.quantity }}</td>
                              <td class="col-price">{{ formatMoney(item.unitPrice) }}</td>
                              <td class="col-amount">{{ formatMoney(item.amount) }}</td>
                            </tr>
                          }
                        </tbody>
                        <tfoot>
                          <tr class="subtotal-row">
                            <td colspan="3" class="total-label">Subtotal</td>
                            <td class="col-amount">{{ formatMoney(inv.subtotal) }}</td>
                          </tr>
                          @if (inv.taxBreakdown?.gst) {
                            <tr class="tax-row">
                              <td colspan="3" class="total-label">GST (5%)</td>
                              <td class="col-amount">{{ formatMoney(inv.taxBreakdown!.gst) }}</td>
                            </tr>
                          }
                          @if (inv.taxBreakdown?.hst) {
                            <tr class="tax-row">
                              <td colspan="3" class="total-label">HST</td>
                              <td class="col-amount">{{ formatMoney(inv.taxBreakdown!.hst) }}</td>
                            </tr>
                          }
                          @if (inv.taxBreakdown?.pst) {
                            <tr class="tax-row">
                              <td colspan="3" class="total-label">PST</td>
                              <td class="col-amount">{{ formatMoney(inv.taxBreakdown!.pst) }}</td>
                            </tr>
                          }
                          @if (inv.taxBreakdown?.qst) {
                            <tr class="tax-row">
                              <td colspan="3" class="total-label">QST (9.975%)</td>
                              <td class="col-amount">{{ formatMoney(inv.taxBreakdown!.qst) }}</td>
                            </tr>
                          }
                          @if (inv.tax > 0 && !inv.taxBreakdown) {
                            <tr class="tax-row">
                              <td colspan="3" class="total-label">Tax</td>
                              <td class="col-amount">{{ formatMoney(inv.tax) }}</td>
                            </tr>
                          }
                          <tr class="grand-total-row">
                            <td colspan="3" class="total-label grand-label">Total</td>
                            <td class="col-amount grand-amount">{{ formatMoney(inv.total) }}</td>
                          </tr>
                        </tfoot>
                      </table>
                      @if (inv.notes) {
                        <div class="invoice-notes">
                          <mat-icon class="notes-icon">info_outline</mat-icon>
                          <span>{{ inv.notes }}</span>
                        </div>
                      }
                    </div>
                  }
                  @if (inv.status === 'sent' || inv.status === 'overdue') {
                    <mat-divider class="card-divider"></mat-divider>
                    <div class="card-footer">
                      <button mat-flat-button color="primary" class="pay-btn"
                              [disabled]="paying() === inv._id" (click)="payInvoice(inv)">
                        @if (paying() === inv._id) {
                          <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
                          Processing…
                        } @else {
                          <mat-icon>payment</mat-icon>
                          Pay Now — {{ formatMoney(inv.total) }}
                        }
                      </button>
                    </div>
                  }
                </section>
              }

              <!-- Outstanding Invoices -->
              @if (outstandingInvoices().length > 0) {
                <div class="outstanding-banner">
                  <mat-icon class="banner-icon">warning_amber</mat-icon>
                  <span class="banner-text">
                    You have <strong>{{ outstandingInvoices().length }}</strong>
                    outstanding invoice{{ outstandingInvoices().length > 1 ? 's' : '' }}.
                  </span>
                </div>
                <section class="card outstanding-card">
                  <div class="card-header">
                    <h2 class="card-title">Outstanding Invoices</h2>
                  </div>
                  <div class="outstanding-list">
                    @for (inv of outstandingInvoices(); track inv._id) {
                      <div class="outstanding-item">
                        <div class="outstanding-info">
                          <span class="invoice-number">{{ inv.invoiceNumber }}</span>
                          <span class="outstanding-period">{{ inv.period.from | date:'MMM d' }} – {{ inv.period.to | date:'MMM d, y' }}</span>
                          <span class="status-badge" [class]="'status-' + inv.status">{{ inv.status | titlecase }}</span>
                        </div>
                        <div class="outstanding-right">
                          <span class="outstanding-amount">{{ formatMoney(inv.total) }}</span>
                          <button mat-flat-button color="primary" class="pay-btn pay-btn-sm"
                                  [disabled]="paying() === inv._id" (click)="payInvoice(inv)">
                            @if (paying() === inv._id) {
                              <mat-spinner diameter="14" class="btn-spinner"></mat-spinner>
                            } @else {
                              <mat-icon>payment</mat-icon>
                            }
                            Pay
                          </button>
                        </div>
                      </div>
                      @if (!$last) { <mat-divider></mat-divider> }
                    }
                  </div>
                </section>
              }

              <!-- Payment History -->
              <section class="card history-card">
                <div class="card-header">
                  <h2 class="card-title">Payment History</h2>
                </div>
                @if (paidInvoices().length === 0) {
                  <app-empty-state icon="receipt_long" title="No payment history" message="No payment history yet."></app-empty-state>
                } @else {
                  <div class="history-table-wrapper">
                    <table class="history-table">
                      <thead>
                        <tr>
                          <th class="col-inv">Invoice #</th>
                          <th class="col-period">Period</th>
                          <th class="col-amt">Amount</th>
                          <th class="col-paid">Paid Date</th>
                          <th class="col-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (inv of paidInvoices(); track inv._id; let odd = $odd) {
                          <tr [class.row-odd]="odd">
                            <td class="col-inv"><span class="invoice-number">{{ inv.invoiceNumber }}</span></td>
                            <td class="col-period">{{ inv.period.from | date:'MMM d' }} – {{ inv.period.to | date:'MMM d, y' }}</td>
                            <td class="col-amt">{{ formatMoney(inv.total) }}</td>
                            <td class="col-paid">{{ inv.paidAt | date:'MMM d, y' }}</td>
                            <td class="col-actions">
                              <button mat-icon-button (click)="downloadPdf(inv)"
                                      matTooltip="Download PDF invoice" aria-label="Download invoice as PDF"
                                      class="receipt-btn">
                                <mat-icon>picture_as_pdf</mat-icon>
                              </button>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </section>

            </div><!-- /billing-main -->

            <!-- RIGHT: available plans -->
            <div class="billing-sidebar">
              <section class="card tiers-card">
                <div class="card-header">
                  <h2 class="card-title">Available Plans</h2>
                  <span class="bundle-tag">Bundle saves 25%</span>
                </div>
                <div class="tiers-body">

                  <div class="tier-module">
                    <div class="tier-module-label">
                      <mat-icon class="tier-mod-icon" style="color:#e86c3a">bolt</mat-icon>
                      Conflict Intelligence™
                    </div>
                    <div class="tier-row-list">
                      @for (t of conflictTiers; track t.name) {
                        <div class="tier-row" [class.tier-current]="(org()?.plan ?? '') === t.planKey">
                          <div class="tier-name-col">
                            <span class="tier-name">{{ t.name }}</span>
                            @if ((org()?.plan ?? '') === t.planKey) {
                              <span class="current-chip">Current</span>
                            }
                          </div>
                          <div class="tier-price">{{ t.price }}</div>
                        </div>
                      }
                    </div>
                  </div>

                  <div class="tier-module">
                    <div class="tier-module-label">
                      <mat-icon class="tier-mod-icon" style="color:#27C4A0">psychology</mat-icon>
                      Neuro-Inclusion Compass™
                    </div>
                    <div class="tier-row-list">
                      @for (t of neuroinclTiers; track t.name) {
                        <div class="tier-row">
                          <div class="tier-name-col"><span class="tier-name">{{ t.name }}</span></div>
                          <div class="tier-price">{{ t.price }}</div>
                        </div>
                      }
                    </div>
                  </div>

                  <div class="tier-module">
                    <div class="tier-module-label">
                      <mat-icon class="tier-mod-icon" style="color:#3A9FD6">emoji_events</mat-icon>
                      Leadership & Succession Hub™
                    </div>
                    <div class="tier-row-list">
                      @for (t of successionTiers; track t.name) {
                        <div class="tier-row">
                          <div class="tier-name-col"><span class="tier-name">{{ t.name }}</span></div>
                          <div class="tier-price">{{ t.price }}</div>
                        </div>
                      }
                    </div>
                  </div>

                  <div class="bundle-row">
                    <mat-icon class="bundle-icon">auto_awesome</mat-icon>
                    <div class="bundle-info">
                      <strong>All-Platform Bundle</strong>
                      <span>All three modules · 2 Helena coaching days/year</span>
                    </div>
                    <div class="bundle-price">CAD $24,000<span class="bundle-per">/yr</span></div>
                  </div>

                </div>
              </section>
            </div><!-- /billing-sidebar -->

          </div><!-- /billing-grid -->

        } <!-- end !loading() -->

      </div>
    </div>
  `,
  styles: [`
    /* ── Page shell ─────────────────────────────── */
    .billing-page {
      min-height: 100vh;
      background: #f5f7fa;
      padding: 24px 16px;
      box-sizing: border-box;
    }

    .billing-content {
      width: 100%;
    }

    .billing-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
      align-items: start;
      margin-bottom: 20px;
    }

    .billing-main {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .billing-sidebar {
      position: sticky;
      top: 24px;
    }

    /* ── Page header ─────────────────────────────── */
    .page-header {
      margin-bottom: 28px;
    }

    .page-title {
      font-size: 26px;
      font-weight: 700;
      color: #1B2A47;
      margin: 0 0 6px 0;
      letter-spacing: -0.3px;
    }

    .page-subtitle {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
    }

    /* ── Loading ─────────────────────────────────── */
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 0;
      gap: 16px;
    }

    .loading-text {
      font-size: 14px;
      color: #6b7280;
    }

    /* ── Card base ───────────────────────────────── */
    .card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.04);
      margin-bottom: 20px;
      overflow: hidden;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 20px 0 24px;
    }

    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: #1B2A47;
      margin: 0;
      letter-spacing: -0.1px;
    }

    .card-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .pdf-btn {
      color: #9ca3af;
      width: 28px;
      height: 28px;
      line-height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      mat-icon { font-size: 17px; width: 17px; height: 17px; line-height: 17px; }
      &:hover { color: #1B2A47; }
    }

    .card-divider {
      margin: 20px 0 0 0;
    }

    .card-footer {
      padding: 16px 24px 20px 24px;
    }

    /* ── Section 1: Plan card ────────────────────── */
    .plan-body {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 32px;
      padding: 16px 24px 24px 24px;
      flex-wrap: wrap;
    }

    .plan-left {
      flex: 1 1 auto;
      min-width: 200px;
    }

    .plan-right {
      flex: 0 0 260px;
      min-width: 200px;
    }

    .plan-name-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }

    .plan-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .trial-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      background: #e8f4fd;
      color: #3A9FD6;
      border: 1px solid #c3e0f5;
    }

    .trial-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }

    .plan-price {
      font-size: 28px;
      font-weight: 700;
      color: #1B2A47;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }

    .billing-email {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 10px;
    }

    .meta-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: #9ca3af;
    }

    .modules-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .module-chip {
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      background: #f0f9ff;
      color: #3A9FD6;
      border: 1px solid #bae6fd;
    }

    /* Usage bar */
    .usage-section {
      background: #f8fafc;
      border-radius: 12px;
      padding: 14px 16px;
      border: 1px solid #e5e7eb;
    }

    .usage-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 8px;
    }

    .usage-label {
      font-size: 12px;
      font-weight: 500;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .usage-numbers {
      font-size: 14px;
      font-weight: 700;
      color: #1B2A47;
    }

    .usage-sep {
      color: #9ca3af;
      font-weight: 400;
    }

    .usage-bar {
      border-radius: 4px;
      height: 8px;
      margin-bottom: 6px;
    }

    .usage-caption {
      font-size: 11px;
      color: #9ca3af;
    }

    .upgrade-btn {
      font-size: 13px;
      font-weight: 500;
    }

    /* ── Section 2: Estimate card ────────────────── */
    .estimate-body {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 16px 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .estimate-meta {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .estimate-meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .meta-label {
      font-size: 11px;
      font-weight: 500;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .meta-value {
      font-size: 13px;
      color: #374151;
      font-weight: 500;
    }

    .overdue-text {
      color: #ef4444;
      font-weight: 600;
    }

    .estimate-amount {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .amount-label {
      font-size: 11px;
      font-weight: 500;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .amount-value {
      font-size: 36px;
      font-weight: 700;
      color: #1B2A47;
      letter-spacing: -1px;
      line-height: 1;
    }

    /* Line items toggle */
    .line-items-toggle {
      padding: 0 16px 4px 16px;
    }

    .toggle-btn {
      font-size: 12px;
      color: #6b7280;
    }

    /* Line items table */
    .line-items {
      padding: 0 24px 20px 24px;
    }

    .line-items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .line-items-table thead tr {
      border-bottom: 1px solid #e5e7eb;
    }

    .line-items-table th {
      font-size: 11px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 10px;
      text-align: left;
    }

    .line-items-table td {
      padding: 8px 10px;
      color: #374151;
      border-bottom: 1px solid #f3f4f6;
    }

    .line-items-table tfoot td {
      border-bottom: none;
      padding: 6px 10px;
    }

    .line-items-table .col-desc { width: 50%; }
    .line-items-table .col-qty  { text-align: center; width: 10%; }
    .line-items-table .col-price { text-align: right; width: 20%; }
    .line-items-table .col-amount { text-align: right; width: 20%; font-weight: 600; }

    .subtotal-row td, .tax-row td { color: #6b7280; }
    .grand-total-row { border-top: 1px solid #e5e7eb; }

    .total-label {
      text-align: right;
      font-size: 12px;
      color: #6b7280;
    }

    .grand-label {
      font-size: 13px;
      font-weight: 700;
      color: #1B2A47;
    }

    .grand-amount {
      font-size: 15px;
      font-weight: 700;
      color: #1B2A47;
    }

    .invoice-notes {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-top: 12px;
      padding: 10px 12px;
      background: #f0f9ff;
      border-radius: 8px;
      font-size: 12px;
      color: #374151;
      border: 1px solid #bae6fd;
    }

    .notes-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: #3A9FD6;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* Pay button */
    .pay-btn {
      font-size: 13px;
      font-weight: 600;
      min-width: 140px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .pay-btn-sm {
      min-width: auto;
      font-size: 12px;
    }

    .btn-spinner {
      display: inline-flex;
    }

    /* Status badges */
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.3px;
      text-transform: capitalize;
    }

    .status-draft  { background: #f3f4f6; color: #6b7280; }
    .status-sent   { background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; }
    .status-paid   { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .status-overdue { background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; }
    .status-void   { background: #f3f4f6; color: #9ca3af; }

    /* ── Section 3: Outstanding Banner ──────────── */
    .suspension-banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 18px 22px;
      background: #fef2f2;
      border: 2px solid #fecaca;
      border-radius: 14px;
      margin-bottom: 20px;
      mat-icon { color: #dc2626; font-size: 28px; width: 28px; height: 28px; margin-top: 2px; }
      .suspension-content {
        display: flex; flex-direction: column; gap: 4px;
        strong { font-size: 16px; color: #dc2626; }
        span { font-size: 13px; color: #5a6a7e; line-height: 1.5; }
        .suspension-date { font-size: 12px; color: #9aa5b4; }
      }
    }

    .outstanding-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      background: #fff8e6;
      border: 1px solid #fcd34d;
      border-radius: 12px;
      margin-bottom: 12px;
    }

    .banner-icon {
      color: #d97706;
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .banner-text {
      font-size: 13px;
      color: #92400e;
    }

    /* Outstanding list */
    .outstanding-list {
      padding: 0 24px 20px 24px;
    }

    .outstanding-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 0;
      gap: 16px;
      flex-wrap: wrap;
    }

    .outstanding-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .outstanding-period {
      font-size: 13px;
      color: #6b7280;
    }

    .outstanding-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .outstanding-amount {
      font-size: 15px;
      font-weight: 700;
      color: #1B2A47;
    }

    /* ── Section 4: Payment History ─────────────── */
    .history-table-wrapper {
      overflow-x: auto;
      padding: 0 0 4px 0;
    }

    .history-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .history-table thead tr {
      border-bottom: 2px solid #e5e7eb;
    }

    .history-table th {
      font-size: 11px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 12px 16px;
      text-align: left;
      background: #fafafa;
      white-space: nowrap;
    }

    .history-table td {
      padding: 12px 16px;
      color: #374151;
      white-space: nowrap;
      border-bottom: 1px solid #f3f4f6;
    }

    .history-table .row-odd {
      background: #fafbfc;
    }

    .history-table .col-inv   { width: 20%; }
    .history-table .col-period { width: 35%; white-space: normal; }
    .history-table .col-amt   { width: 15%; font-weight: 600; }
    .history-table .col-paid  { width: 20%; }
    .history-table .col-actions { width: 10%; text-align: center; }

    .invoice-number {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      font-weight: 600;
      color: #1B2A47;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .receipt-btn {
      color: #6b7280;
      &:hover { color: #1B2A47; }
    }


    /* ── Plan Tiers card ─────────────────────────── */
    .tiers-card .card-header { padding-bottom: 0; align-items: center; }

    .bundle-tag {
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      background: #fef9c3; color: #92400e; padding: 3px 9px; border-radius: 20px;
      border: 1px solid #fde68a;
    }

    .tiers-body {
      padding: 16px 24px 24px;
      display: flex; flex-direction: column; gap: 20px;
    }

    .tier-module-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: #6b7280; margin-bottom: 8px;
    }
    .tier-mod-icon { font-size: 15px; width: 15px; height: 15px; }

    .tier-row-list { display: flex; flex-direction: column; gap: 4px; }

    .tier-row {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 12px; border-radius: 8px; background: #f8fafc;
      border: 1px solid transparent;
      transition: border-color 0.15s;
    }
    .tier-row.tier-current {
      background: #eff6ff; border-color: #bfdbfe;
    }

    .tier-name-col { flex: 1; display: flex; align-items: center; gap: 8px; }
    .tier-name { font-size: 13px; font-weight: 600; color: #1B2A47; }

    .current-chip {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      background: #3A9FD6; color: white; padding: 2px 7px; border-radius: 10px;
    }

    .tier-price {
      font-size: 13px; font-weight: 700; color: #1B2A47;
      min-width: 130px; text-align: right;
    }

    .bundle-row {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 16px; border-radius: 12px;
      background: linear-gradient(135deg, #1B2A47 0%, #253659 100%);
      color: white;
    }
    .bundle-icon { color: #f0c040; font-size: 22px; flex-shrink: 0; }
    .bundle-info {
      flex: 1; display: flex; flex-direction: column; gap: 3px;
      strong { font-size: 14px; }
      span   { font-size: 12px; opacity: 0.75; }
    }
    .bundle-price {
      font-size: 18px; font-weight: 800; white-space: nowrap;
      .bundle-per { font-size: 12px; font-weight: 400; opacity: 0.75; }
    }

    /* ── Responsive ──────────────────────────────── */
    @media (max-width: 1024px) {
      .billing-grid {
        grid-template-columns: 1fr;
      }
      .billing-sidebar {
        position: static;
      }
    }

    @media (max-width: 600px) {
      .billing-page {
        padding: 16px 12px;
      }

      .plan-body {
        flex-direction: column;
      }

      .plan-right {
        flex: 1 1 auto;
        width: 100%;
      }

      .estimate-body {
        flex-direction: column;
      }

      .estimate-amount {
        align-items: flex-start;
      }

      .amount-value {
        font-size: 28px;
      }
    }
  `],
  providers: [DatePipe],
})
export class BillingComponent implements OnInit {
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private route = inject(ActivatedRoute);

  conflictTiers = [
    { name: 'Starter',      planKey: 'starter',      limit: 'Up to 50 employees',   price: 'CAD $599/mo' },
    { name: 'Professional', planKey: 'professional',  limit: 'Up to 200 employees',  price: 'CAD $1,199/mo' },
    { name: 'Enterprise',   planKey: 'enterprise',    limit: '200–500+ employees',   price: 'Custom' },
  ];

  neuroinclTiers = [
    { name: 'Assessment + Report',       limit: 'One-time, full org',           price: 'CAD $2,500' },
    { name: 'Compass Subscription',      limit: 'Annual, continuous monitoring', price: 'CAD $8,400/yr' },
    { name: 'Implementation Program',    limit: '3-month guided add-on',        price: 'CAD $6,000' },
    { name: 'Enterprise',                limit: 'Multi-dept / white-label',     price: 'Custom' },
  ];

  successionTiers = [
    { name: 'Succession Starter', limit: 'Up to 5 successors',    price: 'CAD $4,800/yr' },
    { name: 'Leadership Team',    limit: 'Up to 15 leaders',      price: 'CAD $9,600/yr' },
    { name: 'Full Program',       limit: 'Unlimited + 4 coaching sessions/yr', price: 'CAD $18,000/yr' },
    { name: 'IDP-Only',           limit: 'Standalone, per person', price: 'CAD $1,200/person' },
  ];

  org = signal<OrgPlan | null>(null);
  invoices = signal<Invoice[]>([]);
  availablePlans = signal<AvailablePlan[]>([]);
  loading = signal(true);
  paying = signal<string | null>(null);
  showLineItems = signal(false);

  /** Most recent non-paid, non-void invoice (draft or sent or overdue). */
  currentInvoice = computed<Invoice | null>(() => {
    const active = this.invoices().filter(
      (inv) => inv.status !== 'paid' && inv.status !== 'void'
    );
    if (active.length === 0) return null;
    return active.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  });

  /** All paid invoices sorted by paidAt descending. */
  paidInvoices = computed<Invoice[]>(() =>
    this.invoices()
      .filter((inv) => inv.status === 'paid')
      .sort((a, b) => {
        const aTime = a.paidAt ? new Date(a.paidAt).getTime() : 0;
        const bTime = b.paidAt ? new Date(b.paidAt).getTime() : 0;
        return bTime - aTime;
      })
  );

  /** Sent or overdue invoices (excluding the one shown in Section 2). */
  outstandingInvoices = computed<Invoice[]>(() => {
    const current = this.currentInvoice();
    return this.invoices().filter(
      (inv) =>
        (inv.status === 'sent' || inv.status === 'overdue') &&
        inv._id !== current?._id
    );
  });

  ngOnInit(): void {
    this.handlePaymentQueryParam();
    this.loadData();
  }

  private handlePaymentQueryParam(): void {
    this.route.queryParamMap.subscribe((params) => {
      const payment = params.get('payment');
      if (payment === 'success') {
        this.snackBar.open(
          'Payment successful! Your invoice will be updated shortly.',
          'Dismiss',
          { duration: 6000, panelClass: ['snack-success'] }
        );
      } else if (payment === 'cancelled') {
        this.snackBar.open('Payment was cancelled.', 'Dismiss', {
          duration: 4000,
          panelClass: ['snack-info'],
        });
      }
    });
  }

  private loadData(): void {
    this.loading.set(true);

    let orgDone = false;
    let invoicesDone = false;
    let plansDone = false;

    const checkDone = () => {
      if (orgDone && invoicesDone && plansDone) {
        this.loading.set(false);
      }
    };

    this.api.get<OrgPlan>('/organizations/me').subscribe({
      next: (data) => { this.org.set(data); orgDone = true; checkDone(); },
      error: () => { orgDone = true; checkDone(); },
    });

    this.api.get<Invoice[]>('/billing/invoices').subscribe({
      next: (data) => { this.invoices.set(data); invoicesDone = true; checkDone(); },
      error: () => { invoicesDone = true; checkDone(); },
    });

    this.api.get<AvailablePlan[]>('/plans').subscribe({
      next: (data) => { this.availablePlans.set(data); plansDone = true; checkDone(); },
      error: () => { plansDone = true; checkDone(); },
    });
  }

  payInvoice(invoice: Invoice): void {
    if (this.paying()) return;
    this.paying.set(invoice._id);

    this.api
      .post<{ url: string }>(`/billing/invoices/${invoice._id}/pay`, {})
      .subscribe({
        next: (res) => {
          if (res?.url) {
            window.location.href = res.url;
          } else {
            this.paying.set(null);
            this.snackBar.open(
              'Unable to initiate payment. Please try again.',
              'Dismiss',
              { duration: 5000 }
            );
          }
        },
        error: () => {
          this.paying.set(null);
          this.snackBar.open(
            'Payment request failed. Please try again.',
            'Dismiss',
            { duration: 5000 }
          );
        },
      });
  }

  planPrice(planKey: string): string {
    const match = this.availablePlans().find((p) => p.key === planKey?.toLowerCase());
    if (match) return this.formatMoney(match.priceMonthly) + '/mo';
    // Fallback for orgs whose plan key has no DB record yet
    const fallback: Record<string, string> = {
      starter: 'CAD $299/mo',
      growth: 'CAD $599/mo',
      professional: 'CAD $999/mo',
      enterprise: 'Custom pricing',
    };
    return fallback[planKey?.toLowerCase()] ?? '—';
  }

  planColor(plan: string): string {
    const colors: Record<string, string> = {
      starter: '#16a34a',
      professional: '#7c3aed',
      enterprise: '#1B2A47',
    };
    return colors[plan?.toLowerCase()] ?? '#6b7280';
  }

  planColorBg(plan: string): string {
    const colors: Record<string, string> = {
      starter: '#f0fdf4',
      professional: '#f5f3ff',
      enterprise: '#f1f5f9',
    };
    return colors[plan?.toLowerCase()] ?? '#f3f4f6';
  }

  usagePercent(orgData: OrgPlan): number {
    if (!orgData.maxUsers || orgData.maxUsers === 0) return 0;
    return Math.min(100, Math.round(((orgData.currentUsers ?? 0) / orgData.maxUsers) * 100));
  }

  isTrialActive(trialEndsAt?: string): boolean {
    if (!trialEndsAt) return false;
    return new Date(trialEndsAt).getTime() > Date.now();
  }

  /** Format a value stored as cents (integer) to CAD string, e.g. 59900 → "CAD $599.00" */
  formatMoney(cents: number): string {
    return 'CAD ' + new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(cents / 100);
  }

  downloadPdf(invoice: Invoice): void {
    const org = this.org();

    // Resolve billing address: prefer snapshot on invoice, fall back to org
    const addr: BillingAddress = invoice.billingAddress ?? org?.billingAddress ?? {};
    const addrLines = [
      addr.line1,
      addr.line2,
      [addr.postalCode, addr.city].filter(Boolean).join(' '),
      addr.state,
      addr.country,
    ].filter(Boolean);

    const taxId = invoice.taxId ?? org?.taxId ?? '';

    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const fmtMoney = (cents: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency ?? 'USD' }).format(cents / 100);

    const statusColors: Record<string, string> = {
      draft: '#6b7280', sent: '#3b82f6', paid: '#16a34a', overdue: '#ef4444', void: '#9ca3af',
    };
    const statusColor = statusColors[invoice.status] ?? '#6b7280';

    const lineItemRows = invoice.lineItems.map((item) => `
      <tr>
        <td class="td-desc">${this.escHtml(item.description)}</td>
        <td class="td-num">${item.quantity}</td>
        <td class="td-num">${fmtMoney(item.unitPrice)}</td>
        <td class="td-num td-amount">${fmtMoney(item.amount)}</td>
      </tr>
    `).join('');

    const taxLabel = invoice.taxRate > 0
      ? `Tax (${(invoice.taxRate * 100).toFixed(1).replace(/\.0$/, '')}%)`
      : 'Tax';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    @page { size: A4; margin: 20mm 18mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #2d3748; background: #fff; }

    /* ── Header ── */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
    .brand { display: flex; flex-direction: column; gap: 2px; }
    .brand-name { font-size: 20px; font-weight: 700; color: #1B2A47; letter-spacing: -0.3px; }
    .brand-sub { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; }
    .invoice-label { text-align: right; }
    .invoice-title { font-size: 28px; font-weight: 800; color: #1B2A47; letter-spacing: -1px; }
    .invoice-number { font-size: 13px; color: #6b7280; margin-top: 4px; font-family: 'Courier New', monospace; }
    .status-pill {
      display: inline-block; margin-top: 8px;
      padding: 3px 12px; border-radius: 20px;
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      color: white; background: ${statusColor};
    }

    /* ── Parties ── */
    .parties { display: flex; gap: 48px; margin-bottom: 32px; }
    .party { flex: 1; }
    .party-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 6px; }
    .party-name { font-size: 14px; font-weight: 700; color: #1B2A47; margin-bottom: 4px; }
    .party-addr { font-size: 11px; color: #6b7280; line-height: 1.7; }
    .taxid { font-size: 10px; color: #9ca3af; margin-top: 4px; }

    /* ── Meta grid ── */
    .meta-grid { display: flex; gap: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 32px; }
    .meta-cell { flex: 1; padding: 12px 16px; border-right: 1px solid #e5e7eb; background: #fafafa; }
    .meta-cell:last-child { border-right: none; }
    .meta-cell-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; margin-bottom: 4px; }
    .meta-cell-value { font-size: 12px; font-weight: 600; color: #1B2A47; }
    .overdue-val { color: #ef4444; }

    /* ── Line items ── */
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .items-table thead tr { background: #1B2A47; }
    .items-table thead th { padding: 10px 14px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: #ffffff; text-align: left; }
    .items-table thead th.th-num { text-align: right; }
    .items-table tbody tr { border-bottom: 1px solid #f1f5f9; }
    .items-table tbody tr:last-child { border-bottom: 2px solid #e5e7eb; }
    .items-table td { padding: 10px 14px; font-size: 12px; color: #374151; }
    .td-num { text-align: right; }
    .td-amount { font-weight: 600; }

    /* ── Totals ── */
    .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
    .totals-box { width: 260px; }
    .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; color: #6b7280; }
    .total-row.grand { border-top: 2px solid #1B2A47; margin-top: 4px; padding-top: 10px; }
    .total-row.grand .total-label, .total-row.grand .total-val { font-size: 16px; font-weight: 800; color: #1B2A47; }
    .total-val { font-weight: 600; color: #1B2A47; }

    /* ── Notes ── */
    .notes { background: #f8fafc; border-left: 3px solid #3A9FD6; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 32px; }
    .notes-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; margin-bottom: 4px; }
    .notes-text { font-size: 11px; color: #6b7280; line-height: 1.6; }

    /* ── Footer ── */
    .footer { border-top: 1px solid #e5e7eb; padding-top: 16px; display: flex; justify-content: space-between; align-items: center; }
    .footer-left { font-size: 10px; color: #9ca3af; line-height: 1.6; }
    .footer-right { font-size: 10px; color: #9ca3af; text-align: right; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }

    /* ── Print button (screen only) ── */
    .print-bar {
      position: fixed; top: 0; left: 0; right: 0;
      background: #1B2A47; padding: 12px 24px;
      display: flex; justify-content: space-between; align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 100;
    }
    .print-bar span { color: white; font-size: 13px; font-weight: 500; }
    .print-bar button {
      background: #3A9FD6; color: white; border: none; cursor: pointer;
      padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 600;
      display: flex; align-items: center; gap: 8px;
    }
    .print-bar button:hover { background: #2b8bbf; }
    @media screen { body { padding-top: 56px; } }
    @media print { .print-bar { display: none; } body { padding-top: 0; } }
  </style>
</head>
<body>

  <div class="print-bar no-print">
    <span>Invoice ${invoice.invoiceNumber}</span>
    <button onclick="window.print()">⬇ Save as PDF / Print</button>
  </div>

  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="brand-name">People Intelligence</div>
      <div class="brand-sub">powered by HeadSoft</div>
    </div>
    <div class="invoice-label">
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-number">${invoice.invoiceNumber}</div>
      <div><span class="status-pill">${invoice.status.toUpperCase()}</span></div>
    </div>
  </div>

  <!-- Parties -->
  <div class="parties">
    <div class="party">
      <div class="party-label">From</div>
      <div class="party-name">HeadSoft Technology</div>
      <div class="party-addr">
        ARTES<br>
        billing@headsoft.io
      </div>
    </div>
    <div class="party">
      <div class="party-label">Bill To</div>
      <div class="party-name">${this.escHtml(org?.name ?? '')}</div>
      ${addrLines.length ? `<div class="party-addr">${addrLines.map((l) => this.escHtml(l ?? '')).join('<br>')}</div>` : ''}
      ${org?.billingEmail ? `<div class="party-addr">${this.escHtml(org.billingEmail)}</div>` : ''}
      ${taxId ? `<div class="taxid">Tax ID: ${this.escHtml(taxId)}</div>` : ''}
    </div>
  </div>

  <!-- Meta grid -->
  <div class="meta-grid">
    <div class="meta-cell">
      <div class="meta-cell-label">Invoice Date</div>
      <div class="meta-cell-value">${fmtDate(invoice.createdAt)}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-cell-label">Billing Period</div>
      <div class="meta-cell-value">${fmtDate(invoice.period.from)} – ${fmtDate(invoice.period.to)}</div>
    </div>
    <div class="meta-cell">
      <div class="meta-cell-label">Due Date</div>
      <div class="meta-cell-value${invoice.status === 'overdue' ? ' overdue-val' : ''}">${fmtDate(invoice.dueDate)}</div>
    </div>
    ${invoice.paidAt ? `
    <div class="meta-cell">
      <div class="meta-cell-label">Paid On</div>
      <div class="meta-cell-value" style="color:#16a34a;">${fmtDate(invoice.paidAt)}</div>
    </div>` : ''}
  </div>

  <!-- Line Items -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:55%">Description</th>
        <th class="th-num" style="width:10%">Qty</th>
        <th class="th-num" style="width:17%">Unit Price</th>
        <th class="th-num" style="width:18%">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-box">
      <div class="total-row">
        <span class="total-label">Subtotal</span>
        <span class="total-val">${fmtMoney(invoice.subtotal)}</span>
      </div>
      ${invoice.tax > 0 ? `
      <div class="total-row">
        <span class="total-label">${taxLabel}</span>
        <span class="total-val">${fmtMoney(invoice.tax)}</span>
      </div>` : ''}
      <div class="total-row grand">
        <span class="total-label">Total</span>
        <span class="total-val">${fmtMoney(invoice.total)}</span>
      </div>
    </div>
  </div>

  ${invoice.notes ? `
  <div class="notes">
    <div class="notes-label">Notes</div>
    <div class="notes-text">${this.escHtml(invoice.notes)}</div>
  </div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      ARTES — HeadSoft Technology<br>
      billing@headsoft.io
    </div>
    <div class="footer-right">
      ${invoice.invoiceNumber}<br>
      Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
  </div>

</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      this.snackBar.open('Pop-up blocked — please allow pop-ups to download invoices', 'Dismiss', { duration: 5000 });
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  private escHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
