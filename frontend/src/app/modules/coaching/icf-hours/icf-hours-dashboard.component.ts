import { Component, OnInit, ViewChild, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { HoursLogDialogComponent } from './hours-log-dialog.component';
import { HoursImportDialogComponent } from './hours-import-dialog.component';
import { HoursSummary, HoursLogEntry, HoursLogPayload } from './icf-hours.types';
import { environment } from '../../../../environments/environment';

type RangePreset = 'all' | 'last30' | 'last12' | 'custom';

@Component({
  selector: 'app-icf-hours-dashboard',
  standalone: true,
  imports: [
    CommonModule, DatePipe, DecimalPipe, RouterLink, FormsModule,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTooltipModule,
    MatMenuModule, MatSnackBarModule, MatFormFieldModule, MatInputModule,
    MatDatepickerModule, MatNativeDateModule, MatSelectModule,
    MatTableModule, MatSortModule, MatPaginatorModule,
    TranslateModule,
  ],
  template: `
    <div class="icf-page">
      <div class="page-header">
        <div>
          <h1>{{ 'COACHING.icfHoursTitle' | translate }}</h1>
          <p class="subtitle">{{ 'COACHING.icfHoursSubtitle' | translate }}</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button (click)="openImportDialog()">
            <mat-icon>upload_file</mat-icon> {{ 'COACHING.icfImport' | translate }}
          </button>
          <button mat-stroked-button (click)="downloadExport()">
            <mat-icon>download</mat-icon> {{ 'COACHING.icfExport' | translate }}
          </button>
          <button mat-flat-button color="primary" (click)="openLogDialog()">
            <mat-icon>add</mat-icon> {{ 'COACHING.icfLogHours' | translate }}
          </button>
        </div>
      </div>

      <!-- Date range filter -->
      <div class="filter-bar">
        <mat-form-field appearance="outline" class="range-select">
          <mat-label>{{ 'COACHING.icfDateRange' | translate }}</mat-label>
          <mat-select [(ngModel)]="rangePreset" (selectionChange)="onRangeChange()">
            <mat-option value="all">{{ 'COACHING.icfAllTime' | translate }}</mat-option>
            <mat-option value="last12">{{ 'COACHING.icfLast12Months' | translate }}</mat-option>
            <mat-option value="last30">{{ 'COACHING.icfLast30Days' | translate }}</mat-option>
            <mat-option value="custom">{{ 'COACHING.icfCustomRange' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>

        @if (rangePreset === 'custom') {
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.icfFromDate' | translate }}</mat-label>
            <input matInput [matDatepicker]="dpFrom" [(ngModel)]="customFrom" (dateChange)="reload()" />
            <mat-datepicker-toggle matIconSuffix [for]="dpFrom" />
            <mat-datepicker #dpFrom />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.icfToDate' | translate }}</mat-label>
            <input matInput [matDatepicker]="dpTo" [(ngModel)]="customTo" (dateChange)="reload()" />
            <mat-datepicker-toggle matIconSuffix [for]="dpTo" />
            <mat-datepicker #dpTo />
          </mat-form-field>
        }
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      }
      @if (!loading() && summary(); as s) {

        <!-- ICF level progress rings -->
        <h2 class="section-title">{{ 'COACHING.icfProgress' | translate }}</h2>
        <div class="progress-row">
          @for (level of s.icfProgress; track level.level) {
            <div class="progress-card" [class.eligible]="level.eligible">
              <div class="ring" [style.--pct]="level.percentComplete">
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" class="ring-bg" />
                  <circle cx="60" cy="60" r="52" class="ring-fg"
                          [attr.stroke-dasharray]="327"
                          [attr.stroke-dashoffset]="327 - (327 * level.percentComplete / 100)" />
                </svg>
                <div class="ring-label">
                  <span class="ring-pct">{{ level.percentComplete | number:'1.0-0' }}%</span>
                  <span class="ring-level">{{ level.level }}</span>
                </div>
              </div>
              <div class="progress-meta">
                <h3>{{ level.name }}</h3>
                <div class="progress-detail">
                  <span class="logged">{{ level.coachingHoursLogged | number:'1.0-1' }}</span>
                  <span class="of">/ {{ level.coachingHoursRequired }}</span>
                  <span class="suffix">{{ 'COACHING.icfCoachingHours' | translate }}</span>
                </div>
                <div class="mentor-line">
                  <mat-icon>school</mat-icon>
                  {{ level.mentorCoachingLogged | number:'1.0-1' }} / {{ level.mentorCoachingRequired }} {{ 'COACHING.icfMentorHours' | translate }}
                </div>
                <div class="eligibility" [class.yes]="level.eligible">
                  <mat-icon>{{ level.eligible ? 'verified' : 'schedule' }}</mat-icon>
                  {{ (level.eligible ? 'COACHING.icfEligible' : 'COACHING.icfNotYetEligible') | translate }}
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Totals breakdown -->
        <h2 class="section-title">{{ 'COACHING.icfTotalsBreakdown' | translate }}</h2>
        <div class="totals-grid">
          <div class="total-card primary">
            <span class="num">{{ s.totals.coachingTotal | number:'1.0-1' }}</span>
            <span class="label">{{ 'COACHING.icfTotalCoachingHours' | translate }}</span>
            <span class="sub">
              {{ s.bySource.fromSessions | number:'1.0-1' }} {{ 'COACHING.icfFromSessions' | translate }}
              · {{ s.bySource.fromManualLog | number:'1.0-1' }} {{ 'COACHING.icfFromManual' | translate }}
            </span>
          </div>
          <div class="total-card">
            <span class="num">{{ s.totals.paid | number:'1.0-1' }}</span>
            <span class="label">{{ 'COACHING.icfPaid' | translate }}</span>
          </div>
          <div class="total-card">
            <span class="num">{{ s.totals.proBono | number:'1.0-1' }}</span>
            <span class="label">{{ 'COACHING.icfProBono' | translate }}</span>
          </div>
          <div class="total-card">
            <span class="num">{{ s.totals.individual | number:'1.0-1' }}</span>
            <span class="label">{{ 'COACHING.icfClientIndividual' | translate }}</span>
          </div>
          <div class="total-card">
            <span class="num">{{ s.totals.team | number:'1.0-1' }}</span>
            <span class="label">{{ 'COACHING.icfClientTeam' | translate }}</span>
          </div>
          <div class="total-card">
            <span class="num">{{ s.totals.group | number:'1.0-1' }}</span>
            <span class="label">{{ 'COACHING.icfClientGroup' | translate }}</span>
          </div>
          <div class="total-card mentor">
            <span class="num">{{ s.totals.mentorCoachingReceived | number:'1.0-1' }}</span>
            <span class="label">{{ 'COACHING.icfMentorCoachingReceived' | translate }}</span>
          </div>
          <div class="total-card cce">
            <span class="num">{{ s.totals.cceCredits | number:'1.0-1' }}</span>
            <span class="label">{{ 'COACHING.icfCceCredits' | translate }}</span>
          </div>
        </div>

        <!-- Recent activity table -->
        <div class="activity-section">
          <div class="activity-header">
            <h2 class="section-title">{{ 'COACHING.icfRecentActivity' | translate }}</h2>
            <span class="row-count">
              {{ dataSource.filteredData.length }} / {{ entries().length }} {{ 'COACHING.icfEntries' | translate }}
            </span>
          </div>

          <!-- Filter bar -->
          <div class="table-filter-bar">
            <mat-form-field appearance="outline" class="filter-text">
              <mat-icon matPrefix>search</mat-icon>
              <mat-label>{{ 'COACHING.icfFilterPlaceholder' | translate }}</mat-label>
              <input matInput [(ngModel)]="textFilter" (ngModelChange)="applyFilters()" />
              @if (textFilter) {
                <button matSuffix mat-icon-button (click)="textFilter=''; applyFilters()">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>{{ 'COACHING.icfCategory' | translate }}</mat-label>
              <mat-select [(ngModel)]="categoryFilter" (selectionChange)="applyFilters()">
                <mat-option value="">{{ 'COACHING.icfAllCategories' | translate }}</mat-option>
                <mat-option value="session">{{ 'COACHING.icfCatSession' | translate }}</mat-option>
                <mat-option value="mentor_coaching_received">{{ 'COACHING.icfCatMentor' | translate }}</mat-option>
                <mat-option value="cce">{{ 'COACHING.icfCatCce' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>{{ 'COACHING.icfPaidStatus' | translate }}</mat-label>
              <mat-select [(ngModel)]="paidFilter" (selectionChange)="applyFilters()">
                <mat-option value="">{{ 'COACHING.icfAllPaidStatus' | translate }}</mat-option>
                <mat-option value="paid">{{ 'COACHING.icfPaid' | translate }}</mat-option>
                <mat-option value="pro_bono">{{ 'COACHING.icfProBono' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>{{ 'COACHING.icfClientType' | translate }}</mat-label>
              <mat-select [(ngModel)]="clientTypeFilter" (selectionChange)="applyFilters()">
                <mat-option value="">{{ 'COACHING.icfAllClientTypes' | translate }}</mat-option>
                <mat-option value="individual">{{ 'COACHING.icfClientIndividual' | translate }}</mat-option>
                <mat-option value="team">{{ 'COACHING.icfClientTeam' | translate }}</mat-option>
                <mat-option value="group">{{ 'COACHING.icfClientGroup' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          @if (entries().length === 0) {
            <div class="empty-row">
              <mat-icon>schedule</mat-icon>
              <p>{{ 'COACHING.icfNoEntries' | translate }}</p>
            </div>
          } @else {
            <div class="activity-table-wrap">
              <table mat-table matSort [dataSource]="dataSource" class="compact-table">
                <!-- Date -->
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="col-date">{{ 'COACHING.date' | translate }}</th>
                  <td mat-cell *matCellDef="let r" class="col-date">{{ r.date | date:'mediumDate' }}</td>
                  <td mat-footer-cell *matFooterCellDef class="col-date footer-label">
                    {{ 'COACHING.icfTotal' | translate }}
                  </td>
                </ng-container>

                <!-- Category -->
                <ng-container matColumnDef="category">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'COACHING.icfCategory' | translate }}</th>
                  <td mat-cell *matCellDef="let r">
                    <span class="cat-pill" [class]="r.category">
                      {{ categoryLabel(r.category) | translate }}
                    </span>
                    @if (r.source === 'session') {
                      <mat-icon class="auto-icon"
                                [matTooltip]="'COACHING.icfFromSessionTooltip' | translate">
                        link
                      </mat-icon>
                    }
                  </td>
                  <td mat-footer-cell *matFooterCellDef>
                    <strong>{{ filteredCount() }}</strong>
                    <span class="footer-suffix">{{ 'COACHING.icfSessions' | translate }}</span>
                  </td>
                </ng-container>

                <!-- Client -->
                <ng-container matColumnDef="clientName">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'COACHING.icfClientOrType' | translate }}</th>
                  <td mat-cell *matCellDef="let r">{{ r.clientName || '—' }}</td>
                  <td mat-footer-cell *matFooterCellDef></td>
                </ng-container>

                <!-- Client type (individual / team / group) -->
                <ng-container matColumnDef="clientType">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'COACHING.icfClientType' | translate }}</th>
                  <td mat-cell *matCellDef="let r">
                    @if (r.clientType) {
                      <span class="type-pill" [class]="'ct-' + r.clientType">
                        {{ clientTypeLabel(r.clientType) | translate }}
                      </span>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td mat-footer-cell *matFooterCellDef></td>
                </ng-container>

                <!-- Assessment type (e.g. EQi-2.0, Hogan) -->
                <ng-container matColumnDef="assessmentType">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'COACHING.icfAssessmentType' | translate }}</th>
                  <td mat-cell *matCellDef="let r">
                    @if (r.assessmentType) {
                      <span class="assessment-pill">{{ r.assessmentType }}</span>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td mat-footer-cell *matFooterCellDef></td>
                </ng-container>

                <!-- Organization / Sponsor -->
                <ng-container matColumnDef="organization">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>
                    {{ 'COACHING.icfCompanySponsor' | translate }}
                  </th>
                  <td mat-cell *matCellDef="let r">
                    <div class="org-cell">
                      <span class="org-name">{{ r.clientOrganization || '—' }}</span>
                      @if (r.sponsorContactName) {
                        <span class="sponsor-name">
                          <mat-icon>person</mat-icon>{{ r.sponsorContactName }}
                        </span>
                      }
                    </div>
                  </td>
                  <td mat-footer-cell *matFooterCellDef></td>
                </ng-container>

                <!-- Hours -->
                <ng-container matColumnDef="hours">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="num">{{ 'COACHING.icfHoursValue' | translate }}</th>
                  <td mat-cell *matCellDef="let r" class="num">{{ r.hours | number:'1.0-2' }}</td>
                  <td mat-footer-cell *matFooterCellDef class="num footer-total">
                    {{ filteredHours() | number:'1.0-2' }}
                  </td>
                </ng-container>

                <!-- Paid status -->
                <ng-container matColumnDef="paidStatus">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'COACHING.icfPaidStatus' | translate }}</th>
                  <td mat-cell *matCellDef="let r">
                    @if (r.paidStatus === 'paid') {
                      <span class="paid-badge paid">{{ 'COACHING.icfPaid' | translate }}</span>
                    } @else if (r.paidStatus === 'pro_bono') {
                      <span class="paid-badge probono">{{ 'COACHING.icfProBono' | translate }}</span>
                    }
                  </td>
                  <td mat-footer-cell *matFooterCellDef></td>
                </ng-container>

                <!-- Actions -->
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef class="actions"></th>
                  <td mat-cell *matCellDef="let r" class="actions">
                    @if (r.source === 'manual') {
                      <button mat-icon-button [matMenuTriggerFor]="rowMenu" (click)="$event.stopPropagation()">
                        <mat-icon>more_vert</mat-icon>
                      </button>
                      <mat-menu #rowMenu="matMenu">
                        <button mat-menu-item (click)="editEntry(r.id)">
                          <mat-icon>edit</mat-icon> {{ 'COMMON.edit' | translate }}
                        </button>
                        <button mat-menu-item (click)="deleteEntry(r.id)">
                          <mat-icon>delete</mat-icon> {{ 'COMMON.delete' | translate }}
                        </button>
                      </mat-menu>
                    }
                  </td>
                  <td mat-footer-cell *matFooterCellDef></td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns" [class.from-session]="row.source === 'session'"></tr>
                <tr mat-footer-row *matFooterRowDef="displayedColumns; sticky: true" class="totals-footer"></tr>

                <tr class="no-match" *matNoDataRow>
                  <td colspan="9">{{ 'COACHING.icfFilterNoMatch' | translate }}</td>
                </tr>
              </table>
            </div>

            <mat-paginator
              [pageSizeOptions]="[10, 25, 50, 100]"
              [pageSize]="25"
              showFirstLastButtons>
            </mat-paginator>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .icf-page { padding: 24px 32px; max-width: 1280px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .page-header h1 { margin: 0 0 4px; color: var(--artes-primary, #1B2A47); font-size: 26px; font-weight: 600; }
    .subtitle { margin: 0; color: #5a6a7e; font-size: 14px; }
    .header-actions { display: flex; gap: 8px; }

    .filter-bar { display: flex; gap: 12px; margin: 12px 0 24px; flex-wrap: wrap; }
    .range-select { min-width: 220px; }

    .loading-center { display: flex; justify-content: center; padding: 60px; }

    .section-title { margin: 32px 0 12px; font-size: 16px; font-weight: 600; color: #1B2A47; text-transform: uppercase; letter-spacing: 0.6px; }

    /* Progress rings */
    .progress-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
    .progress-card {
      display: flex; gap: 18px; padding: 20px; background: #fff;
      border: 1px solid #e6ecf2; border-radius: 12px;
      box-shadow: 0 1px 3px rgba(27,42,71,0.04);
      transition: border-color 0.2s;
    }
    .progress-card.eligible { border-color: #27C4A0; background: #f0fdf6; }
    .ring { position: relative; width: 110px; height: 110px; flex-shrink: 0; }
    .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring circle { fill: none; stroke-width: 10; }
    .ring-bg { stroke: #ebf0f5; }
    .ring-fg { stroke: #3A9FD6; stroke-linecap: round; transition: stroke-dashoffset 0.6s ease; }
    .progress-card.eligible .ring-fg { stroke: #27C4A0; }
    .ring-label {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
    }
    .ring-pct { font-size: 22px; font-weight: 700; color: #1B2A47; }
    .ring-level { font-size: 11px; color: #5a6a7e; letter-spacing: 1px; }

    .progress-meta { flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .progress-meta h3 { margin: 0; font-size: 16px; color: #1B2A47; font-weight: 600; }
    .progress-detail { display: flex; align-items: baseline; gap: 4px; font-size: 13px; }
    .progress-detail .logged { font-size: 20px; font-weight: 700; color: #1B2A47; }
    .progress-detail .of { color: #9aa5b4; }
    .progress-detail .suffix { color: #5a6a7e; margin-left: 4px; }
    .mentor-line {
      display: flex; align-items: center; gap: 6px; font-size: 12px; color: #7c8a99;
    }
    .mentor-line mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .eligibility {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px; padding: 4px 10px; border-radius: 999px;
      background: #f4f7fb; color: #7c8a99; align-self: flex-start; margin-top: 4px;
    }
    .eligibility.yes { background: #27C4A0; color: #fff; }
    .eligibility mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* Totals grid */
    .totals-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
    .total-card {
      padding: 16px; background: #fff; border: 1px solid #e6ecf2;
      border-radius: 8px; display: flex; flex-direction: column; gap: 4px;
    }
    .total-card .num { font-size: 22px; font-weight: 700; color: #1B2A47; }
    .total-card .label { font-size: 12px; color: #5a6a7e; text-transform: uppercase; letter-spacing: 0.5px; }
    .total-card .sub { font-size: 11px; color: #9aa5b4; margin-top: 4px; }
    .total-card.primary { background: linear-gradient(135deg, #1B2A47 0%, #2a3d5f 100%); color: #fff; }
    .total-card.primary .num { color: #fff; }
    .total-card.primary .label { color: #d6dde6; }
    .total-card.primary .sub { color: #aab8c8; }
    .total-card.mentor { border-left: 3px solid #7c5cbf; }
    .total-card.cce { border-left: 3px solid #f0a500; }

    /* Activity table */
    .activity-section {
      display: flex; flex-direction: column;
    }
    .activity-header { display: flex; justify-content: space-between; align-items: baseline; margin-top: 24px; }
    .row-count { font-size: 12px; color: #9aa5b4; }

    /* Filter bar above the table */
    .table-filter-bar { display: flex; gap: 12px; margin: 4px 0 8px; align-items: flex-end; flex-wrap: wrap; }
    .filter-text   { flex: 1; min-width: 240px; }
    .filter-select { width: 200px; }
    /* Tighten Material form-field vertical spacing in this bar */
    .table-filter-bar ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }

    .activity-table-wrap {
      /* Bounded, predictable height. min-height shows ~10 rows so the table
       * always feels populated; max-height caps at 50vh on large monitors so
       * the paginator stays visible without scrolling beyond the fold. */
      min-height: 320px;
      max-height: 50vh;
      background: #fff; border: 1px solid #e6ecf2; border-radius: 8px 8px 0 0;
      overflow: auto;
    }
    .compact-table { width: 100%; }
    .compact-table th.mat-mdc-header-cell {
      background: #f8fafc;
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px;
      color: #5a6a7e; font-weight: 600;
      padding: 6px 10px; height: 30px;
    }
    .compact-table td.mat-mdc-cell {
      padding: 2px 10px; font-size: 12px;
      border-bottom: 1px solid #f0f3f7;
      line-height: 1.3;
    }
    .compact-table tr.mat-mdc-row { height: 28px; }
    .compact-table tr.mat-mdc-row:hover { background: #f8fafc; }

    /* Footer totals row */
    .compact-table tr.totals-footer { height: 36px; }
    .compact-table td.mat-mdc-footer-cell {
      padding: 6px 10px;
      font-size: 12px; font-weight: 600;
      background: #f8fafc;
      border-top: 2px solid #d6dde6;
      border-bottom: none;
      color: #1B2A47;
    }
    .compact-table td.mat-mdc-footer-cell.footer-label {
      text-transform: uppercase; letter-spacing: 0.6px;
      font-size: 10px; color: #5a6a7e;
    }
    .compact-table td.mat-mdc-footer-cell.footer-total {
      font-variant-numeric: tabular-nums;
      color: #1a9678;
      font-weight: 700;
    }
    .footer-suffix {
      font-size: 10px; font-weight: 500; color: #5a6a7e;
      text-transform: lowercase; margin-left: 4px;
    }
    .compact-table tr.from-session { background: #fafcfe; }
    .compact-table .num { text-align: center; font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
    /* Override Material's flex-start on the sort-header inner container so
     * the header label sits centered like the body cells. */
    .compact-table th.num ::ng-deep .mat-sort-header-container { justify-content: center; }
    .compact-table .col-date { white-space: nowrap; min-width: 110px; width: 110px; }
    .compact-table th.actions, .compact-table td.actions { width: 36px; padding: 0 4px 0 0; text-align: right; }
    .compact-table td.actions .mat-mdc-icon-button { width: 28px; height: 28px; padding: 0; line-height: 28px; }
    .compact-table td.actions .mat-mdc-icon-button mat-icon { font-size: 16px; width: 16px; height: 16px; line-height: 16px; }
    .compact-table tr.no-match td { padding: 24px; text-align: center; color: #9aa5b4; font-size: 13px; }

    .org-cell { display: flex; flex-direction: column; line-height: 1.25; }
    .org-name { color: #1B2A47; }
    .sponsor-name {
      font-size: 11px; color: #9aa5b4;
      display: inline-flex; align-items: center; gap: 2px;
    }
    .sponsor-name mat-icon {
      font-size: 12px; width: 12px; height: 12px;
    }

    mat-paginator {
      border: 1px solid #e6ecf2; border-top: 0; border-radius: 0 0 8px 8px;
      background: #fafbfd;
    }

    .cat-pill { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .cat-pill.session { background: #e0f0ff; color: #1e6aa8; }
    .cat-pill.mentor_coaching_received { background: #f1ecfa; color: #6a4ba8; }
    .cat-pill.cce { background: #fff4e0; color: #b27300; }

    .type-pill {
      display: inline-block; padding: 2px 8px; border-radius: 4px;
      font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .type-pill.ct-individual { background: #f4f7fb; color: #5a6a7e; }
    .type-pill.ct-team       { background: #e0f7ed; color: #1a9678; }
    .type-pill.ct-group      { background: #fff4e0; color: #b27300; }

    .assessment-pill {
      display: inline-block; padding: 2px 8px; border-radius: 4px;
      font-size: 11px; font-weight: 600;
      background: #eff6ff; color: #1e6aa8; border: 1px solid #cfe5ff;
      font-variant-numeric: tabular-nums;
    }

    .muted { color: #c0c8d2; }
    .auto-icon { font-size: 14px; width: 14px; height: 14px; vertical-align: middle; color: #9aa5b4; margin-left: 6px; }

    .paid-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .paid-badge.paid { background: #e0f7ed; color: #1a9678; }
    .paid-badge.probono { background: #f4f7fb; color: #5a6a7e; }

    .empty-row { display: flex; flex-direction: column; align-items: center; padding: 50px; gap: 8px; color: #9aa5b4; background: #fafbfd; border: 1px dashed #d6dde6; border-radius: 8px; }
    .empty-row mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .empty-row p { margin: 0; font-size: 14px; }

    @media (max-width: 900px) {
      .progress-row { grid-template-columns: 1fr; }
      .totals-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `],
})
export class IcfHoursDashboardComponent implements OnInit {
  loading = signal(true);
  summary = signal<HoursSummary | null>(null);
  entries = signal<HoursLogEntry[]>([]);

