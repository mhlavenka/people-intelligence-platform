import { Component, OnInit, signal, inject } from '@angular/core';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { parseConflictType } from '../conflict-type.util';
import { DialogCloseButtonComponent } from '../../../shared/dialog-close-button/dialog-close-button.component';

interface ConflictAnalysis {
  _id: string;
  departmentId: string;
  name: string;
  riskScore: number;
  riskLevel: string;
  conflictTypes: string[];
}

interface Coachee {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
}

@Component({
  selector: 'app-conflict-idp-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    DialogCloseButtonComponent,
  ],
  template: `
    <app-dialog-close-btn (closed)="dialogRef.close()" />
    <h2 mat-dialog-title>
      <mat-icon>psychology</mat-icon>
      {{ "CONFLICT.generateConflictSkillPlan" | translate }}
    </h2>

    <mat-dialog-content>
      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <p class="dialog-desc">
        {{ "CONFLICT.idpDialogDesc" | translate }}
      </p>

      <!-- Analysis selection -->
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ "CONFLICT.basedOnAnalysis" | translate }}</mat-label>
        <mat-select [(ngModel)]="selectedAnalysisId">
          @for (a of analyses; track a._id) {
            <mat-option [value]="a._id">
              {{ a.departmentId || ("CONFLICT.allDepartments" | translate) }} — {{ a.name }}
              (Risk: {{ a.riskScore }}/100 {{ a.riskLevel }})
            </mat-option>
          }
        </mat-select>
        <mat-hint>{{ "CONFLICT.selectAnalysisHint" | translate }}</mat-hint>
      </mat-form-field>

      <!-- User selection -->
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ "CONFLICT.createPlanFor" | translate }}</mat-label>
        <mat-select [(ngModel)]="selectedCoacheeId">
          @for (u of users(); track u._id) {
            <mat-option [value]="u._id">
              {{ u.firstName }} {{ u.lastName }}
              @if (u.department) { ({{ u.department }}) }
            </mat-option>
          }
        </mat-select>
        <mat-hint>{{ "CONFLICT.teamMemberHint" | translate }}</mat-hint>
      </mat-form-field>

      <!-- Goals -->
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ "CONFLICT.developmentGoals" | translate }}</mat-label>
        <textarea matInput [(ngModel)]="goals" rows="3"
                  placeholder="e.g. Improve conflict resolution skills, develop active listening, learn interest-based negotiation techniques"></textarea>
        <mat-hint>{{ "CONFLICT.developmentGoalsHint" | translate }}</mat-hint>
      </mat-form-field>

      @if (selectedAnalysisId) {
        <div class="analysis-preview">
          <mat-icon>info</mat-icon>
          <div>
            <strong>{{ "CONFLICT.conflictTypesDetected" | translate }}</strong>
            {{ selectedConflictTypeLabels() || 'None' }}
          </div>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="generating()">{{ "COMMON.cancel" | translate }}</button>
      <button mat-raised-button color="primary"
              (click)="generate()"
              [disabled]="generating() || !selectedAnalysisId || !selectedCoacheeId || !goals.trim()">
        @if (generating()) {
          <mat-spinner diameter="18" />
          {{ "CONFLICT.generatingEllipsis" | translate }}
        } @else {
          <mat-icon>auto_awesome</mat-icon>
          {{ "CONFLICT.generateIDP" | translate }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex; align-items: center; gap: 8px; color: var(--artes-primary);
      mat-icon { color: #7c5cbf; }
    }
    mat-dialog-content { min-width: 480px; padding-top: 8px !important; }
    .full-width { width: 100%; }
    .dialog-desc { font-size: 13px; color: #5a6a7e; margin: 0 0 16px; line-height: 1.5; }
    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 14px;
    }
    .analysis-preview {
      display: flex; align-items: flex-start; gap: 8px;
      background: #f5f0ff; border-radius: 8px; padding: 10px 14px;
      font-size: 13px; color: #5a3ea0; margin-top: 4px;
      mat-icon { font-size: 18px; color: #7c5cbf; margin-top: 1px; flex-shrink: 0; }
      strong { display: block; margin-bottom: 2px; }
    }
  `],
})
export class ConflictIdpDialogComponent implements OnInit {
  private api = inject(ApiService);
  dialogRef = inject(MatDialogRef<ConflictIdpDialogComponent>);
  private data = inject<{ analyses: ConflictAnalysis[] }>(MAT_DIALOG_DATA);
  private translate = inject(TranslateService);

  analyses: ConflictAnalysis[] = this.data.analyses;
  users = signal<Coachee[]>([]);
  generating = signal(false);
  error = signal('');

  selectedAnalysisId = '';
  selectedCoacheeId = '';
  goals = '';

  ngOnInit(): void {
    this.api.get<Coachee[]>('/users').subscribe({
      next: (users) => this.users.set(users),
    });
  }

  getSelectedAnalysis(): ConflictAnalysis | undefined {
    return this.analyses.find((a) => a._id === this.selectedAnalysisId);
  }

  selectedConflictTypeLabels(): string {
    const types = this.getSelectedAnalysis()?.conflictTypes ?? [];
    return types.map((t) => parseConflictType(t).label).join(', ');
  }

  generate(): void {
    this.generating.set(true);
    this.error.set('');

    this.api.post('/succession/idp/generate-from-conflict', {
      coacheeId: this.selectedCoacheeId,
      analysisId: this.selectedAnalysisId,
      goals: this.goals.trim(),
    }).subscribe({
      next: (result) => {
        this.generating.set(false);
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.generating.set(false);
        this.error.set(err.error?.error || this.translate.instant('CONFLICT.generateIDPFailed'));
      },
    });
  }
}
