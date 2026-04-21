import { Component, Inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';

interface UserOption {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  selected: boolean;
}

@Component({
  selector: 'app-intake-assign-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule, MatTabsModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDividerModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>send</mat-icon>
      {{ 'SURVEY.assignIntake' | translate }}
    </h2>
    <p class="subtitle">{{ data.title }}</p>

    <mat-dialog-content>
      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="32" /></div>
      } @else {
        <mat-tab-group animationDuration="200ms" color="primary">
          <!-- Departments tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>business</mat-icon>
              {{ 'SURVEY.assignToDepartments' | translate }}
              @if (selectedDepts().size) {
                <span class="tab-badge">{{ selectedDepts().size }}</span>
              }
            </ng-template>

            <div class="tab-body">
              @if (departments().length === 0) {
                <p class="no-results">{{ 'SURVEY.noDepartments' | translate }}</p>
              } @else {
                <div class="chips-wrap">
                  @for (dept of departments(); track dept) {
                    <button
                      class="dept-chip"
                      [class.selected]="selectedDepts().has(dept)"
                      (click)="toggleDept(dept)"
                    >
                      <mat-icon>{{ selectedDepts().has(dept) ? 'check_circle' : 'circle' }}</mat-icon>
                      {{ dept }}
                      <span class="dept-count">({{ deptUserCount(dept) }})</span>
                    </button>
                  }
                </div>
              }
            </div>
          </mat-tab>

          <!-- Individual users tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>person</mat-icon>
              {{ 'SURVEY.assignToUsers' | translate }}
              @if (selectedUserCount()) {
                <span class="tab-badge">{{ selectedUserCount() }}</span>
              }
            </ng-template>

            <div class="tab-body">
              <mat-form-field appearance="outline" class="search-field">
                <mat-icon matPrefix>search</mat-icon>
                <input matInput [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)" [placeholder]="'SURVEY.searchUsers' | translate">
              </mat-form-field>
              <div class="users-list">
                @for (user of filteredUsers(); track user._id) {
                  <label class="user-row">
                    <mat-checkbox
                      [checked]="user.selected"
                      (change)="toggleUser(user)"
                      color="primary"
                    />
                    <span class="user-info">
                      <span class="user-name">{{ user.firstName }} {{ user.lastName }}</span>
                      <span class="user-email">{{ user.email }}</span>
                    </span>
                    @if (user.department) {
                      <span class="user-dept">{{ user.department }}</span>
                    }
                  </label>
                }
                @if (filteredUsers().length === 0) {
                  <p class="no-results">{{ 'SURVEY.noUsersFound' | translate }}</p>
                }
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>

        <mat-divider />

        <!-- Optional message -->
        <section>
          <h3>{{ 'SURVEY.assignMessage' | translate }}</h3>
          <mat-form-field appearance="outline" class="full-width">
            <textarea matInput [(ngModel)]="message" rows="2"
                      [placeholder]="'SURVEY.assignMessagePlaceholder' | translate"></textarea>
          </mat-form-field>
        </section>

        <!-- Summary -->
        @if (totalRecipients() > 0) {
          <div class="summary">
            <mat-icon>group</mat-icon>
            {{ 'SURVEY.assignSummary' | translate: { count: totalRecipients() } }}
          </div>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'COMMON.cancel' | translate }}</button>
      <button mat-raised-button color="primary"
              [disabled]="totalRecipients() === 0 || submitting()"
              (click)="assign()">
        @if (submitting()) {
          <mat-spinner diameter="20" />
        } @else {
          <mat-icon>send</mat-icon>
          {{ 'SURVEY.assignSend' | translate }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
    .subtitle { color: #5a6a7e; font-size: 13px; margin: -8px 0 8px 0; padding: 0 24px; }
    mat-dialog-content { max-height: 60vh; }
    section { margin: 16px 0; }
    h3 { font-size: 14px; font-weight: 600; color: var(--artes-primary, #1B2A47); margin: 0 0 10px; }

    ::ng-deep .mat-mdc-tab .mdc-tab__text-label {
      display: flex; align-items: center; gap: 6px;
    }
    .tab-badge {
      background: var(--artes-accent, #3A9FD6); color: white;
      font-size: 11px; font-weight: 700; min-width: 18px; height: 18px;
      border-radius: 999px; display: inline-flex; align-items: center;
      justify-content: center; padding: 0 5px; line-height: 1;
    }
    .tab-body { padding: 16px 0; min-height: 200px; }

    .chips-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
    .dept-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 14px; border-radius: 999px;
      border: 1px solid #dce6f0; background: #f8fafc;
      font-size: 13px; cursor: pointer; color: #5a6a7e;
      transition: all 0.15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      .dept-count { font-size: 11px; color: #9aa5b4; }
      &.selected {
        background: var(--artes-accent, #3A9FD6); color: white; border-color: transparent;
        .dept-count { color: rgba(255,255,255,0.7); }
      }
    }

    .search-field { width: 100%; }
    .users-list { max-height: 260px; overflow-y: auto; }
    .user-row {
      display: flex; align-items: center; gap: 8px; padding: 6px 4px;
      border-radius: 8px; cursor: pointer;
      &:hover { background: #f4f7fa; }
    }
    .user-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .user-name { font-size: 13px; font-weight: 500; color: #1B2A47; }
    .user-email { font-size: 11px; color: #9aa5b4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-dept {
      font-size: 11px; padding: 2px 8px; border-radius: 999px;
      background: #f0f4f8; color: #5a6a7e; white-space: nowrap;
    }
    .no-results { color: #9aa5b4; font-size: 13px; text-align: center; padding: 16px; }
    .full-width { width: 100%; }
    .summary {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 14px; border-radius: 8px;
      background: rgba(39,196,160,0.08); color: #1a9678;
      font-size: 13px; font-weight: 500;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .loading-center { display: flex; justify-content: center; padding: 40px; }
    mat-divider { margin: 16px 0; }
  `],
})
export class IntakeAssignDialogComponent implements OnInit {
  loading = signal(true);
  submitting = signal(false);
  departments = signal<string[]>([]);
  users = signal<UserOption[]>([]);
  selectedDepts = signal<Set<string>>(new Set());
  searchTerm = signal('');
  message = '';

  filteredUsers = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.users().filter((u) =>
      !term || u.firstName.toLowerCase().includes(term)
            || u.lastName.toLowerCase().includes(term)
            || u.email.toLowerCase().includes(term)
    );
  });

  selectedUserCount = computed(() => this.users().filter((u) => u.selected).length);

  totalRecipients = computed(() => {
    const deptUsers = new Set<string>();
    const depts = this.selectedDepts();
    if (depts.size) {
      for (const u of this.users()) {
        if (u.department && depts.has(u.department)) deptUsers.add(u._id);
      }
    }
    const selected = this.users().filter((u) => u.selected).map((u) => u._id);
    const all = new Set([...deptUsers, ...selected]);
    return all.size;
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { _id: string; title: string },
    private dialogRef: MatDialogRef<IntakeAssignDialogComponent>,
    private api: ApiService,
    private snackBar: MatSnackBar,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    let orgDone = false, usersDone = false, assignDone = false;
    let previouslyAssignedUserIds = new Set<string>();
    let previouslyAssignedDepts = new Set<string>();

    const checkReady = () => {
      if (!orgDone || !usersDone || !assignDone) return;
      // Pre-select users from previous assignments
      if (previouslyAssignedUserIds.size) {
        this.users.update((list) =>
          list.map((u) => previouslyAssignedUserIds.has(u._id) ? { ...u, selected: true } : u)
        );
      }
      if (previouslyAssignedDepts.size) {
        this.selectedDepts.set(previouslyAssignedDepts);
      }
      this.loading.set(false);
    };

    this.api.get<{ departments: string[] }>('/organizations/me').subscribe({
      next: (org) => { this.departments.set(org.departments ?? []); orgDone = true; checkReady(); },
      error: () => { orgDone = true; checkReady(); },
    });

    this.api.get<UserOption[]>('/users').subscribe({
      next: (users) => { this.users.set(users.map((u) => ({ ...u, selected: false }))); usersDone = true; checkReady(); },
      error: () => { usersDone = true; checkReady(); },
    });

    this.api.get<any[]>(`/surveys/templates/${this.data._id}/assignments`).subscribe({
      next: (assignments) => {
        for (const a of assignments) {
          if (a.userIds) for (const uid of a.userIds) previouslyAssignedUserIds.add(uid);
          if (a.departments) for (const d of a.departments) previouslyAssignedDepts.add(d);
        }
        assignDone = true;
        checkReady();
      },
      error: () => { assignDone = true; checkReady(); },
    });
  }

  toggleDept(dept: string): void {
    this.selectedDepts.update((set) => {
      const next = new Set(set);
      next.has(dept) ? next.delete(dept) : next.add(dept);
      return next;
    });
  }

  toggleUser(user: UserOption): void {
    this.users.update((list) =>
      list.map((u) => u._id === user._id ? { ...u, selected: !u.selected } : u)
    );
  }

  deptUserCount(dept: string): number {
    return this.users().filter((u) => u.department === dept).length;
  }

  assign(): void {
    this.submitting.set(true);
    const userIds = this.users().filter((u) => u.selected).map((u) => u._id);
    const departments = Array.from(this.selectedDepts());

    this.api.post(`/surveys/templates/${this.data._id}/assign`, {
      userIds,
      departments,
      message: this.message || undefined,
    }).subscribe({
      next: (res: any) => {
        this.submitting.set(false);
        this.snackBar.open(
          this.translate.instant('SURVEY.assignSuccess', { count: res.notifiedCount ?? 0 }),
          this.translate.instant('COMMON.close'),
          { duration: 3500 },
        );
        this.dialogRef.close(true);
      },
      error: () => {
        this.submitting.set(false);
        this.snackBar.open(
          this.translate.instant('SURVEY.assignFailed'),
          this.translate.instant('COMMON.close'),
          { duration: 3000 },
        );
      },
    });
  }
}
