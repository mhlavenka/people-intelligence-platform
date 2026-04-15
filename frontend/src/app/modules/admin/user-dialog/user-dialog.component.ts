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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { environment } from '../../../../environments/environment';
import { Sponsor, SponsorService } from '../../sponsor/sponsor.service';

export interface OrgUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  sponsorId?: string | { _id: string; name?: string; email?: string; organization?: string };
  customRoleId?: string;
  profilePicture?: string;
  isActive: boolean;
  isCoachee?: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

interface CustomRoleOption {
  _id: string;
  name: string;
  color: string;
  baseRole: string;
}

const ROLES = [
  { value: 'admin',       label: 'Admin' },
  { value: 'hr_manager',  label: 'HR Manager' },
  { value: 'manager',     label: 'Manager' },
  { value: 'coach',       label: 'Coach' },
  { value: 'coachee',     label: 'Coachee' },
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
    MatCheckboxModule,
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

      @if (isEdit()) {
        <div class="avatar-upload-row">
          <div class="avatar-edit-wrapper" (click)="avatarInput.click()">
            @if (avatarPreview()) {
              <img class="avatar-edit" [src]="avatarPreview()" alt="Avatar" />
            } @else {
              <div class="avatar-edit avatar-initials">{{ existingUser!.firstName[0] }}{{ existingUser!.lastName[0] }}</div>
            }
            <div class="avatar-edit-overlay"><mat-icon>photo_camera</mat-icon></div>
            <input #avatarInput type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="uploadAvatar($event)" />
          </div>
          <span class="avatar-hint">Click to change profile picture</span>
        </div>
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
          <mat-label>System Role</mat-label>
          <mat-select formControlName="role">
            @for (r of roles; track r.value) {
              <mat-option [value]="r.value">{{ r.label }}</mat-option>
            }
          </mat-select>
          <mat-hint>Base access level — determines API route access</mat-hint>
        </mat-form-field>

        @if (customRolesAvailable().length > 0) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Custom Role (optional)</mat-label>
            <mat-select formControlName="customRoleId">
              <mat-option [value]="''">
                <em>None — use system role permissions</em>
              </mat-option>
              @for (cr of customRolesAvailable(); track cr._id) {
                <mat-option [value]="cr._id">
                  <span class="cr-option">
                    <span class="cr-dot" [style.background]="cr.color"></span>
                    {{ cr.name }}
                    <span class="cr-base-label">{{ baseLabel(cr.baseRole) }}</span>
                  </span>
                </mat-option>
              }
            </mat-select>
            <mat-hint>Overrides the system role with custom permissions</mat-hint>
          </mat-form-field>
        }

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Department (optional)</mat-label>
          <mat-select formControlName="department">
            <mat-option value="">— None —</mat-option>
            @for (dept of departments(); track dept) {
              <mat-option [value]="dept">{{ dept }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (form.get('role')?.value === 'coachee') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Sponsor (optional)</mat-label>
            <mat-select formControlName="sponsorId">
              <mat-option value="">— None —</mat-option>
              @for (s of sponsors(); track s._id) {
                <mat-option [value]="s._id">
                  {{ s.name }} <span class="muted">— {{ s.email }}</span>
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        @if (form.get('role')?.value !== 'coachee') {
          <label class="coachee-toggle">
            <mat-checkbox formControlName="isCoachee" color="primary" />
            <div class="coachee-toggle-text">
              <div class="coachee-toggle-title">This user is also a coachee</div>
              <div class="coachee-toggle-hint">
                Enable for internal employees who are receiving coaching in addition to their org role.
              </div>
            </div>
          </label>
        }

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

    .cr-option {
      display: flex; align-items: center; gap: 8px;
    }

    .cr-dot {
      width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
    }

    .cr-base-label {
      font-size: 11px; color: #9aa5b4; margin-left: auto;
    }

    .avatar-upload-row {
      display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
    }
    .avatar-edit-wrapper {
      position: relative; cursor: pointer; flex-shrink: 0;
      &:hover .avatar-edit-overlay { opacity: 1; }
    }
    .avatar-edit {
      width: 56px; height: 56px; border-radius: 50%; object-fit: cover;
    }
    .avatar-initials {
      background: linear-gradient(135deg, #3A9FD6, #27C4A0);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 700; color: white;
    }
    .avatar-edit-overlay {
      position: absolute; inset: 0; border-radius: 50%;
      background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.15s;
      mat-icon { color: white; font-size: 20px; width: 20px; height: 20px; }
    }
    .avatar-hint { font-size: 12px; color: #9aa5b4; }

    .coachee-toggle {
      display: flex; align-items: flex-start; gap: 10px; cursor: pointer;
      padding: 10px 12px; border-radius: 8px; border: 1px solid #e8edf4;
      background: rgba(124,92,191,0.05); margin: 4px 0 8px;
      transition: background 0.15s, border-color 0.15s;
      &:hover { background: rgba(124,92,191,0.10); border-color: rgba(124,92,191,0.3); }
    }
    .coachee-toggle-text { flex: 1; }
    .coachee-toggle-title {
      font-size: 13px; font-weight: 600; color: #1B2A47;
    }
    .coachee-toggle-hint {
      font-size: 11px; color: #5a6a7e; margin-top: 2px; line-height: 1.4;
    }
  `],
})
export class UserDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private sponsorSvc = inject(SponsorService);
  private dialogRef = inject(MatDialogRef<UserDialogComponent>);
  existingUser = inject<OrgUser | null>(MAT_DIALOG_DATA, { optional: true });

  form!: FormGroup;
  saving = signal(false);
  error = signal('');
  departments = signal<string[]>([]);
  sponsors = signal<Sponsor[]>([]);
  customRolesAvailable = signal<CustomRoleOption[]>([]);
  avatarPreview = signal('');
  showPwd = false;
  roles = ROLES;

  private readonly BASE_LABELS: Record<string, string> = {
    admin: 'Admin', hr_manager: 'HR Manager', manager: 'Manager',
    coach: 'Coach', coachee: 'Coachee',
  };

  isEdit = () => !!this.existingUser;

  baseLabel = (key: string) => this.BASE_LABELS[key] ?? key;

  /** sponsorId may come back populated as { _id, ... } or as a raw id string. */
  private normalizeSponsorId(s: unknown): string | undefined {
    if (!s) return undefined;
    if (typeof s === 'string') return s;
    if (typeof s === 'object' && s !== null && '_id' in s) {
      return String((s as { _id: unknown })._id);
    }
    return undefined;
  }

  ngOnInit(): void {
    if (this.existingUser?.profilePicture) {
      this.avatarPreview.set(this.existingUser.profilePicture);
    }
    this.form = this.fb.group({
      firstName:    [this.existingUser?.firstName  ?? '', Validators.required],
      lastName:     [this.existingUser?.lastName   ?? '', Validators.required],
      email:        [this.existingUser?.email      ?? '', [Validators.required, Validators.email]],
      role:         [this.existingUser?.role        ?? 'coachee', Validators.required],
      customRoleId: [this.existingUser?.customRoleId ?? ''],
      department:   [this.existingUser?.department ?? ''],
      sponsorId:    [this.normalizeSponsorId(this.existingUser?.sponsorId) ?? ''],
      isCoachee:    [this.existingUser?.isCoachee === true],
      ...(this.isEdit() ? {} : {
        password: ['', [Validators.required, Validators.minLength(8)]],
      }),
    });

    this.api.get<{ departments: string[] }>('/organizations/me').subscribe({
      next: (org) => this.departments.set(org.departments ?? []),
    });

    this.api.get<CustomRoleOption[]>('/roles').subscribe({
      next: (roles) => this.customRolesAvailable.set(roles),
    });

    this.sponsorSvc.list().subscribe({
      next: (s) => this.sponsors.set(s),
      error: () => {},
    });
  }

  uploadAvatar(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.existingUser) return;
    const formData = new FormData();
    formData.append('avatar', file);
    const url = `${environment.apiUrl}/users/${this.existingUser._id}/avatar`;
    const headers = { Authorization: `Bearer ${this.auth.getToken()}` };
    fetch(url, { method: 'POST', headers, body: formData })
      .then((r) => r.json())
      .then((data) => {
        if (data.profilePicture) {
          this.avatarPreview.set(data.profilePicture);
        }
      })
      .catch(() => this.error.set('Failed to upload picture'));
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error.set('');

    const payload = { ...this.form.value };
    // Send null to clear custom role / sponsor when empty string selected
    if (!payload.customRoleId) { payload.customRoleId = null; }
    if (!payload.sponsorId)    { payload.sponsorId = null; }
    // Sponsor only applies to coachees; strip it for any other role.
    if (payload.role !== 'coachee') { payload.sponsorId = null; }
    // role='coachee' is implicitly a coachee — normalise the flag so the
    // list view and the post-save hook see a consistent value.
    if (payload.role === 'coachee') { payload.isCoachee = true; }

    const request = this.isEdit()
      ? this.api.put(`/users/${this.existingUser!._id}`, payload)
      : this.api.post('/users', payload);

    request.subscribe({
      next: (result) => { this.saving.set(false); this.dialogRef.close(result); },
      error: (err) => {
        this.error.set(err.error?.error || err.error?.message || 'Failed to save user.');
        this.saving.set(false);
      },
    });
  }
}
