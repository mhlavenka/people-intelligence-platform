import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../../../core/api.service';
import { UserDialogComponent, OrgUser } from '../user-dialog/user-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';

const ROLE_META: Record<string, { label: string; color: string }> = {
  admin:      { label: 'Admin',      color: '#1B2A47' },
  hr_manager: { label: 'HR Manager', color: '#2080b0' },
  manager:    { label: 'Manager',    color: '#b07800' },
  coach:      { label: 'Coach',      color: '#1a9678' },
  coachee:    { label: 'Coachee',    color: '#5a6a7e' },
};

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatMenuModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatInputModule,
    MatFormFieldModule,
    MatDividerModule,
  ],
  template: `
    <div class="users-page">
      <div class="page-header">
        <div>
          <h1>User Management</h1>
          <p>Manage team members and their access roles</p>
        </div>
        <button mat-raised-button color="primary" (click)="openAddDialog()">
          <mat-icon>person_add</mat-icon> Add User
        </button>
      </div>

      <!-- Stats row -->
      <div class="stats-row">
        @for (stat of stats(); track stat.label) {
          <div class="stat-card">
            <div class="stat-num">{{ stat.count }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        }
      </div>

      <!-- Search + filter -->
      <div class="toolbar">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search users</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Name or email…" />
          @if (searchQuery()) {
            <button mat-icon-button matSuffix (click)="searchQuery.set('')">
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>

        <div class="role-filters">
          <button class="role-chip" [class.active]="roleFilter() === 'all'"
                  (click)="roleFilter.set('all')">All</button>
          @for (r of roleOptions; track r.value) {
            <button class="role-chip" [class.active]="roleFilter() === r.value"
                    (click)="roleFilter.set(r.value)">{{ r.label }}</button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <mat-icon>group</mat-icon>
          <h3>No users found</h3>
          <p>{{ searchQuery() ? 'Try a different search term.' : 'Add your first team member.' }}</p>
        </div>
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="filtered()" class="users-table">

            <!-- Avatar + name -->
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>User</th>
              <td mat-cell *matCellDef="let u">
                <div class="user-cell">
                  @if (u.profilePicture) {
                    <img class="avatar avatar-img" [class.inactive]="!u.isActive" [src]="u.profilePicture" alt="" />
                  } @else {
                    <div class="avatar" [class.inactive]="!u.isActive">
                      {{ initials(u) }}
                    </div>
                  }
                  <div class="user-info">
                    <span class="user-name">{{ u.firstName }} {{ u.lastName }}</span>
                    <span class="user-email">{{ u.email }}</span>
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- Role -->
            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>Role</th>
              <td mat-cell *matCellDef="let u">
                <span class="role-badge" [style.background]="roleMeta(u.role).color + '22'"
                      [style.color]="roleMeta(u.role).color">
                  {{ roleMeta(u.role).label }}
                </span>
              </td>
            </ng-container>

            <!-- Department -->
            <ng-container matColumnDef="department">
              <th mat-header-cell *matHeaderCellDef>Department</th>
              <td mat-cell *matCellDef="let u" class="meta-cell">
                {{ u.department || '—' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="sponsor">
              <th mat-header-cell *matHeaderCellDef>Sponsor</th>
              <td mat-cell *matCellDef="let u" class="meta-cell">
                {{ sponsorName(u) }}
              </td>
            </ng-container>

            <!-- Status -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let u">
                <mat-slide-toggle
                  [checked]="u.isActive"
                  (change)="toggleActive(u)"
                  [matTooltip]="u.isActive ? 'Deactivate' : 'Activate'"
                  color="primary"
                />
              </td>
            </ng-container>

            <!-- Last login -->
            <ng-container matColumnDef="lastLogin">
              <th mat-header-cell *matHeaderCellDef>Last Login</th>
              <td mat-cell *matCellDef="let u" class="meta-cell">
                {{ u.lastLoginAt ? (u.lastLoginAt | date:'MMM d, y') : '—' }}
              </td>
            </ng-container>

            <!-- Created -->
            <ng-container matColumnDef="created">
              <th mat-header-cell *matHeaderCellDef>Added</th>
              <td mat-cell *matCellDef="let u" class="meta-cell">
                {{ u.createdAt | date:'MMM d, y' }}
              </td>
            </ng-container>

            <!-- Actions -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let u">
                <button mat-icon-button [matMenuTriggerFor]="rowMenu"
                        [matMenuTriggerData]="{ user: u }">
                  <mat-icon>more_vert</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;"
                [class.inactive-row]="!row.isActive"></tr>
          </table>
        </div>
      }
    </div>

    <!-- Shared row menu -->
    <mat-menu #rowMenu="matMenu">
      <ng-template matMenuContent let-u="user">
        <button mat-menu-item (click)="openEditDialog(u)">
          <mat-icon>edit</mat-icon> Edit
        </button>
        <button mat-menu-item (click)="toggleActive(u)">
          <mat-icon>{{ u.isActive ? 'block' : 'check_circle' }}</mat-icon>
          {{ u.isActive ? 'Deactivate' : 'Activate' }}
        </button>
        <mat-divider />
        <button mat-menu-item class="danger-item" (click)="deleteUser(u)">
          <mat-icon>delete</mat-icon> Delete
        </button>
      </ng-template>
    </mat-menu>
  `,
  styles: [`
    .users-page { padding: 32px; width: 100%; max-width: 100%; box-sizing: border-box; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px;
      h1 { font-size: 28px; color: #1B2A47; margin: 0 0 4px; }
      p  { color: #5a6a7e; margin: 0; }
    }

    .stats-row {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px;
    }

    .stat-card {
      background: white; border-radius: 12px; padding: 16px 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;
      .stat-num   { font-size: 28px; font-weight: 700; color: #1B2A47; }
      .stat-label { font-size: 12px; color: #9aa5b4; margin-top: 2px; }
    }

    .toolbar {
      display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;
    }

    .search-field { width: 280px; }

    .role-filters { display: flex; gap: 6px; flex-wrap: wrap; }

    .role-chip {
      padding: 5px 14px; border-radius: 999px; border: 1px solid #dce6f0;
      background: white; font-size: 12px; cursor: pointer; color: #5a6a7e;
      transition: all 0.15s;
      &:hover { border-color: #3A9FD6; color: #3A9FD6; }
      &.active { background: #1B2A47; color: white; border-color: #1B2A47; }
    }

    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .empty-state {
      text-align: center; padding: 64px; background: white;
      border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      mat-icon { font-size: 56px; width: 56px; height: 56px; color: #9aa5b4; margin-bottom: 16px; }
      h3 { font-size: 20px; color: #1B2A47; margin-bottom: 8px; }
      p  { color: #5a6a7e; margin: 0; }
    }

    .table-card {
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden;
    }

    .users-table { width: 100%; }

    .user-cell { display: flex; align-items: center; gap: 12px; padding: 4px 0; }

    .avatar {
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #3A9FD6, #27C4A0);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: white;
      &.inactive { background: #d1d5db; }
    }
    .avatar-img { object-fit: cover; }

    .user-info { display: flex; flex-direction: column; }
    .user-name  { font-size: 14px; font-weight: 500; color: #1B2A47; }
    .user-email { font-size: 12px; color: #9aa5b4; }

    .role-badge {
      padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700;
      text-transform: uppercase;
    }

    .meta-cell { font-size: 13px; color: #9aa5b4; }

    .inactive-row { opacity: 0.55; }

    .danger-item { color: #e53e3e; }
  `],
})
export class UserManagementComponent implements OnInit {
  users = signal<OrgUser[]>([]);
  loading = signal(true);
  roleFilter = signal('all');
  searchQuery = signal('');

