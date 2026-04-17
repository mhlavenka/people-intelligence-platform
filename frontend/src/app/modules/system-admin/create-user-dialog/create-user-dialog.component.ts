import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-create-user-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title><mat-icon>person_add</mat-icon> Create User — {{ data.orgName }}</h2>
    <mat-dialog-content>
      @if (error()) { <div class="error-banner">{{ error() }}</div> }
      <div class="form-col">
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>First Name</mat-label>
            <input matInput [(ngModel)]="firstName" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Last Name</mat-label>
            <input matInput [(ngModel)]="lastName" required /></mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full-width"><mat-label>Email</mat-label>
          <input matInput [(ngModel)]="email" type="email" required /></mat-form-field>
        <mat-form-field appearance="outline" class="full-width"><mat-label>Password</mat-label>
          <input matInput [(ngModel)]="password" type="password" required />
          <mat-hint>Minimum 8 characters</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width"><mat-label>Role</mat-label>
          <mat-select [(ngModel)]="role">
            <mat-option value="admin">Admin</mat-option>
            <mat-option value="hr_manager">HR Manager</mat-option>
            <mat-option value="manager">Manager</mat-option>
            <mat-option value="coach">Coach</mat-option>
            <mat-option value="coachee">Employee</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()"
              [disabled]="saving() || !firstName || !lastName || !email || !password || password.length < 8">
        @if (saving()) { <mat-spinner diameter="18" /> }
        @else { <mat-icon>person_add</mat-icon> }
        Create User
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] { display: flex; align-items: center; gap: 8px; color: var(--artes-primary); mat-icon { color: var(--artes-accent); } }
    mat-dialog-content { min-width: 440px; padding-top: 8px !important; }
    .form-col { display: flex; flex-direction: column; gap: 4px; }
    .form-row { display: flex; gap: 12px; mat-form-field { flex: 1; } }
    .full-width { width: 100%; }
    .error-banner { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
  `],
})
export class CreateUserDialogComponent {
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<CreateUserDialogComponent>);
  data = inject<{ orgId: string; orgName: string }>(MAT_DIALOG_DATA);

  saving = signal(false);
  error = signal('');
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  role = 'admin';

  save(): void {
    this.saving.set(true);
    this.error.set('');
    this.api.post(`/system-admin/organizations/${this.data.orgId}/users`, {
      firstName: this.firstName, lastName: this.lastName,
      email: this.email, password: this.password, role: this.role,
    }).subscribe({
      next: (result) => { this.saving.set(false); this.dialogRef.close(result); },
      error: (err) => { this.saving.set(false); this.error.set(err.error?.error || 'Failed to create user'); },
    });
  }
}
