import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ApiService } from '../../../core/api.service';
import { TranslateModule } from '@ngx-translate/core';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface OrgRef {
  _id: string;
  name: string;
  billingEmail?: string;
  plan?: string;
}

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
  organizationId: OrgRef | string;
  invoiceNumber: string;
  period: { from: string; to: string };
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  taxBreakdown?: TaxBreakdown;
  taxLabel?: string;
  total: number;
  taxRate: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  dueDate: string;
  billingAddress?: BillingAddress;
  taxId?: string;
  paidAt?: string;
  sentAt?: string;
  notes?: string;
  createdAt: string;
}

interface OrgOption {
  _id: string;
  name: string;
  plan: string;
  billingEmail?: string;
  billingAddress?: BillingAddress;
  taxId?: string;
  taxExempt?: boolean;
}

interface AvailablePlan {
  _id: string;
  key: string;
  name: string;
  priceMonthly: number;
  overagePriceCents: number;
  maxUsers: number;
  features: string[];
}

interface TaxRatesInfo {
  gst: number;
  hst: number;
  pst: number;
  qst: number;
  combined: number;
  label: string;
}

// Standard VAT/GST rates by country (percentage) — fallback for non-Canadian
const COUNTRY_TAX_RATES: Record<string, number> = {
  AT: 20, AU: 10, BE: 21, CH: 8.1, CZ: 21, DE: 19, DK: 25,
  ES: 21, FI: 25.5, FR: 20, GB: 20, HR: 25, HU: 27, IE: 23, IT: 22,
  NL: 21, NO: 25, PL: 23, PT: 23, RO: 19, SE: 25, SI: 22, SK: 20,
  US: 0,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
  selector: 'app-sa-invoices',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    DatePipe,
    TranslateModule,
  ],
  template: `
    <div class="page">

      <!-- ================================================================
           Page header
           ================================================================ -->
      <div class="page-header">
        <div>
          <h1>{{ "SYSADMIN.invoicesTitle" | translate }}</h1>
          <p>{{ "SYSADMIN.invoicesSubtitle" | translate }}</p>
        </div>
        <button mat-raised-button color="primary" (click)="toggleGenerate()">
          <mat-icon>add</mat-icon> {{ "SYSADMIN.generateInvoice" | translate }}
        </button>
      </div>

      <!-- ================================================================
           Stats bar
           ================================================================ -->
      <div class="stats-bar">
        <div class="stat-card">
          <span class="stat-value">{{ invoices().length }}</span>
          <span class="stat-label">{{ "SYSADMIN.totalInvoices" | translate }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-value blue">{{ outstandingTotal() | currency:'CAD':'symbol':'1.2-2' }}</span>
          <span class="stat-label">{{ "SYSADMIN.outstanding" | translate }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-value green">{{ paidThisMonth() | currency:'CAD':'symbol':'1.2-2' }}</span>
          <span class="stat-label">{{ "SYSADMIN.paidThisMonth" | translate }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" [class.red]="overdueCount() > 0">{{ overdueCount() }}</span>
          <span class="stat-label">{{ "SYSADMIN.overdue" | translate }}</span>
        </div>
      </div>

      <!-- ================================================================
           Generate Invoice panel (slides in below header)
           ================================================================ -->
      @if (showGenerate()) {
        <div class="generate-panel">
          <div class="panel-header">
            <h2>{{ "SYSADMIN.generateNew" | translate }}</h2>
            <button mat-icon-button (click)="showGenerate.set(false)">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="generate-form">
            <!-- Organization -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Organization</mat-label>
              <mat-select [(ngModel)]="genOrgId" (ngModelChange)="onOrgChange($event)">
                @for (org of orgs(); track org._id) {
                  <mat-option [value]="org._id">{{ org.name }} ({{ org.plan }})</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <!-- Billing address info (shown after org is selected) -->
            @if (genSelectedOrg()) {
              <div class="org-billing-info">
                <div class="org-billing-row">
                  <mat-icon>location_on</mat-icon>
                  <div class="org-billing-detail">
                    @if (genSelectedOrg()!.billingAddress?.line1) {
                      <span>{{ genSelectedOrg()!.billingAddress!.line1 }}</span>
                    }
                    @if (genSelectedOrg()!.billingAddress?.line2) {
                      <span>{{ genSelectedOrg()!.billingAddress!.line2 }}</span>
                    }
                    @if (genSelectedOrg()!.billingAddress?.city || genSelectedOrg()!.billingAddress?.postalCode) {
                      <span>{{ genSelectedOrg()!.billingAddress?.postalCode }} {{ genSelectedOrg()!.billingAddress?.city }}</span>
                    }
                    @if (genSelectedOrg()!.billingAddress?.state) {
                      <span>{{ genSelectedOrg()!.billingAddress!.state }}</span>
                    }
                    @if (genSelectedOrg()!.billingAddress?.country) {
                      <span class="country-badge">{{ genSelectedOrg()!.billingAddress!.country }}</span>
                    } @else {
                      <span class="missing-address">No billing address on file — set it in Organization settings</span>
                    }
                  </div>
                </div>
                @if (genSelectedOrg()!.taxId) {
                  <div class="org-billing-row">
                    <mat-icon>receipt</mat-icon>
                    <span>Tax ID: <strong>{{ genSelectedOrg()!.taxId }}</strong></span>
                  </div>
                }
                @if (genTaxInfo) {
                  <div class="org-billing-row tax-suggestion">
                    <mat-icon>auto_fix_high</mat-icon>
                    <span>
                      {{ genSelectedOrg()!.billingAddress!.country }}
                      @if (genSelectedOrg()!.billingAddress?.state) {
                        / {{ genSelectedOrg()!.billingAddress!.state }}
                      }
                      — <strong>{{ genTaxInfo.label }}</strong>
                    </span>
                  </div>
                } @else if (genSelectedOrg()!.billingAddress?.country && genTaxRate > 0) {
                  <div class="org-billing-row tax-suggestion">
                    <mat-icon>auto_fix_high</mat-icon>
                    <span>
                      {{ genSelectedOrg()!.billingAddress!.country }}:
                      <strong>{{ genTaxLabel || (genTaxRate + '%') }}</strong>
                    </span>
                  </div>
                }
                @if (selectedPlan(); as sp) {
                  <div class="org-billing-row plan-info">
                    <mat-icon>sell</mat-icon>
                    <span>
                      <strong>{{ sp.name }}</strong> plan —
                      {{ formatAmount(sp.priceMonthly) }}/mo base ·
                      {{ sp.maxUsers }} seats incl. ·
                      {{ formatAmount(sp.overagePriceCents) }}/extra user
                    </span>
                  </div>
                }
              </div>
            }

            <div class="form-row">
              <!-- Period From -->
              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Period From</mat-label>
                <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="genPeriodFrom" />
                <mat-datepicker-toggle matIconSuffix [for]="pickerFrom" />
                <mat-datepicker #pickerFrom />
              </mat-form-field>

              <!-- Period To -->
              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Period To</mat-label>
                <input matInput [matDatepicker]="pickerTo" [(ngModel)]="genPeriodTo" />
                <mat-datepicker-toggle matIconSuffix [for]="pickerTo" />
                <mat-datepicker #pickerTo />
              </mat-form-field>
            </div>

            <!-- Tax -->
            <div class="tax-section">
              <div class="tax-section-header">
                <mat-icon>receipt_long</mat-icon>
                <span>Taxation</span>
                <label class="tax-exempt-toggle">
                  <input type="checkbox" [(ngModel)]="genTaxExempt" (ngModelChange)="onTaxExemptChange()" />
                  Tax Exempt (e.g. Indigenous)
                </label>
              </div>
              @if (!genTaxExempt) {
                <div class="tax-fields">
                  @if (genTaxInfo) {
                    <div class="tax-auto-label">
                      <mat-icon>auto_fix_high</mat-icon>
                      <span>{{ genTaxInfo.label }} — auto-detected from billing address</span>
                    </div>
                  }
                  <div class="form-row">
                    @if (genTaxInfo?.isHST) {
                      <mat-form-field appearance="outline" class="half-width">
                        <mat-label>HST (%)</mat-label>
                        <input matInput type="number" [(ngModel)]="genHST" min="0" max="100" step="0.1" />
                      </mat-form-field>
                    } @else {
                      <mat-form-field appearance="outline" class="half-width">
                        <mat-label>GST (%)</mat-label>
                        <input matInput type="number" [(ngModel)]="genGST" min="0" max="100" step="0.1" />
                      </mat-form-field>
                      @if (genTaxInfo?.hasQST) {
                        <mat-form-field appearance="outline" class="half-width">
                          <mat-label>QST (%)</mat-label>
                          <input matInput type="number" [(ngModel)]="genQST" min="0" max="100" step="0.001" />
                        </mat-form-field>
                      } @else if (genTaxInfo?.hasPST) {
                        <mat-form-field appearance="outline" class="half-width">
                          <mat-label>PST (%)</mat-label>
                          <input matInput type="number" [(ngModel)]="genPST" min="0" max="100" step="0.1" />
                        </mat-form-field>
                      } @else if (!genTaxInfo) {
                        <mat-form-field appearance="outline" class="half-width">
                          <mat-label>Tax Rate (%)</mat-label>
                          <input matInput type="number" [(ngModel)]="genTaxRate" min="0" max="100" step="0.1" />
                        </mat-form-field>
                      }
                    }
                  </div>
                </div>
              } @else {
                <div class="tax-exempt-note">
                  <mat-icon>info</mat-icon>
                  <span>No tax will be applied to this invoice.</span>
                </div>
              }
            </div>

            <!-- Notes -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'SYSADMIN.notes' | translate }}</mat-label>
              <textarea matInput [(ngModel)]="genNotes" rows="3" [placeholder]="'SYSADMIN.invoiceNotesPlaceholder' | translate"></textarea>
            </mat-form-field>

            <!-- Preview result -->
            @if (previewInvoice()) {
              <div class="preview-result">
                <div class="preview-header">
                  <mat-icon class="preview-icon">receipt</mat-icon>
                  <span>Preview — {{ previewInvoice()!.invoiceNumber }}</span>
                </div>
                <div class="preview-totals">
                  <span>Subtotal: <strong>{{ (previewInvoice()!.subtotal / 100) | currency:'CAD':'symbol':'1.2-2' }}</strong></span>
                  @if (previewInvoice()!.taxBreakdown?.gst) {
                    <span>GST (5%): <strong>{{ (previewInvoice()!.taxBreakdown!.gst / 100) | currency:'CAD':'symbol':'1.2-2' }}</strong></span>
                  }
                  @if (previewInvoice()!.taxBreakdown?.hst) {
                    <span>HST: <strong>{{ (previewInvoice()!.taxBreakdown!.hst / 100) | currency:'CAD':'symbol':'1.2-2' }}</strong></span>
                  }
                  @if (previewInvoice()!.taxBreakdown?.pst) {
                    <span>PST: <strong>{{ (previewInvoice()!.taxBreakdown!.pst / 100) | currency:'CAD':'symbol':'1.2-2' }}</strong></span>
                  }
                  @if (previewInvoice()!.taxBreakdown?.qst) {
                    <span>QST (9.975%): <strong>{{ (previewInvoice()!.taxBreakdown!.qst / 100) | currency:'CAD':'symbol':'1.2-2' }}</strong></span>
                  }
                  @if (previewInvoice()!.tax > 0 && !previewInvoice()!.taxBreakdown) {
                    <span>Tax ({{ previewInvoice()!.taxRate * 100 | number:'1.0-1' }}%): <strong>{{ (previewInvoice()!.tax / 100) | currency:'CAD':'symbol':'1.2-2' }}</strong></span>
                  }
                  @if (previewInvoice()!.taxLabel) {
                    <span class="tax-label-hint">{{ previewInvoice()!.taxLabel }}</span>
                  }
                  <span>Total: <strong class="total-amount">{{ (previewInvoice()!.total / 100) | currency:'CAD':'symbol':'1.2-2' }}</strong></span>
                </div>
              </div>
            }

            <!-- Actions -->
            <div class="form-actions">
              <button mat-stroked-button (click)="previewGenerate()" [disabled]="generating()">
                @if (generating()) {
                  <mat-spinner diameter="16" />
                } @else {
                  <mat-icon>visibility</mat-icon>
                }
                Preview
              </button>
              <button mat-raised-button color="primary" (click)="submitGenerate()" [disabled]="generating() || !genOrgId || !genPeriodFrom || !genPeriodTo">
                @if (generating()) {
                  <mat-spinner diameter="16" />
                } @else {
                  <mat-icon>send</mat-icon>
                }
                Generate &amp; Save
              </button>
              <button mat-button (click)="cancelGenerate()">Cancel</button>
            </div>
          </div>
        </div>
      }

      <!-- ================================================================
           Filters row
           ================================================================ -->
      <div class="filters">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [(ngModel)]="searchQuery" (ngModelChange)="onFilterChange()" [placeholder]="'SYSADMIN.invoiceSearchPlaceholder' | translate" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="status-select">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="statusFilter" (ngModelChange)="onFilterChange()">
            <mat-option value="">All</mat-option>
            <mat-option value="draft">Draft</mat-option>
            <mat-option value="sent">Sent</mat-option>
            <mat-option value="paid">Paid</mat-option>
            <mat-option value="overdue">Overdue</mat-option>
            <mat-option value="void">Void</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <!-- ================================================================
           Main content area: table + side panel
           ================================================================ -->
      <div class="content-area" [class.panel-open]="selectedInvoice() !== null">

        <!-- Table -->
        @if (loading()) {
          <div class="loading-center">
            <mat-spinner diameter="36" />
          </div>
        } @else {
          <div class="table-wrap">

            <!-- Table header -->
            <div class="table-header-row">
              <div class="col-invoice-num">Invoice #</div>
              <div class="col-org">Organization</div>
              <div class="col-period">Period</div>
              <div class="col-amount">Amount</div>
              <div class="col-status">Status</div>
              <div class="col-due">Due Date</div>
              <div class="col-sent">Sent</div>
              <div class="col-actions">Actions</div>
            </div>

            <!-- Table rows -->
            @for (invoice of filteredInvoices(); track invoice._id) {
              <div
                class="table-row"
                [class.selected]="selectedInvoice()?._id === invoice._id"
                (click)="selectInvoice(invoice)"
              >
                <!-- Invoice number -->
                <div class="col-invoice-num">
                  <span class="invoice-num-link">{{ invoice.invoiceNumber }}</span>
                </div>

                <!-- Organization -->
                <div class="col-org">
                  <span class="org-name">{{ orgName(invoice) }}</span>
                  @if (orgBillingEmail(invoice)) {
                    <span class="org-email">{{ orgBillingEmail(invoice) }}</span>
                  }
                </div>

                <!-- Period -->
                <div class="col-period">
                  <span class="period-text">
                    {{ invoice.period.from | date:'MMM d' }} – {{ invoice.period.to | date:'MMM d, y' }}
                  </span>
                </div>

                <!-- Amount -->
                <div class="col-amount">
                  <span class="amount-text">{{ formatAmount(invoice.total) }}</span>
                </div>

                <!-- Status -->
                <div class="col-status">
                  <span class="status-badge" [class]="invoice.status">{{ invoice.status }}</span>
                </div>

                <!-- Due Date -->
                <div class="col-due">
                  <span [class.overdue-text]="isOverdueDate(invoice)">{{ invoice.dueDate | date:'MMM d, y' }}</span>
                </div>

                <!-- Sent -->
                <div class="col-sent">
                  @if (invoice.sentAt) {
                    <span class="sent-date">{{ invoice.sentAt | date:'MMM d, y' }}</span>
                  } @else {
                    <span class="not-sent">—</span>
                  }
                </div>

                <!-- Actions (stop propagation so row click doesn't fire) -->
                <div class="col-actions" (click)="$event.stopPropagation()">
                  @if (canSend(invoice)) {
                    <button
                      mat-icon-button
                      [matTooltip]="'SYSADMIN.sendInvoice' | translate"
                      [disabled]="sending() === invoice._id"
                      (click)="sendInvoice(invoice)"
                    >
                      @if (sending() === invoice._id) {
                        <mat-spinner diameter="16" />
                      } @else {
                        <mat-icon class="action-icon send-icon">email</mat-icon>
                      }
                    </button>
                  }
                  @if (canMarkPaid(invoice)) {
                    <button
                      mat-icon-button
                      [matTooltip]="'SYSADMIN.markAsPaid' | translate"
                      (click)="markPaid(invoice)"
                    >
                      <mat-icon class="action-icon paid-icon">check_circle</mat-icon>
                    </button>
                  }
                  @if (canVoid(invoice)) {
                    <button
                      mat-icon-button
                      [matTooltip]="'SYSADMIN.voidInvoice' | translate"
                      (click)="voidInvoice(invoice)"
                    >
                      <mat-icon class="action-icon void-icon">cancel</mat-icon>
                    </button>
                  }
                </div>
              </div>
            }

            @if (filteredInvoices().length === 0) {
              <div class="no-results">
                <mat-icon>receipt_long</mat-icon>
                <span>{{ "SYSADMIN.noInvoicesMatch" | translate }}</span>
              </div>
            }
          </div>
        }

        <!-- ==============================================================
             Invoice detail side panel
             ============================================================== -->
        @if (selectedInvoice()) {
          <div class="side-panel">
            <div class="side-panel-header">
              <div class="side-panel-title">
                <span class="side-invoice-num">{{ selectedInvoice()!.invoiceNumber }}</span>
                <span class="status-badge" [class]="selectedInvoice()!.status">{{ selectedInvoice()!.status }}</span>
              </div>
              <button mat-icon-button (click)="selectedInvoice.set(null)">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="side-panel-body">

              <!-- Org info -->
              <div class="detail-section">
                <div class="detail-label">Organization</div>
                <div class="detail-value org-detail-name">{{ orgName(selectedInvoice()!) }}</div>
                @if (orgBillingEmail(selectedInvoice()!)) {
                  <div class="detail-value org-detail-email">{{ orgBillingEmail(selectedInvoice()!) }}</div>
                }
              </div>

              <mat-divider />

              <!-- Period -->
              <div class="detail-section">
                <div class="detail-label">Billing Period</div>
                <div class="detail-value">
                  {{ selectedInvoice()!.period.from | date:'MMMM d, y' }}
                  &nbsp;—&nbsp;
                  {{ selectedInvoice()!.period.to | date:'MMMM d, y' }}
                </div>
              </div>

              <mat-divider />

              <!-- Due / paid dates -->
              <div class="detail-section dates-row">
                <div class="date-item">
                  <div class="detail-label">Due Date</div>
                  <div class="detail-value" [class.overdue-text]="isOverdueDate(selectedInvoice()!)">
                    {{ selectedInvoice()!.dueDate | date:'MMM d, y' }}
                  </div>
                </div>
                @if (selectedInvoice()!.paidAt) {
                  <div class="date-item">
                    <div class="detail-label">Paid On</div>
                    <div class="detail-value green">{{ selectedInvoice()!.paidAt | date:'MMM d, y' }}</div>
                  </div>
                }
                @if (selectedInvoice()!.sentAt) {
                  <div class="date-item">
                    <div class="detail-label">Sent On</div>
                    <div class="detail-value">{{ selectedInvoice()!.sentAt | date:'MMM d, y' }}</div>
                  </div>
                }
              </div>

              <mat-divider />

              <!-- Line items -->
              <div class="detail-section">
                <div class="detail-label">Line Items</div>
                <div class="line-items-table">
                  <div class="line-item-header">
                    <span class="li-desc">Description</span>
                    <span class="li-qty">Qty</span>
                    <span class="li-unit">Unit Price</span>
                    <span class="li-amount">Amount</span>
                  </div>
                  @for (item of selectedInvoice()!.lineItems; track $index) {
                    <div class="line-item-row">
                      <span class="li-desc">{{ item.description }}</span>
                      <span class="li-qty">{{ item.quantity }}</span>
                      <span class="li-unit">{{ formatAmount(item.unitPrice) }}</span>
                      <span class="li-amount">{{ formatAmount(item.amount) }}</span>
                    </div>
                  }
                </div>
              </div>

              <mat-divider />

              <!-- Totals -->
              <div class="detail-section totals-section">
                <div class="total-row">
                  <span class="total-label">Subtotal</span>
                  <span class="total-value">{{ formatAmount(selectedInvoice()!.subtotal) }}</span>
                </div>
                <div class="total-row">
                  <span class="total-label">Tax ({{ selectedInvoice()!.taxRate }}%)</span>
                  <span class="total-value">{{ formatAmount(selectedInvoice()!.tax) }}</span>
                </div>
                <div class="total-row grand-total">
                  <span class="total-label">Total</span>
                  <span class="total-value">{{ formatAmount(selectedInvoice()!.total) }}</span>
                </div>
              </div>

              <!-- Notes -->
              @if (selectedInvoice()!.notes) {
                <mat-divider />
                <div class="detail-section">
                  <div class="detail-label">Notes</div>
                  <div class="notes-text">{{ selectedInvoice()!.notes }}</div>
                </div>
              }

              <mat-divider />

              <!-- Side panel action buttons -->
              <div class="side-panel-actions">
                @if (canSend(selectedInvoice()!)) {
                  <button
                    mat-stroked-button
                    class="action-btn send-btn"
                    [disabled]="sending() === selectedInvoice()!._id"
                    (click)="sendInvoice(selectedInvoice()!)"
                  >
                    @if (sending() === selectedInvoice()!._id) {
                      <mat-spinner diameter="16" />
                    } @else {
                      <mat-icon>email</mat-icon>
                    }
                    Send Email
                  </button>
                }
                @if (canMarkPaid(selectedInvoice()!)) {
                  <button
                    mat-stroked-button
                    class="action-btn mark-paid-btn"
                    (click)="markPaid(selectedInvoice()!)"
                  >
                    <mat-icon>check_circle</mat-icon>
                    Mark as Paid
                  </button>
                }
                @if (canVoid(selectedInvoice()!)) {
                  <button
                    mat-stroked-button
                    class="action-btn void-btn"
                    (click)="voidInvoice(selectedInvoice()!)"
                  >
                    <mat-icon>cancel</mat-icon>
                    Void
                  </button>
                }
              </div>

            </div>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    /* =======================================================================
       Page layout
       ======================================================================= */
    .page {
      padding: 32px;
      max-width: 1400px;
      position: relative;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;

      h1 {
        font-size: 28px;
        color: var(--artes-primary);
        margin: 0 0 4px;
        font-weight: 700;
      }

      p {
        color: #5a6a7e;
        margin: 0;
        font-size: 14px;
      }
    }

    /* =======================================================================
       Stats bar
       ======================================================================= */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.07);
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .stat-value {
      font-size: 26px;
      font-weight: 700;
      color: var(--artes-primary);

      &.blue  { color: var(--artes-accent); }
      &.green { color: #27C4A0; }
      &.red   { color: #e53e3e; }
    }

    .stat-label {
      font-size: 11px;
      color: #9aa5b4;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    /* =======================================================================
       Generate Invoice panel
       ======================================================================= */
    .generate-panel {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 16px rgba(0, 0, 0, 0.10);
      margin-bottom: 24px;
      overflow: hidden;
      border-top: 3px solid #3A9FD6;
      animation: slideDown 0.2s ease;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px 16px;
      border-bottom: 1px solid #eef2f7;

      h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: var(--artes-primary);
      }
    }

    .generate-form {
      padding: 20px 24px 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .full-width  { width: 100%; }
    .half-width  { flex: 1; }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .org-billing-info {
      background: #f8fafb;
      border: 1px solid #dce6f0;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 4px;
    }

    .org-billing-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 13px;
      color: #5a6a7e;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: var(--artes-accent);
        flex-shrink: 0;
        margin-top: 2px;
      }
    }

    .org-billing-detail {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .country-badge {
      display: inline-block;
      background: var(--artes-primary);
      color: white;
      font-size: 11px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      width: fit-content;
    }

    .missing-address {
      color: #e86c3a;
      font-style: italic;
      font-size: 12px;
    }

    .tax-suggestion {
      color: #1a9678;
      mat-icon { color: #1a9678; }
    }

    .preview-result {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 14px 18px;
    }

    .preview-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      color: var(--artes-primary);
      margin-bottom: 10px;
    }

    .preview-icon {
      color: var(--artes-accent);
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .preview-totals {
      display: flex;
      gap: 24px;
      font-size: 13px;
      color: #5a6a7e;

      strong { color: var(--artes-primary); }

      .total-amount { color: #27C4A0; font-size: 15px; }
    }

    .form-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-top: 8px;

      mat-spinner { margin-right: 6px; }
    }

    /* =======================================================================
       Filters
       ======================================================================= */
    .filters {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      align-items: center;

      .search-field  { flex: 1; }
      .status-select { width: 180px; }

      mat-form-field { font-size: 14px; }
    }

    /* =======================================================================
       Content area (table + side panel)
       ======================================================================= */
    .content-area {
      display: flex;
      gap: 0;
      align-items: flex-start;
      position: relative;
    }

    .content-area.panel-open .table-wrap {
      margin-right: 436px;
    }

    /* =======================================================================
       Invoice table (custom div-based)
       ======================================================================= */
    .loading-center {
      display: flex;
      justify-content: center;
      padding: 64px;
      flex: 1;
    }

    .table-wrap {
      flex: 1;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.07);
      overflow: hidden;
      transition: margin-right 0.25s ease;
    }

    /* Shared column widths */
    .table-header-row,
    .table-row {
      display: grid;
      grid-template-columns:
        140px          /* invoice # */
        1fr            /* org */
        150px          /* period */
        100px          /* amount */
        90px           /* status */
        110px          /* due date */
        110px          /* sent */
        120px;         /* actions */
      align-items: center;
      padding: 0 16px;
    }

    .table-header-row {
      background: #f8fafc;
      border-bottom: 1px solid #eef2f7;
      height: 44px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #9aa5b4;
    }

    .table-row {
      min-height: 60px;
      border-bottom: 1px solid #f0f4f8;
      cursor: pointer;
      transition: background 0.12s;

      &:last-child { border-bottom: none; }
      &:hover      { background: #f8fbff; }
      &.selected   { background: #ebf8ff; }
    }

    /* Column classes */
    .col-invoice-num { }
    .col-org         { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
    .col-period      { }
    .col-amount      { font-weight: 600; color: var(--artes-primary); }
    .col-status      { }
    .col-due         { font-size: 13px; color: #5a6a7e; }
    .col-sent        { font-size: 13px; color: #5a6a7e; }
    .col-actions     { display: flex; align-items: center; gap: 0; }

    .invoice-num-link {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      font-weight: 700;
      color: var(--artes-accent);
      letter-spacing: 0.3px;
    }

    .org-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--artes-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .org-email {
      font-size: 11px;
      color: #9aa5b4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .period-text {
      font-size: 12px;
      color: #5a6a7e;
    }

    .amount-text {
      font-size: 14px;
    }

    .sent-date { font-size: 12px; }
    .not-sent  { color: #d1d9e3; }

    .overdue-text {
      color: #e53e3e;
      font-weight: 600;
    }

    /* =======================================================================
       Status badges
       ======================================================================= */
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: capitalize;
      letter-spacing: 0.2px;

      &.draft   { background: #f1f4f8;                      color: #5a6a7e; }
      &.sent    { background: rgba(58, 159, 214, 0.12);     color: #1a6b9a; }
      &.paid    { background: rgba(39, 196, 160, 0.14);     color: #1a7a60; }
      &.overdue { background: rgba(229, 62, 62, 0.12);      color: #c53030; }
      &.void    {
        background: #f1f4f8;
        color: #9aa5b4;
        text-decoration: line-through;
      }
    }

    /* =======================================================================
       Action icon buttons
       ======================================================================= */
    .action-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;

      &.send-icon  { color: var(--artes-accent); }
      &.paid-icon  { color: #27C4A0; }
      &.void-icon  { color: #e53e3e; }
    }

    /* =======================================================================
       No results
       ======================================================================= */
    .no-results {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 56px;
      color: #9aa5b4;
      font-size: 14px;

      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }

    /* =======================================================================
       Side panel
       ======================================================================= */
    .side-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: 420px;
      height: 100vh;
      background: white;
      box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
      z-index: 200;
      animation: slideInRight 0.22s ease;
      overflow: hidden;
    }

    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);   opacity: 1; }
    }

    .side-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 20px 16px;
      border-bottom: 1px solid #eef2f7;
      flex-shrink: 0;
      background: #f8fafc;
    }

    .side-panel-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .side-invoice-num {
      font-family: 'Courier New', Courier, monospace;
      font-size: 15px;
      font-weight: 700;
      color: var(--artes-primary);
    }

    .side-panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 0;

      mat-divider {
        margin: 0;
      }
    }

    .detail-section {
      padding: 16px 20px;
    }

    .detail-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #9aa5b4;
      margin-bottom: 6px;
    }

    .detail-value {
      font-size: 14px;
      color: var(--artes-primary);

      &.green { color: #27C4A0; font-weight: 600; }
    }

    .org-detail-name {
      font-weight: 700;
      font-size: 15px;
    }

    .org-detail-email {
      font-size: 12px;
      color: #5a6a7e;
      margin-top: 2px;
    }

    .dates-row {
      display: flex;
      gap: 24px;
    }

    .date-item {
      display: flex;
      flex-direction: column;
    }

    /* Line items mini-table */
    .line-items-table {
      border: 1px solid #eef2f7;
      border-radius: 8px;
      overflow: hidden;
      font-size: 12px;
    }

    .line-item-header,
    .line-item-row {
      display: grid;
      grid-template-columns: 1fr 44px 80px 80px;
      gap: 4px;
      padding: 8px 10px;
    }

    .line-item-header {
      background: #f8fafc;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #9aa5b4;
      border-bottom: 1px solid #eef2f7;
    }

    .line-item-row {
      border-bottom: 1px solid #f4f7fb;
      color: #3a4a5c;

      &:last-child { border-bottom: none; }
    }

    .li-desc   { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .li-qty    { text-align: center; color: #5a6a7e; }
    .li-unit   { text-align: right; color: #5a6a7e; }
    .li-amount { text-align: right; font-weight: 600; color: var(--artes-primary); }

    /* Totals */
    .totals-section {
      background: #fafbfd;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      font-size: 13px;
      color: #5a6a7e;

      &.grand-total {
        padding-top: 10px;
        margin-top: 4px;
        border-top: 2px solid #eef2f7;
        font-size: 16px;
        font-weight: 700;
        color: var(--artes-primary);
      }
    }

    .total-label  { }
    .total-value  { font-weight: 600; color: var(--artes-primary); }

    /* Notes */
    .notes-text {
      font-size: 13px;
      color: #5a6a7e;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    /* Side panel action buttons */
    .side-panel-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px 20px 24px;
    }

    .action-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: flex-start;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      mat-spinner { margin-right: 4px; }
    }

    .send-btn      { color: var(--artes-accent); border-color: var(--artes-accent); }
    .mark-paid-btn { color: #27C4A0; border-color: #27C4A0; }
    .void-btn      { color: #e53e3e; border-color: #e53e3e; }

    .plan-info { background: #f0fdf4; border-radius: 6px; padding: 4px 8px; }
    .plan-info mat-icon { color: #27C4A0 !important; }

    /* Tax section */
    .tax-section {
      background: #f8fafc; border-radius: 10px; padding: 14px 16px;
      border: 1px solid #e8eef4;
    }
    .tax-section-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
      font-size: 13px; font-weight: 600; color: var(--artes-primary);
      mat-icon { font-size: 18px; color: var(--artes-accent); }
    }
    .tax-exempt-toggle {
      margin-left: auto; display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 400; color: #5a6a7e; cursor: pointer;
      input[type=checkbox] { accent-color: #e86c3a; }
    }
    .tax-fields { display: flex; flex-direction: column; gap: 8px; }
    .tax-auto-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #27C4A0; margin-bottom: 4px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #27C4A0; }
    }
    .tax-exempt-note {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; color: #9aa5b4; font-style: italic;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .tax-label-hint { font-size: 11px; color: #9aa5b4; font-style: italic; }
  `],
})
export class InvoicesComponent implements OnInit {

