import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { SurveyTemplateDialogComponent } from '../../survey/survey-template-dialog/survey-template-dialog.component';

interface GlobalTemplate {
  _id: string;
  title: string;
  moduleType: string;
  intakeType: string;
  instrumentId?: string;
  instrumentVersion?: string;
  isActive: boolean;
  isGlobal: true;
  questions: Array<{ id: string; text: string; type: string }>;
  analysisPrompt?: string;
  responseCount?: number;
  createdAt?: string;
}

@Component({
  selector: 'app-assessment-hub',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatDialogModule,
    MatSnackBarModule, MatMenuModule, MatTooltipModule, MatChipsModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatDividerModule,
    TranslateModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>
            <mat-icon>quiz</mat-icon>
            {{ 'SYSADMIN.assessmentHubTitle' | translate }}
          </h1>
          <p>{{ 'SYSADMIN.assessmentHubDesc' | translate }}</p>
        </div>
        <button mat-raised-button color="primary" (click)="openCreate()">
          <mat-icon>add</mat-icon>
          {{ 'SYSADMIN.newGlobalInstrument' | translate }}
        </button>
      </div>

      <div class="filters">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>{{ 'COMMON.search' | translate }}</mat-label>
          <input matInput [(ngModel)]="search" (ngModelChange)="applyFilters()" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'SURVEY.module' | translate }}</mat-label>
          <mat-select [(ngModel)]="moduleFilter" (ngModelChange)="applyFilters()">
            <mat-option [value]="''">{{ 'COMMON.all' | translate }}</mat-option>
            <mat-option value="conflict">Conflict</mat-option>
            <mat-option value="neuroinclusion">Neuro-Inclusion</mat-option>
            <mat-option value="succession">Succession</mat-option>
            <mat-option value="coaching">Coaching</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'SURVEY.status' | translate }}</mat-label>
          <mat-select [(ngModel)]="statusFilter" (ngModelChange)="applyFilters()">
            <mat-option [value]="''">{{ 'COMMON.all' | translate }}</mat-option>
            <mat-option value="active">{{ 'SURVEY.active' | translate }}</mat-option>
            <mat-option value="inactive">{{ 'SURVEY.inactive' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="32"/></div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <mat-icon>quiz</mat-icon>
          <p>{{ 'SYSADMIN.noGlobalInstruments' | translate }}</p>
          <button mat-raised-button color="primary" (click)="openCreate()">
            <mat-icon>add</mat-icon>
            {{ 'SYSADMIN.newGlobalInstrument' | translate }}
          </button>
        </div>
      } @else {
        <div class="grid">
          @for (t of filtered(); track t._id) {
            <div class="card" [class.inactive]="!t.isActive">
              <div class="card-header">
                <div class="badges">
                  <span class="module-chip" [class]="t.moduleType">
                    {{ moduleLabel(t.moduleType) }}
                  </span>
                  <span class="intake-chip">{{ t.intakeType }}</span>
                  @if (!t.isActive) {
                    <span class="status-chip inactive">{{ 'SURVEY.inactive' | translate }}</span>
                  }
                  @if (t.analysisPrompt) {
                    <span class="ai-chip" [matTooltip]="'SURVEY.hasCustomAIPrompt' | translate">
                      <mat-icon>auto_awesome</mat-icon>
                      {{ 'SURVEY.aiPrompt' | translate }}
                    </span>
                  }
                </div>
                <button mat-icon-button [matMenuTriggerFor]="cardMenu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #cardMenu="matMenu">
                  <button mat-menu-item (click)="openEdit(t)">
                    <mat-icon>edit</mat-icon> {{ 'COMMON.edit' | translate }}
                  </button>
                  <button mat-menu-item (click)="toggleActive(t)">
                    <mat-icon>{{ t.isActive ? 'visibility_off' : 'visibility' }}</mat-icon>
                    {{ (t.isActive ? 'SURVEY.deactivate' : 'SURVEY.activate') | translate }}
                  </button>
                  <mat-divider/>
                  <button mat-menu-item class="danger" (click)="deleteTemplate(t)">
                    <mat-icon>delete</mat-icon> {{ 'COMMON.delete' | translate }}
                  </button>
                </mat-menu>
              </div>

              <h3 class="title">{{ t.title }}</h3>
              <div class="meta">
                @if (t.instrumentId) {
                  <span><code>{{ t.instrumentId }}</code>
                    @if (t.instrumentVersion) { <span class="version"> · v{{ t.instrumentVersion }}</span> }
                  </span>
                }
                <span>{{ t.questions.length }} {{ 'SURVEY.questions' | translate }}</span>
                @if (t.createdAt) { <span>{{ t.createdAt | date:'mediumDate' }}</span> }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 32px; max-width: 1400px; }
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 24px;
      h1 { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; font-size: 28px; color: var(--artes-primary);
        mat-icon { color: var(--artes-accent); } }
      p { color: #5a6a7e; margin: 0; font-size: 14px; }
    }
    .filters {
      display: flex; gap: 12px; margin-bottom: 20px; align-items: center;
      .search-field { flex: 1; }
    }
    .loading-center { display: flex; justify-content: center; padding: 64px; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 64px 20px; background: white; border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #c0ccdb; }
      p { color: #5a6a7e; margin: 0; }
    }

    .grid {
      display: grid; gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    }
    .card {
      background: white; border: 1px solid #eef2f7; border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      transition: box-shadow 0.15s;
      &:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
      &.inactive { opacity: 0.6; }
    }
    .card-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 8px;
    }
    .badges {
      display: flex; flex-wrap: wrap; gap: 4px;
    }
    .module-chip {
      display: inline-block; padding: 2px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
      background: #eef2f7; color: #5a6a7e;
      &.conflict       { background: rgba(229,62,62,0.10); color: #c53030; }
      &.neuroinclusion { background: rgba(124,58,237,0.10); color: #6b3aa0; }
      &.succession     { background: rgba(39,196,160,0.10); color: #1a9678; }
      &.coaching       { background: rgba(58,159,214,0.10); color: #2080b0; }
    }
    .intake-chip {
      display: inline-block; padding: 2px 10px; border-radius: 999px;
      font-size: 11px; color: #5a6a7e; background: #f8fafc; border: 1px solid #eef2f7;
    }
    .status-chip.inactive {
      display: inline-block; padding: 2px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 600; background: rgba(229,62,62,0.10); color: #c53030;
    }
    .ai-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.4px;
      background: linear-gradient(135deg, rgba(124,58,237,0.10), rgba(58,159,214,0.10));
      color: #6b3aa0; border: 1px solid rgba(124,58,237,0.22);
      mat-icon { font-size: 13px; width: 13px; height: 13px; color: #7c3aed; }
    }

    .title {
      font-size: 16px; color: var(--artes-primary);
      margin: 12px 0 6px;
    }
    .meta {
      display: flex; flex-wrap: wrap; gap: 12px;
      font-size: 12px; color: #8fa4c0;
      code { background: #eef2f7; padding: 1px 5px; border-radius: 3px; font-size: 11px; color: #5a6a7e; }
      .version { color: #9aa5b4; }
    }
    .danger mat-icon { color: #c53030; }
  `],
})
export class AssessmentHubComponent implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  templates = signal<GlobalTemplate[]>([]);
  loading = signal(true);

  search = '';
  moduleFilter = '';
  statusFilter = '';

  filtered = computed(() => {
    const q = this.search.toLowerCase().trim();
    return this.templates().filter((t) => {
      const matchSearch = !q ||
        t.title.toLowerCase().includes(q) ||
        (t.instrumentId ?? '').toLowerCase().includes(q);
      const matchModule = !this.moduleFilter || t.moduleType === this.moduleFilter;
      const matchStatus = !this.statusFilter ||
        (this.statusFilter === 'active' && t.isActive) ||
        (this.statusFilter === 'inactive' && !t.isActive);
      return matchSearch && matchModule && matchStatus;
    });
  });

  ngOnInit() {
    this.loadTemplates();
  }

  applyFilters() { /* signal recomputes via the computed() above */ }

  loadTemplates() {
    this.loading.set(true);
    this.api.get<GlobalTemplate[]>('/surveys/templates?onlyGlobal=true&includeInactive=true')
      .subscribe({
        next: (list) => { this.templates.set(list); this.loading.set(false); },
        error: () => {
          this.loading.set(false);
          this.snack.open(this.translate.instant('SYSADMIN.assessmentHubLoadFailed'),
            this.translate.instant('COMMON.close'), { duration: 3000 });
        },
      });
  }

  openCreate() {
    const ref = this.dialog.open(SurveyTemplateDialogComponent, {
      minWidth: '960px', maxWidth: '1100px', maxHeight: '92vh', disableClose: true,
      data: { isGlobal: true },
    });
    ref.afterClosed().subscribe((result) => { if (result) this.loadTemplates(); });
  }

  openEdit(t: GlobalTemplate) {
    const ref = this.dialog.open(SurveyTemplateDialogComponent, {
      minWidth: '960px', maxWidth: '1100px', maxHeight: '92vh', disableClose: true,
      data: t,
    });
    ref.afterClosed().subscribe((result) => { if (result) this.loadTemplates(); });
  }

  toggleActive(t: GlobalTemplate) {
    this.api.put<GlobalTemplate>(`/surveys/templates/${t._id}`, { isActive: !t.isActive })
      .subscribe({
        next: () => {
          this.snack.open(
            this.translate.instant(t.isActive ? 'SURVEY.templateDeactivated' : 'SURVEY.templateActivated'),
            this.translate.instant('COMMON.close'), { duration: 2000 });
          this.loadTemplates();
        },
        error: () => this.snack.open(this.translate.instant('SURVEY.saveFailed'),
          this.translate.instant('COMMON.close'), { duration: 3000 }),
      });
  }

  deleteTemplate(t: GlobalTemplate) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      data: {
        title: this.translate.instant('SYSADMIN.deleteGlobalInstrument'),
        message: this.translate.instant('SYSADMIN.deleteGlobalInstrumentConfirm', { title: t.title }),
        confirmLabel: this.translate.instant('COMMON.delete'),
        confirmColor: 'warn',
        icon: 'delete',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.api.delete(`/surveys/templates/${t._id}`).subscribe({
        next: () => {
          this.snack.open(this.translate.instant('SURVEY.templateDeleted'),
            this.translate.instant('COMMON.close'), { duration: 2000 });
          this.loadTemplates();
        },
        error: () => this.snack.open(this.translate.instant('SURVEY.deleteFailed'),
          this.translate.instant('COMMON.close'), { duration: 3000 }),
      });
    });
  }

  moduleLabel(m: string): string {
    const map: Record<string, string> = {
      conflict: 'Conflict', neuroinclusion: 'Neuro-Inclusion',
      succession: 'Succession', coaching: 'Coaching',
    };
    return map[m] ?? m;
  }
}
