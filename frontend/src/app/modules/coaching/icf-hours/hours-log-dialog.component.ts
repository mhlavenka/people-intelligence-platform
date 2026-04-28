import { Component, Inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HoursLogPayload } from './icf-hours.types';

interface DialogData {
  entry?: HoursLogPayload;   // present → edit mode
  coachId?: string;          // admin acting on behalf of a coach
}

@Component({
  selector: 'app-hours-log-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatDatepickerModule,
    MatNativeDateModule, TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>schedule</mat-icon>
      {{ (isEdit() ? 'COACHING.editHoursDialogTitle' : 'COACHING.logHoursDialogTitle') | translate }}
    </h2>

    <mat-dialog-content class="dialog-body">
      <div class="row two-col">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'COACHING.icfCategory' | translate }}</mat-label>
          <mat-select [(ngModel)]="form.category" (selectionChange)="onCategoryChange()">
            <mat-option value="session">{{ 'COACHING.icfCatSession' | translate }}</mat-option>
            <mat-option value="mentor_coaching_received">{{ 'COACHING.icfCatMentor' | translate }}</mat-option>
            <mat-option value="cce">{{ 'COACHING.icfCatCce' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'COACHING.date' | translate }}</mat-label>
          <input matInput [matDatepicker]="dp" [(ngModel)]="dateValue" required />
          <mat-datepicker-toggle matIconSuffix [for]="dp" />
          <mat-datepicker #dp />
        </mat-form-field>
      </div>

      <div class="row two-col">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'COACHING.icfHoursValue' | translate }}</mat-label>
          <input matInput type="number" min="0" step="0.25" [(ngModel)]="form.hours" required />
        </mat-form-field>
      </div>

      <!-- Session-only fields -->
      @if (form.category === 'session') {
        <div class="row two-col">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.icfClientType' | translate }}</mat-label>
            <mat-select [(ngModel)]="form.clientType">
              <mat-option value="individual">{{ 'COACHING.icfClientIndividual' | translate }}</mat-option>
              <mat-option value="team">{{ 'COACHING.icfClientTeam' | translate }}</mat-option>
              <mat-option value="group">{{ 'COACHING.icfClientGroup' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.icfPaidStatus' | translate }}</mat-label>
            <mat-select [(ngModel)]="form.paidStatus">
              <mat-option value="paid">{{ 'COACHING.icfPaid' | translate }}</mat-option>
              <mat-option value="pro_bono">{{ 'COACHING.icfProBono' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="row two-col">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.icfClientName' | translate }}</mat-label>
            <input matInput [(ngModel)]="form.clientName" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.icfClientOrganization' | translate }}</mat-label>
            <input matInput [(ngModel)]="form.clientOrganization" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ 'COACHING.icfClientEmail' | translate }}</mat-label>
          <input matInput type="email" [(ngModel)]="form.clientEmail" />
          <mat-hint>{{ 'COACHING.icfClientEmailHint' | translate }}</mat-hint>
        </mat-form-field>

        <div class="row two-col">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.icfSponsorContactName' | translate }}</mat-label>
            <input matInput [(ngModel)]="form.sponsorContactName" />
            <mat-hint>{{ 'COACHING.icfSponsorContactHint' | translate }}</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.icfAssessmentType' | translate }}</mat-label>
            <input matInput [(ngModel)]="form.assessmentType" placeholder="EQi-2.0, Hogan, ..." />
            <mat-hint>{{ 'COACHING.icfAssessmentTypeHint' | translate }}</mat-hint>
          </mat-form-field>
        </div>
      }

      <!-- Mentor coaching fields -->
      @if (form.category === 'mentor_coaching_received') {
        <div class="row two-col">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.icfMentorName' | translate }}</mat-label>
            <input matInput [(ngModel)]="form.mentorCoachName" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.icfMentorCredential' | translate }}</mat-label>
            <mat-select [(ngModel)]="form.mentorCoachIcfCredential">
              <mat-option value="ACC">ACC</mat-option>
              <mat-option value="PCC">PCC</mat-option>
              <mat-option value="MCC">MCC</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ 'COACHING.icfMentorOrganization' | translate }}</mat-label>
          <input matInput [(ngModel)]="form.mentorCoachOrganization" placeholder="e.g. Corry Robertson Academy" />
        </mat-form-field>
      }

      <!-- CCE fields -->
      @if (form.category === 'cce') {
        <div class="row two-col">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.icfCceCategory' | translate }}</mat-label>
            <mat-select [(ngModel)]="form.cceCategory">
              <mat-option value="core_competency">{{ 'COACHING.icfCceCore' | translate }}</mat-option>
              <mat-option value="resource_development">{{ 'COACHING.icfCceResource' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'COACHING.icfCceProvider' | translate }}</mat-label>
            <input matInput [(ngModel)]="form.cceProvider" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ 'COACHING.icfCceCertUrl' | translate }}</mat-label>
          <input matInput [(ngModel)]="form.cceCertificateUrl" />
        </mat-form-field>
      }

      <mat-form-field appearance="outline" class="full notes-field">
        <mat-label>{{ 'COACHING.icfNotes' | translate }}</mat-label>
        <textarea matInput rows="3" [(ngModel)]="form.notes"></textarea>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="close()">{{ 'COMMON.cancel' | translate }}</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="!canSave() || saving()">
        @if (saving()) { <mat-icon>hourglass_empty</mat-icon> }
        {{ 'COMMON.save' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-body { display: flex; flex-direction: column; gap: 4px; min-width: 520px; padding-top: 18px !important; }
    .row { display: flex; gap: 12px; }
    .row.two-col mat-form-field { flex: 1; }

    /* Notes textarea sits below fields whose hints render in the
     * subscript-wrapper. Give it real breathing room so the textarea
     * outline doesn't ride on top of the hint text above. */
    .notes-field { margin-top: 18px; }
    .full { width: 100%; }
    h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; }
  `],
})
export class HoursLogDialogComponent {
  form: HoursLogPayload = {
    date: new Date().toISOString().slice(0, 10),
    hours: 1,
    category: 'session',
    clientType: 'individual',
    paidStatus: 'paid',
  };
  dateValue: Date = new Date();
  saving = signal(false);
  isEdit = computed(() => !!this.data.entry?._id);

  canSave = signal(false);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private dialogRef: MatDialogRef<HoursLogDialogComponent>,
    private api: ApiService,
    private snack: MatSnackBar,
  ) {
    if (data.entry) {
      this.form = { ...data.entry };
      if (data.entry.date) this.dateValue = new Date(data.entry.date);
    }
    this.recomputeCanSave();
  }

  onCategoryChange(): void {
    // Reset category-specific fields to avoid stale values on category swap.
    if (this.form.category !== 'session') {
      this.form.clientType = undefined;
      this.form.paidStatus = undefined;
      this.form.clientName = undefined;
      this.form.clientOrganization = undefined;
      this.form.clientEmail = undefined;
      this.form.sponsorContactName = undefined;
      this.form.assessmentType = undefined;
    } else {
      this.form.clientType ??= 'individual';
      this.form.paidStatus ??= 'paid';
    }
    if (this.form.category !== 'mentor_coaching_received') {
      this.form.mentorCoachName = undefined;
      this.form.mentorCoachIcfCredential = undefined;
      this.form.mentorCoachOrganization = undefined;
    }
    if (this.form.category !== 'cce') {
      this.form.cceCategory = undefined;
      this.form.cceProvider = undefined;
      this.form.cceCertificateUrl = undefined;
    }
    this.recomputeCanSave();
  }

  recomputeCanSave(): void {
    this.canSave.set(this.form.hours > 0 && !!this.form.category && !!this.dateValue);
  }

  save(): void {
    this.recomputeCanSave();
    if (!this.canSave()) return;
    this.saving.set(true);

    const payload: HoursLogPayload = {
      ...this.form,
      date: this.dateValue.toISOString(),
      ...(this.data.coachId ? { coachId: this.data.coachId } : {}),
    };

    const req$ = this.isEdit()
      ? this.api.put(`/coaching/hours/${this.data.entry!._id}`, payload)
      : this.api.post('/coaching/hours', payload);

    req$.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.dialogRef.close(res);
      },
      error: (err) => {
        this.saving.set(false);
        this.snack.open(err.error?.error || 'Failed to save', 'Dismiss', { duration: 4000 });
      },
    });
  }

  close(): void { this.dialogRef.close(); }
}