  // -------------------------------------------------------------------------
  // Signals & state
  // -------------------------------------------------------------------------

  invoices  = signal<Invoice[]>([]);
  orgs      = signal<OrgOption[]>([]);
  plans     = signal<AvailablePlan[]>([]);
  loading   = signal(true);
  sending   = signal<string | null>(null);

  selectedInvoice = signal<Invoice | null>(null);
  showGenerate    = signal(false);

  // Filter state
  searchQuery  = '';
  statusFilter = '';

  // Generate form state
  genOrgId        = '';
  genSelectedOrg  = signal<OrgOption | null>(null);
  genPeriodFrom: Date | null = null;
  genPeriodTo:   Date | null = null;
  genTaxRate    = 0;    // fallback for non-Canadian
  genGST        = 0;
  genHST        = 0;
  genPST        = 0;
  genQST        = 0;
  genTaxExempt  = false;
  genTaxLabel   = '';
  genTaxInfo: { label: string; isHST: boolean; hasQST: boolean; hasPST: boolean } | null = null;
  genNotes      = '';
  generating    = signal(false);
  previewInvoice = signal<Invoice | null>(null);

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------

  filteredInvoices = computed<Invoice[]>(() => {
    const all    = this.invoices();
    const q      = this.searchQuery.toLowerCase().trim();
    const status = this.statusFilter;

    return all.filter((inv) => {
      const matchSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        this.orgName(inv).toLowerCase().includes(q);

      const matchStatus = !status || inv.status === status;

      return matchSearch && matchStatus;
    });
  });

