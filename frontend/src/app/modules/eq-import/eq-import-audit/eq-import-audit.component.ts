import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { TranslateModule } from '@ngx-translate/core';

interface AuditEntry {
  _id: string;
  importId: string;
  privacyMode: string;
  reportType: string;
  assessmentYear: number | null;
  consentObtained: boolean;
  validationPassed: boolean;
  requiresManualReview: boolean;
  reviewReasons: string[];
  scoreId?: string;
  erasedAt?: string;
  importTimestamp: string;
}

@Component({
  selector: 'app-eq-import-audit',
  standalone: true,
  imports: [
    CommonModule, DatePipe, MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatSelectModule, MatFormFieldModule, MatTooltipModule, MatSnackBarModule, FormsModule,
    EmptyStateComponent,
    TranslateModule,
  ],
  template: `
    <div class="audit-page">
      <div class="page-header">
        <div>
          <h1>{{ "EQ.auditLog" | translate }}</h1>
          <p>{{ "EQ.auditSubtitle" | translate }}</p>
        </div>
      </div>

      <div class="filters">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Privacy Mode</mat-label>
          <mat-select [(ngModel)]="filterMode" (ngModelChange)="load()">
            <mat-option value="">All</mat-option>
            <mat-option value="IDENTIFIED">Identified</mat-option>
            <mat-option value="PSEUDONYMIZED">Pseudonymized</mat-option>
            <mat-option value="ANONYMIZED">Anonymized</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else if (entries().length === 0) {
        <app-empty-state icon="receipt_long" title="No imports" message="No imports recorded yet."></app-empty-state>
      } @else {
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ "EQ.dateCol" | translate }}</th>
              <th>{{ "EQ.privacyCol" | translate }}</th>
              <th>{{ "EQ.reportCol" | translate }}</th>
              <th>{{ "EQ.yearCol" | translate }}</th>
              <th>{{ "EQ.consentCol" | translate }}</th>
              <th>{{ "EQ.validationCol" | translate }}</th>
              <th>{{ "EQ.importIdCol" | translate }}</th>
              <th>{{ "EQ.actionsCol" | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (e of entries(); track e.importId) {
              <tr [class.erased]="!!e.erasedAt">
                <td>{{ e.importTimestamp | date:'MMM d, y' }}</td>
                <td><span class="mode-chip" [class]="e.privacyMode.toLowerCase()">{{ e.privacyMode }}</span></td>
                <td>{{ e.reportType }}</td>
                <td>{{ e.assessmentYear ?? '—' }}</td>
                <td><mat-icon [class]="e.consentObtained ? 'consent-yes' : 'consent-no'">{{ e.consentObtained ? 'check_circle' : 'remove' }}</mat-icon></td>
                <td>
                  @if (e.validationPassed) { <mat-icon class="val-pass">check_circle</mat-icon> }
                  @else { <mat-icon class="val-fail" [matTooltip]="e.reviewReasons.join('; ')">warning</mat-icon> }
                </td>
                <td><code>{{ e.importId | slice:0:8 }}...</code></td>
                <td>
                  @if (e.scoreId && !e.erasedAt && e.privacyMode !== 'ANONYMIZED') {
                    <button mat-icon-button matTooltip="Erase client data" class="erase-btn" (click)="eraseData(e)">
                      <mat-icon>delete_forever</mat-icon>
                    </button>
                  }
                  @if (e.erasedAt) {
                    <span class="erased-badge">{{ "EQ.erasedBadge" | translate }}</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="pagination">
          <span>Page {{ page() }} of {{ totalPages() }}</span>
          <button mat-icon-button [disabled]="page() <= 1" (click)="page.set(page() - 1); load()"><mat-icon>chevron_left</mat-icon></button>
          <button mat-icon-button [disabled]="page() >= totalPages()" (click)="page.set(page() + 1); load()"><mat-icon>chevron_right</mat-icon></button>
        </div>
      }
    </div>
  `,
  styles: [`
    .audit-page { padding: 32px; max-width: 1100px; }
    .filters { margin-bottom: 16px; }
    .filter-field { width: 200px; }
    .data-table {
      width: 100%; border-collapse: collapse; font-size: 13px; background: white;
      border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      th { text-align: left; padding: 12px; background: #f8fafc; color: var(--artes-primary); font-weight: 600; font-size: 12px; }
      td { padding: 10px 12px; border-bottom: 1px solid #f0f4f8; }
      tr:hover td { background: #fafbfc; }
      code { font-size: 11px; background: #f0f4f8; padding: 2px 6px; border-radius: 4px; }
    }
    .erased { opacity: 0.5; }
    .mode-chip {
      font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;
      &.identified { background: var(--artes-bg); color: var(--artes-accent); }
      &.pseudonymized { background: #FFF8E6; color: #b07800; }
      &.anonymized { background: #e8faf4; color: #1a9678; }
    }
    .consent-yes { color: #27C4A0; font-size: 18px; }
    .consent-no { color: #c5d0db; font-size: 18px; }
    .val-pass { color: #27C4A0; font-size: 18px; }
    .val-fail { color: #f0a500; font-size: 18px; }
    .erase-btn { color: #e53e3e; }
    .erased-badge { font-size: 10px; color: #e53e3e; background: #fef2f2; padding: 2px 6px; border-radius: 4px; }
    .pagination { display: flex; align-items: center; gap: 8px; justify-content: flex-end; padding: 12px 0; font-size: 13px; color: #5a6a7e; }
  `],
})
export class EqImportAuditComponent implements OnInit {
  entries = signal<AuditEntry[]>([]);
  loading = signal(true);
  page = signal(1);
  totalPages = signal(1);
  filterMode = '';

  constructor(private api: ApiService, private snack: MatSnackBar, private dialog: MatDialog) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    let url = `/eq/import/audit?page=${this.page()}&limit=20`;
    if (this.filterMode) url += `&privacyMode=${this.filterMode}`;

    this.api.get<{ entries: AuditEntry[]; pages: number }>(url).subscribe({
      next: (res) => { this.entries.set(res.entries); this.totalPages.set(res.pages); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  eraseData(entry: AuditEntry): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: 'Erase Client Data',
        message: `Permanently erase all assessment data for this import? The audit log entry will be preserved (legal requirement). This cannot be undone.`,
        confirmLabel: 'Erase Data',
        confirmColor: 'warn',
        icon: 'delete_forever',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.api.delete(`/eq/import/record/${entry.scoreId}`).subscribe({
        next: () => { this.snack.open('Client data erased', 'OK', { duration: 3000 }); this.load(); },
        error: (err) => this.snack.open(err.error?.error || 'Erasure failed', 'Dismiss', { duration: 4000 }),
      });
    });
  }
}