  rangePreset: RangePreset = 'all';
  customFrom: Date | null = null;
  customTo: Date | null = null;

  // Activity table state.
  // The table sits inside @if (entries().length === 0) ... @else { <table> },
  // so it is NOT in the DOM during ngAfterViewInit. We use ViewChild setters
  // that fire when Angular finally renders the element, and attach sort +
  // paginator to the data source at that point.
  private _sort?: MatSort;
  private _paginator?: MatPaginator;

  @ViewChild(MatSort) set matSortRef(s: MatSort | undefined) {
    this._sort = s;
    if (s) {
      this.dataSource.sort = s;
      // Default sort: date desc, but only set once (don't clobber user clicks).
      if (!s.active) {
        s.active = 'date';
        s.direction = 'desc';
        s.sortChange.emit({ active: s.active, direction: s.direction });
      }
    }
  }
  @ViewChild(MatPaginator) set matPaginatorRef(p: MatPaginator | undefined) {
    this._paginator = p;
    if (p) this.dataSource.paginator = p;
  }

  dataSource = new MatTableDataSource<HoursLogEntry>([]);
  displayedColumns = [
    'date', 'category', 'clientName', 'clientType', 'assessmentType',
    'organization', 'hours', 'paidStatus', 'actions',
  ];

  textFilter = '';
  categoryFilter = '';
  paidFilter = '';
  clientTypeFilter = '';

