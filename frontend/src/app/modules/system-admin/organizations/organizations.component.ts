import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../../core/api.service';
import { OrgEditDialogComponent, OrgRow } from '../org-edit-dialog/org-edit-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';

interface Stats {
  totalOrgs: number;
  activeOrgs: number;
  trialOrgs: number;
  totalUsers: number;
  plans: Partial<Record<string, number>>;
}

@Component({
  selector: 'app-organizations',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatMenuModule,
    MatTooltipModule,
    MatChipsModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  template: `
    <div class="page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Organisations</h1>
          <p>Manage all tenant organisations, plans, and access</p>
        </div>
        <button mat-raised-button color="primary" (click)="openCreate()">
          <mat-icon>add</mat-icon> New Organisation
        </button>
      </div>

      <!-- Stats bar -->
      @if (stats()) {
        <div class="stats-bar">
          <div class="stat">
            <span class="stat-value">{{ stats()!.totalOrgs }}</span>
            <span class="stat-label">Total Orgs</span>
          </div>
          <div class="stat">
            <span class="stat-value active">{{ stats()!.activeOrgs }}</span>
            <span class="stat-label">Active</span>
          </div>
          <div class="stat">
            <span class="stat-value trial">{{ stats()!.trialOrgs }}</span>
            <span class="stat-label">On Trial</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ stats()!.totalUsers }}</span>
            <span class="stat-label">Total Users</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ stats()!.plans['starter'] ?? 0 }}</span>
            <span class="stat-label">Starter</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ stats()!.plans['professional'] ?? 0 }}</span>
            <span class="stat-label">Professional</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ stats()!.plans['enterprise'] ?? 0 }}</span>
            <span class="stat-label">Enterprise</span>
          </div>
        </div>
      }

      <!-- Filters -->
      <div class="filters">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [(ngModel)]="search" (ngModelChange)="applyFilter()" placeholder="Name, slug or email…" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Plan</mat-label>
          <mat-select [(ngModel)]="planFilter" (ngModelChange)="applyFilter()">
            <mat-option value="">All Plans</mat-option>
            <mat-option value="starter">Starter</mat-option>
            <mat-option value="professional">Professional</mat-option>
            <mat-option value="enterprise">Enterprise</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="statusFilter" (ngModelChange)="applyFilter()">
            <mat-option value="">All</mat-option>
            <mat-option value="active">Active</mat-option>
            <mat-option value="suspended">Suspended</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Table -->
      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {
        <div class="table-wrap">
          <table mat-table [dataSource]="filtered()" class="orgs-table">

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Organisation</th>
              <td mat-cell *matCellDef="let o">
                <div class="org-name-cell">
                  <span class="org-name">{{ o.name }}</span>
                  <span class="org-slug">{{ o.slug }}</span>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="plan">
              <th mat-header-cell *matHeaderCellDef>Plan</th>
              <td mat-cell *matCellDef="let o">
                <span class="plan-badge" [class]="o.plan">{{ o.plan }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let o">
                @if (!o.isActive) {
                  <span class="status-badge suspended">Suspended</span>
                } @else if (isOnTrial(o)) {
                  <span class="status-badge trial">Trial → {{ o.trialEndsAt | date:'MMM d' }}</span>
                } @else {
                  <span class="status-badge active">Active</span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="users">
              <th mat-header-cell *matHeaderCellDef>Users</th>
              <td mat-cell *matCellDef="let o">
                <span class="users-count" [class.near-limit]="nearLimit(o)">
                  {{ o.userCount ?? 0 }} / {{ o.maxUsers }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="modules">
              <th mat-header-cell *matHeaderCellDef>Modules</th>
              <td mat-cell *matCellDef="let o">
                <div class="module-icons">
                  @for (m of o.modules; track m) {
                    <mat-icon [matTooltip]="moduleLabel(m)" class="module-icon">{{ moduleIcon(m) }}</mat-icon>
                  }
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="billingEmail">
              <th mat-header-cell *matHeaderCellDef>Billing</th>
              <td mat-cell *matCellDef="let o" class="email-cell">{{ o.billingEmail }}</td>
            </ng-container>

            <ng-container matColumnDef="createdAt">
              <th mat-header-cell *matHeaderCellDef>Created</th>
              <td mat-cell *matCellDef="let o">{{ o.createdAt | date:'MMM d, y' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let o">
                <button mat-icon-button [matMenuTriggerFor]="rowMenu" [matMenuTriggerData]="{ org: o }">
                  <mat-icon>more_vert</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="cols"></tr>
            <tr mat-row *matRowDef="let row; columns: cols;" [class.suspended-row]="!row.isActive"></tr>
          </table>

          @if (filtered().length === 0) {
            <div class="no-results">
              <mat-icon>search_off</mat-icon>
              <span>No organisations match your filters</span>
            </div>
          }
        </div>
      }

      <!-- Row context menu -->
      <mat-menu #rowMenu="matMenu">
        <ng-template matMenuContent let-org="org">
          <button mat-menu-item (click)="openEdit(org)">
            <mat-icon>edit</mat-icon> Edit
          </button>
          <button mat-menu-item (click)="toggleSuspend(org)">
            <mat-icon>{{ org.isActive ? 'block' : 'check_circle' }}</mat-icon>
            {{ org.isActive ? 'Suspend' : 'Reactivate' }}
          </button>
        </ng-template>
      </mat-menu>

    </div>
  `,
  styles: [`
    .page { padding: 32px; max-width: 1400px; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 24px;
      h1 { font-size: 28px; color: #1B2A47; margin: 0 0 4px; }
      p  { color: #5a6a7e; margin: 0; font-size: 14px; }
    }

    .stats-bar {
      display: flex; gap: 0; margin-bottom: 24px;
      background: white; border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.07);
      overflow: hidden;
    }

    .stat {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      padding: 16px 12px;
      border-right: 1px solid #eef2f7;
      &:last-child { border-right: none; }
    }

    .stat-value {
      font-size: 24px; font-weight: 700; color: #1B2A47;
      &.active { color: #27C4A0; }
      &.trial   { color: #f0a500; }
    }

    .stat-label { font-size: 11px; color: #9aa5b4; text-transform: uppercase; letter-spacing: 0.5px; }

    .filters {
      display: flex; gap: 12px; margin-bottom: 20px; align-items: center;
      .search-field { flex: 1; }
      mat-form-field { font-size: 14px; }
    }

    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .table-wrap {
      background: white; border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.07);
      overflow: hidden;
    }

    .orgs-table { width: 100%; }

    .mat-mdc-header-row {
      background: #f8fafc;
    }

    .mat-mdc-header-cell {
      font-size: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px;
      color: #9aa5b4 !important;
    }

    .mat-mdc-row:hover { background: #f8fbff; }
    .suspended-row { opacity: 0.55; }

    .org-name-cell { display: flex; flex-direction: column; }
    .org-name { font-size: 14px; font-weight: 600; color: #1B2A47; }
    .org-slug { font-size: 11px; color: #9aa5b4; font-family: monospace; }

    .plan-badge {
      display: inline-block; padding: 2px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      &.starter      { background: #e8f4fd; color: #2080b0; }
      &.professional { background: rgba(39,196,160,0.12); color: #1a9678; }
      &.enterprise   { background: rgba(27,42,71,0.1); color: #1B2A47; }
    }

    .status-badge {
      display: inline-block; padding: 2px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 600;
      &.active    { background: rgba(39,196,160,0.12); color: #1a9678; }
      &.trial     { background: rgba(240,165,0,0.12);  color: #a07000; }
      &.suspended { background: rgba(229,62,62,0.12);  color: #c53030; }
    }

    .users-count {
      font-size: 13px; color: #5a6a7e;
      &.near-limit { color: #c53030; font-weight: 600; }
    }

    .module-icons { display: flex; gap: 4px; }
    .module-icon { font-size: 16px; width: 16px; height: 16px; color: #9aa5b4; }

    .email-cell { font-size: 12px; color: #5a6a7e; }

    .no-results {
      display: flex; align-items: center; justify-content: center;
      gap: 8px; padding: 48px;
      color: #9aa5b4; font-size: 14px;
      mat-icon { font-size: 20px; }
    }
  `],
})
export class OrganizationsComponent implements OnInit {
  cols = ['name', 'plan', 'status', 'users', 'modules', 'billingEmail', 'createdAt', 'actions'];