  columns = ['name', 'role', 'department', 'sponsor', 'status', 'lastLogin', 'created', 'actions'];

  /** Render the sponsor as "{company} / {name}". Falls back to whichever
   *  field is present, or em-dash when the user has no sponsor. */
  sponsorName(u: OrgUser): string {
    const s = u.sponsorId;
    if (!s || typeof s !== 'object') return '—';
    const company = (s.organization ?? '').trim();
    const name = (s.name ?? '').trim();
    if (company && name) return `${company} / ${name}`;
    return company || name || '—';
  }

  roleOptions = [
    { value: 'admin',      label: 'Admin' },
    { value: 'hr_manager', label: 'HR Manager' },
    { value: 'manager',    label: 'Manager' },
    { value: 'coach',      label: 'Coach' },
    { value: 'coachee',    label: 'Coachee' },
  ];

  filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.users().filter((u) => {
      const matchesRole = this.roleFilter() === 'all' || u.role === this.roleFilter();
      const matchesSearch = !q ||
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });
  });

  stats = computed(() => {
    const all = this.users();
    return [
      { label: 'Total',      count: all.length },
      { label: 'Active',     count: all.filter((u) => u.isActive).length },
      { label: 'Admins',     count: all.filter((u) => u.role === 'admin').length },
      { label: 'Managers',   count: all.filter((u) => u.role === 'manager' || u.role === 'hr_manager').length },
      { label: 'Coachees',   count: all.filter((u) => u.role === 'coachee').length },
    ];
  });

  roleMeta = (role: string) => ROLE_META[role] ?? { label: role, color: '#5a6a7e' };
  initials  = (u: OrgUser) => `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();

  constructor(
    private api: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void { this.loadUsers(); }

  loadUsers(): void {
    this.loading.set(true);
    this.api.get<OrgUser[]>('/users').subscribe({
      next: (users) => { this.users.set(users); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openAddDialog(): void {
    this.dialog.open(UserDialogComponent, { width: '520px', disableClose: true })
      .afterClosed().subscribe((result) => { if (result) this.loadUsers(); });
  }

  openEditDialog(user: OrgUser): void {
    this.dialog.open(UserDialogComponent, {
      width: '520px', disableClose: true, data: user,
    }).afterClosed().subscribe((result) => { if (result) this.loadUsers(); });
  }

  toggleActive(user: OrgUser): void {
    this.api.put(`/users/${user._id}`, { isActive: !user.isActive }).subscribe({
      next: () => {
        this.users.update((list) =>
          list.map((u) => u._id === user._id ? { ...u, isActive: !u.isActive } : u)
        );
        this.snackBar.open(
          `${user.firstName} ${!user.isActive ? 'activated' : 'deactivated'}`,
          'Close', { duration: 2500 }
        );
      },
      error: () => this.snackBar.open('Update failed', 'Close', { duration: 2500 }),
    });
  }

  deleteUser(user: OrgUser): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete User',
        message: `Permanently delete ${user.firstName} ${user.lastName}? This cannot be undone.`,
        confirmLabel: 'Delete',
        icon: 'person_remove',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.api.delete(`/users/${user._id}`).subscribe({
        next: () => {
          this.users.update((list) => list.filter((u) => u._id !== user._id));
          this.snackBar.open('User deleted', 'Close', { duration: 2500 });
        },
        error: (err) => this.snackBar.open(
          err.error?.error || 'Delete failed', 'Close', { duration: 3000 }
        ),
      });
    });
  }
}