  constructor(
    private api: ApiService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
    private translate: TranslateService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.dataSource.filterPredicate = (row, filter) => {
      const f = JSON.parse(filter) as { text: string; category: string; paid: string; clientType: string };
      if (f.category && row.category !== f.category) return false;
      if (f.paid && row.paidStatus !== f.paid) return false;
      if (f.clientType && row.clientType !== f.clientType) return false;
      if (f.text) {
        const haystack = [
          row.clientName, row.clientOrganization, row.sponsorContactName,
          row.mentorCoachName, row.mentorCoachOrganization, row.assessmentType,
          row.clientType, row.notes, row.category,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(f.text)) return false;
      }
      return true;
    };
    this.dataSource.sortingDataAccessor = (row, prop) => {
      switch (prop) {
        case 'date':           return new Date(row.date).getTime();
        case 'hours':          return row.hours;
        case 'clientName':     return (row.clientName ?? '').toLowerCase();
        case 'clientType':     return (row.clientType ?? '').toLowerCase();
        case 'assessmentType': return (row.assessmentType ?? '').toLowerCase();
        case 'organization':   return (row.clientOrganization ?? '').toLowerCase();
        case 'category':       return row.category;
        case 'paidStatus':     return row.paidStatus ?? '';
        default:               return (row as any)[prop];
      }
    };
    this.reload();
  }

