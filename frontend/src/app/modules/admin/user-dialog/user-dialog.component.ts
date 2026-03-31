import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/api.service';

export interface OrgUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

const ROLES = [
  { value: 'admin',       label: 'Admin' },
  { value: 'hr_manager',  label: 'HR Manager' },
  { value: 'manager',     label: 'Manager' },
  { value: 'coach',       label: 'Coach' },
  { value: 'coachee',     label: 'Coachee / Employee' },
];

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ isEdit() ? 'edit' : 'person_add' }}</mat-icon>
      {{ isEdit() ? 'Edit User' : 'Add User' }}
    </h2>

    <mat-dialog-content>
      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <form [formGroup]="form" class="dialog-form">
        <div class="name-row">
          <mat-form-field appearance="outline">
            <mat-label>First Name</mat-label>
            <input matInput formControlName="firstName" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Last Name</mat-label>
            <input matInput formControlName="lastName" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            @for (r of roles; track r.value) {
              <mat-option [value]="r.value">{{ r.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Department (optional)</mat-label>
          <mat-select formControlName="department">
            <mat-option value="">— None —</mat-option>
            @for (dept of departments(); track dept) {
              <mat-option [value]="dept">{{ dept }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (!isEdit()) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Password</mat-label>
            <input matInput formControlName="password" [type]="showPwd ? 'text' : 'password'" />
            <button mat-icon-button matSuffix type="button" (click)="showPwd = !showPwd">
              <mat-icon>{{ showPwd ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-hint>Minimum 8 characters</mat-hint>
          </mat-form-field>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
      <button mat-raised-button color="primary"
              (click)="save()" [disabled]="form.invalid || saving()">
        @if (saving()) {
          <mat-spinner diameter="18" />
        } @else {
          <mat-icon>{{ isEdit() ? 'save' : 'person_add' }}</mat-icon>
          {{ isEdit() ? 'Save Changes' : 'Add User' }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex; align-items: center; gap: 8px; color: #1B2A47;
      mat-icon { color: #3A9FD6; }
    }

    mat-dialog-content { min-width: 480px; padding-top: 8px !important; }

    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;
    }

    .dialog-form { display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }

    .name-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .full-width { width: 100%; }
  `],
})
export class UserDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<UserDialogComponent>);
  existingUser = inject<OrgUser | null>(MAT_DIALOG_DATA, { optional: true });

  form!: FormGroup;
  saving = signal(false);
  error = signal('');
  departments = signal<string[]>([]);
  showPwd = false;
  roles = ROLES;

  isEdit = () => !!this.existingUser;

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName:  [this.existingUser?.firstName  ?? '', Validators.required],
      lastName:   [this.existingUser?.lastName   ?? '', Validators.required],
      email:      [this.existingUser?.email      ?? '', [Validators.required, Validators.email]],
      role:       [this.existingUser?.role       ?? 'coachee', Validators.required],
      department: [this.existingUser?.department ?? ''],
      ...(this.isEdit() ? {} : {
        password: ['', [Validators.required, Validators.minLength(8)]],
      }),
    });

    this.api.get<{ departments: string[] }>('/organizations/me').subscribe({
      next: (org) => this.departments.set(org.departments ?? []),
    });
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error.set('');

    const request = this.isEdit()
      ? this.api.put(`/users/${this.existingUser!._id}`, this.form.value)
      : this.api.post('/users', this.form.value);

    request.subscribe({
      next: (result) => { this.saving.set(false); this.dialogRef.close(result); },
      error: (err) => {
        this.error.set(err.error?.error || err.error?.message || 'Failed to save user.');
        this.saving.set(false);
      },
    });
  }
}