  loading = signal(true);
  orgs    = signal<OrgRow[]>([]);
  stats   = signal<Stats | null>(null);
  filtered = signal<OrgRow[]>([]);

  search       = '';
  planFilter   = '';
  statusFilter = '';

  constructor(
    private api: ApiService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadOrgs();
  }

  loadStats(): void {
    this.api.get<Stats>('/system-admin/stats').subscribe({
      next: (s) => this.stats.set(s),
      error: () => {},
    });
  }

  loadOrgs(): void {
    this.loading.set(true);
    this.api.get<OrgRow[]>('/system-admin/organizations').subscribe({
      next: (list) => {
        this.orgs.set(list);
        this.applyFilter();
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilter(): void {
    const q = this.search.toLowerCase();
    this.filtered.set(
      this.orgs().filter((o) => {
        const matchSearch =
          !q ||
          o.name.toLowerCase().includes(q) ||
          o.slug.toLowerCase().includes(q) ||
          o.billingEmail.toLowerCase().includes(q);
        const matchPlan   = !this.planFilter   || o.plan === this.planFilter;
        const matchStatus = !this.statusFilter ||
          (this.statusFilter === 'active'    &&  o.isActive) ||
          (this.statusFilter === 'suspended' && !o.isActive);
        return matchSearch && matchPlan && matchStatus;
      })
    );
  }

  isOnTrial(o: OrgRow): boolean {
    return !!o.trialEndsAt && new Date(o.trialEndsAt) > new Date();
  }

  nearLimit(o: OrgRow): boolean {
    return (o.userCount ?? 0) >= o.maxUsers * 0.9;
  }

  moduleIcon(m: string): string {
    return m === 'conflict' ? 'warning_amber' : m === 'neuroinclusion' ? 'psychology' : 'trending_up';
  }

  moduleLabel(m: string): string {
    return m === 'conflict' ? 'Conflict' : m === 'neuroinclusion' ? 'Neuro-Inclusion' : 'Succession';
  }

  openCreate(): void {
    const ref = this.dialog.open(OrgEditDialogComponent, {
      width: '640px',
      disableClose: true,
      data: {},
    });
    ref.afterClosed().subscribe((result) => {
      if (result) { this.loadOrgs(); this.loadStats(); }
    });
  }

  openEdit(org: OrgRow): void {
    const ref = this.dialog.open(OrgEditDialogComponent, {
      width: '640px',
      disableClose: true,
      data: { ...org },
    });
    ref.afterClosed().subscribe((result) => {
      if (result) { this.loadOrgs(); this.loadStats(); }
    });
  }

  toggleSuspend(org: OrgRow): void {
    const newState = !org.isActive;
    const action   = newState ? 'reactivate' : 'suspend';

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title:        newState ? 'Reactivate Organisation' : 'Suspend Organisation',
        message:      newState
          ? `Reactivate "${org.name}"? Users will regain access immediately.`
          : `Suspend "${org.name}"? All users in this organisation will lose access.`,
        confirmLabel: newState ? 'Reactivate' : 'Suspend',
        confirmColor: newState ? 'primary' : 'warn',
        icon:         newState ? 'check_circle' : 'block',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      const req$ = newState
        ? this.api.put(`/system-admin/organizations/${org._id}`, { isActive: true })
        : this.api.delete(`/system-admin/organizations/${org._id}`);

      req$.subscribe({
        next: () => {
          this.snack.open(`Organisation ${action}d`, 'Close', { duration: 2500 });
          this.loadOrgs();
          this.loadStats();
        },
        error: () => this.snack.open('Action failed', 'Close', { duration: 2500 }),
      });
    });
  }
}