  applyFilters(): void {
    this.dataSource.filter = JSON.stringify({
      text: this.textFilter.trim().toLowerCase(),
      category: this.categoryFilter,
      paid: this.paidFilter,
      clientType: this.clientTypeFilter,
    });
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  /** Footer totals — recompute on every change detection (cheap; O(n)
   *  over filteredData, ≤1k rows in practice). Called by the matFooterCell
   *  template bindings. */
  filteredCount(): number {
    return this.dataSource.filteredData?.length ?? 0;
  }
  filteredHours(): number {
    return (this.dataSource.filteredData ?? [])
      .reduce((acc, r) => acc + (r.hours ?? 0), 0);
  }

  reload(): void {
    this.loading.set(true);
    const params: Record<string, string> = {};
    const range = this.computeRange();
    if (range.from) params['from'] = range.from;
    if (range.to)   params['to']   = range.to;

    Promise.all([
      this.api.get<HoursSummary>('/coaching/hours/summary', params).toPromise(),
      this.api.get<HoursLogEntry[]>('/coaching/hours/entries', params).toPromise(),
    ]).then(([summary, entries]) => {
      this.summary.set(summary || null);
      this.entries.set(entries || []);
      this.dataSource.data = entries || [];
      this.applyFilters();
      this.loading.set(false);
    }).catch((err) => {
      this.loading.set(false);
      this.snack.open(err?.error?.error || 'Failed to load ICF hours', 'Dismiss', { duration: 4000 });
    });
  }

  onRangeChange(): void {
    if (this.rangePreset !== 'custom') this.reload();
  }

  computeRange(): { from?: string; to?: string } {
    const now = new Date();
    if (this.rangePreset === 'last30') {
      const from = new Date(now); from.setDate(from.getDate() - 30);
      return { from: from.toISOString() };
    }
    if (this.rangePreset === 'last12') {
      const from = new Date(now); from.setMonth(from.getMonth() - 12);
      return { from: from.toISOString() };
    }
    if (this.rangePreset === 'custom') {
      return {
        from: this.customFrom ? this.customFrom.toISOString() : undefined,
        to:   this.customTo ? this.customTo.toISOString() : undefined,
      };
    }
    return {};
  }

  categoryLabel(category: string): string {
    return category === 'session' ? 'COACHING.icfCatSession'
         : category === 'mentor_coaching_received' ? 'COACHING.icfCatMentor'
         : category === 'cce' ? 'COACHING.icfCatCce'
         : category;
  }

  clientTypeLabel(clientType: string): string {
    return clientType === 'individual' ? 'COACHING.icfClientIndividual'
         : clientType === 'team' ? 'COACHING.icfClientTeam'
         : clientType === 'group' ? 'COACHING.icfClientGroup'
         : clientType;
  }

  openLogDialog(): void {
    const ref = this.dialog.open(HoursLogDialogComponent, { data: {} });
    ref.afterClosed().subscribe((res) => { if (res) this.reload(); });
  }

  openImportDialog(): void {
    const ref = this.dialog.open(HoursImportDialogComponent, { width: '820px' });
    ref.afterClosed().subscribe((committed) => { if (committed) this.reload(); });
  }

  downloadExport(): void {
    const params: Record<string, string> = {};
    const range = this.computeRange();
    if (range.from) params['from'] = range.from;
    if (range.to)   params['to']   = range.to;

    const url = `${environment.apiUrl}/coaching/hours/export.csv`;
    this.http.get(url, { params, responseType: 'blob' }).subscribe({
      next: (blob) => {
        const objUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objUrl;
        link.download = `icf-hours-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(objUrl);
      },
      error: (err) => this.snack.open(err?.error?.error || 'Export failed', 'Dismiss', { duration: 4000 }),
    });
  }

  editEntry(id: string): void {
    // Entries view collapses session-only fields; refetch the raw log row.
    this.api.get<HoursLogPayload[]>('/coaching/hours').subscribe({
      next: (rows) => {
        const full = rows.find((r) => r._id === id);
        if (!full) return;
        const ref = this.dialog.open(HoursLogDialogComponent, { data: { entry: full } });
        ref.afterClosed().subscribe((res) => { if (res) this.reload(); });
      },
    });
  }

  deleteEntry(id: string): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('COACHING.icfDeleteConfirmTitle'),
        message: this.translate.instant('COACHING.icfDeleteConfirmMsg'),
        confirmText: this.translate.instant('COMMON.delete'),
      },
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.api.delete(`/coaching/hours/${id}`).subscribe({
        next: () => {
          this.snack.open(this.translate.instant('COACHING.icfEntryDeleted'), 'Dismiss', { duration: 2500 });
          this.reload();
        },
        error: (err) => this.snack.open(err?.error?.error || 'Failed', 'Dismiss', { duration: 4000 }),
      });
    });
  }
}