  outstandingTotal = computed<number>(() => {
    return this.invoices()
      .filter((inv) => inv.status === 'sent' || inv.status === 'overdue')
      .reduce((sum, inv) => sum + inv.total, 0) / 100;
  });

  paidThisMonth = computed<number>(() => {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth();

    return this.invoices()
      .filter((inv) => {
        if (inv.status !== 'paid' || !inv.paidAt) return false;
        const paid = new Date(inv.paidAt);
        return paid.getFullYear() === year && paid.getMonth() === month;
      })
      .reduce((sum, inv) => sum + inv.total, 0) / 100;
  });

  overdueCount = computed<number>(() => {
    return this.invoices().filter((inv) => inv.status === 'overdue').length;
  });

  selectedPlan = computed<AvailablePlan | null>(() => {
    const org = this.genSelectedOrg();
    if (!org) return null;
    return this.plans().find((p) => p.key === org.plan) ?? null;
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  constructor(
    private api:   ApiService,
    private snack: MatSnackBar,
  ) {}

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  ngOnInit(): void {
    this.loadInvoices();
    this.loadOrgs();
    this.loadPlans();
  }

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  loadInvoices(): void {
    this.loading.set(true);

    const params: Record<string, string> = {};
    if (this.statusFilter) {
      params['status'] = this.statusFilter;
    }

    this.api.get<Invoice[]>('/system-admin/billing/invoices', params).subscribe({
      next:  (list) => { this.invoices.set(list); this.loading.set(false); },
      error: ()     => { this.loading.set(false); this.snack.open('Failed to load invoices', 'Close', { duration: 3000 }); },
    });
  }

  loadOrgs(): void {
    this.api.get<OrgOption[]>('/system-admin/organizations').subscribe({
      next:  (list) => this.orgs.set(list),
      error: ()     => {},
    });
  }

  loadPlans(): void {
    this.api.get<AvailablePlan[]>('/plans/admin').subscribe({
      next:  (list) => this.plans.set(list),
      error: ()     => {},
    });
  }

  // -------------------------------------------------------------------------
  // Filter
  // -------------------------------------------------------------------------

  onFilterChange(): void {
    // filteredInvoices is a computed signal so it recalculates automatically
    // when searchQuery or statusFilter change. However, statusFilter also needs
    // to trigger a server-side reload if desired. Here we reload from server
    // when status filter changes, to stay in sync with the API filter param,
    // but we also have client-side computed for instant response.
  }

  // -------------------------------------------------------------------------
  // Invoice helpers
  // -------------------------------------------------------------------------

  orgName(invoice: Invoice): string {
    if (typeof invoice.organizationId === 'object' && invoice.organizationId !== null) {
      return (invoice.organizationId as OrgRef).name;
    }
    return String(invoice.organizationId);
  }

  orgBillingEmail(invoice: Invoice): string {
    if (typeof invoice.organizationId === 'object' && invoice.organizationId !== null) {
      return (invoice.organizationId as OrgRef).billingEmail ?? '';
    }
    return '';
  }

  formatAmount(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  isOverdueDate(invoice: Invoice): boolean {
    return invoice.status === 'overdue' ||
      (invoice.status !== 'paid' && invoice.status !== 'void' && new Date(invoice.dueDate) < new Date());
  }

  canSend(invoice: Invoice): boolean {
    return invoice.status === 'draft' || invoice.status === 'sent';
  }

  canMarkPaid(invoice: Invoice): boolean {
    return invoice.status === 'sent' || invoice.status === 'overdue';
  }

  canVoid(invoice: Invoice): boolean {
    return invoice.status === 'draft' || invoice.status === 'sent';
  }

  // -------------------------------------------------------------------------
  // Row selection
  // -------------------------------------------------------------------------

  selectInvoice(invoice: Invoice): void {
    if (this.selectedInvoice()?._id === invoice._id) {
      this.selectedInvoice.set(null);
    } else {
      this.selectedInvoice.set(invoice);
    }
  }

  // -------------------------------------------------------------------------
  // Generate invoice panel
  // -------------------------------------------------------------------------

  toggleGenerate(): void {
    this.showGenerate.update((v) => !v);
    if (!this.showGenerate()) {
      this.resetGenerateForm();
    }
  }

  cancelGenerate(): void {
    this.showGenerate.set(false);
    this.resetGenerateForm();
  }

  onOrgChange(orgId: string): void {
    const org = this.orgs().find((o) => o._id === orgId) ?? null;
    this.genSelectedOrg.set(org);
    this.genTaxLabel = '';
    this.genTaxInfo = null;
    this.genGST = 0;
    this.genHST = 0;
    this.genPST = 0;
    this.genQST = 0;
    this.genTaxRate = 0;
    this.genTaxExempt = org?.taxExempt ?? false;
    this.previewInvoice.set(null);

    if (this.genTaxExempt || !org?.billingAddress?.country) return;

    const country = org.billingAddress.country.toUpperCase();
    if (country === 'CA') {
      const province = (org.billingAddress.state || '').toUpperCase();
      this.api.get<TaxRatesInfo>(`/system-admin/billing/tax-rates?country=CA&province=${province}`).subscribe({
        next: (rates) => {
          this.genTaxLabel = rates.label;
          const isHST = rates.hst > 0;
          const hasQST = rates.qst > 0;
          const hasPST = rates.pst > 0;

          this.genTaxInfo = { label: rates.label, isHST, hasQST, hasPST };

          if (isHST) {
            this.genHST = Math.round(rates.hst * 10000) / 100;
          } else {
            this.genGST = Math.round(rates.gst * 10000) / 100;
            if (hasQST) this.genQST = Math.round(rates.qst * 100000) / 1000;
            if (hasPST) this.genPST = Math.round(rates.pst * 10000) / 100;
          }
        },
      });
    } else {
      const suggested = COUNTRY_TAX_RATES[country];
      if (suggested !== undefined) {
        this.genTaxRate = suggested;
        this.genTaxLabel = `VAT ${suggested}%`;
      }
    }
  }

  onTaxExemptChange(): void {
    if (this.genTaxExempt) {
      this.genGST = 0;
      this.genHST = 0;
      this.genPST = 0;
      this.genQST = 0;
      this.genTaxRate = 0;
    } else {
      // Re-fetch rates for the selected org
      if (this.genOrgId) this.onOrgChange(this.genOrgId);
    }
  }

  resetGenerateForm(): void {
    this.genOrgId      = '';
    this.genSelectedOrg.set(null);
    this.genPeriodFrom = null;
    this.genPeriodTo   = null;
    this.genTaxRate    = 0;
    this.genGST        = 0;
    this.genHST        = 0;
    this.genPST        = 0;
    this.genQST        = 0;
    this.genTaxExempt  = false;
    this.genTaxLabel   = '';
    this.genTaxInfo    = null;
    this.genNotes      = '';
    this.previewInvoice.set(null);
  }

  buildGeneratePayload(): Record<string, unknown> {
    // Combine individual tax fields into the single taxRate percentage the backend expects
    // For Canadian orgs the backend auto-calculates from address, so we send 0 to let it auto-detect
    // For non-Canadian we send the manual rate
    const isCanadian = this.genSelectedOrg()?.billingAddress?.country?.toUpperCase() === 'CA';
    const taxRate = this.genTaxExempt ? 0
      : isCanadian ? 0   // backend auto-calculates from address
      : this.genTaxRate;

    return {
      organizationId: this.genOrgId,
      periodFrom: this.genPeriodFrom ? this.genPeriodFrom.toISOString() : null,
      periodTo:   this.genPeriodTo   ? this.genPeriodTo.toISOString()   : null,
      taxRate,
      taxExempt: this.genTaxExempt,
      notes:   this.genNotes || undefined,
    };
  }

  previewGenerate(): void {
    if (!this.genOrgId || !this.genPeriodFrom || !this.genPeriodTo) {
      this.snack.open('Please fill in organization and period fields', 'Close', { duration: 3000 });
      return;
    }

    this.generating.set(true);
    this.api.post<Invoice>('/system-admin/billing/invoices', { ...this.buildGeneratePayload(), preview: true }).subscribe({
      next: (inv) => {
        this.previewInvoice.set(inv);
        this.generating.set(false);
      },
      error: () => {
        this.generating.set(false);
        this.snack.open('Preview failed — check the server logs', 'Close', { duration: 3000 });
      },
    });
  }

  submitGenerate(): void {
    if (!this.genOrgId || !this.genPeriodFrom || !this.genPeriodTo) {
      this.snack.open('Please fill in all required fields', 'Close', { duration: 3000 });
      return;
    }

    this.generating.set(true);
    this.api.post<Invoice>('/system-admin/billing/invoices', this.buildGeneratePayload()).subscribe({
      next: (inv) => {
        this.generating.set(false);
        this.snack.open(`Invoice ${inv.invoiceNumber} created`, 'Close', { duration: 3000 });
        this.showGenerate.set(false);
        this.resetGenerateForm();
        this.loadInvoices();
      },
      error: () => {
        this.generating.set(false);
        this.snack.open('Failed to generate invoice', 'Close', { duration: 3000 });
      },
    });
  }

  // -------------------------------------------------------------------------
  // Invoice actions
  // -------------------------------------------------------------------------

  sendInvoice(invoice: Invoice): void {
    this.sending.set(invoice._id);
    this.api.post<Invoice>(`/system-admin/billing/invoices/${invoice._id}/send`, {}).subscribe({
      next: (updated) => {
        this.sending.set(null);
        this.snack.open(`Invoice ${invoice.invoiceNumber} sent`, 'Close', { duration: 3000 });
        this.replaceInvoiceInList(updated);
        if (this.selectedInvoice()?._id === updated._id) {
          this.selectedInvoice.set(updated);
        }
      },
      error: () => {
        this.sending.set(null);
        this.snack.open('Failed to send invoice', 'Close', { duration: 3000 });
      },
    });
  }

  markPaid(invoice: Invoice): void {
    this.api.put<Invoice>(`/system-admin/billing/invoices/${invoice._id}`, {
      status: 'paid',
      paidAt: new Date(),
    }).subscribe({
      next: (updated) => {
        this.snack.open(`Invoice ${invoice.invoiceNumber} marked as paid`, 'Close', { duration: 3000 });
        this.replaceInvoiceInList(updated);
        if (this.selectedInvoice()?._id === updated._id) {
          this.selectedInvoice.set(updated);
        }
      },
      error: () => {
        this.snack.open('Failed to update invoice', 'Close', { duration: 3000 });
      },
    });
  }

  voidInvoice(invoice: Invoice): void {
    this.api.delete<Invoice>(`/system-admin/billing/invoices/${invoice._id}`).subscribe({
      next: (updated) => {
        this.snack.open(`Invoice ${invoice.invoiceNumber} voided`, 'Close', { duration: 3000 });
        // If the API returns the updated invoice, replace it; otherwise mark as void locally
        if (updated && (updated as Invoice)._id) {
          this.replaceInvoiceInList(updated as Invoice);
          if (this.selectedInvoice()?._id === (updated as Invoice)._id) {
            this.selectedInvoice.set(updated as Invoice);
          }
        } else {
          const voided: Invoice = { ...invoice, status: 'void' };
          this.replaceInvoiceInList(voided);
          if (this.selectedInvoice()?._id === voided._id) {
            this.selectedInvoice.set(voided);
          }
        }
      },
      error: () => {
        this.snack.open('Failed to void invoice', 'Close', { duration: 3000 });
      },
    });
  }

  // -------------------------------------------------------------------------
  // List mutation helper
  // -------------------------------------------------------------------------

  private replaceInvoiceInList(updated: Invoice): void {
    this.invoices.update((list) =>
      list.map((inv) => (inv._id === updated._id ? updated : inv))
    );
  }
}
