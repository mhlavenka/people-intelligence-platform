import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../../../core/api.service';
import { SurveyTemplateDialogComponent } from '../survey-template-dialog/survey-template-dialog.component';

interface SurveyTemplate {
  _id: string;
  title: string;
  moduleType: 'conflict' | 'neuroinclusion' | 'succession';
  questions: { id: string; text: string; type: string; category: string }[];
  isActive: boolean;
  createdAt: string;
  responseCount?: number;
}

@Component({
  selector: 'app-survey-management',
  standalone: true,
  imports: [
    CommonModule,
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
    MatDividerModule,
  ],
  template: `
    <div class="surveys-page">
      <div class="page-header">
        <div>
          <h1>Survey Management</h1>
          <p>Create and manage survey templates across all modules</p>
        </div>
        <button mat-raised-button color="primary" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon> New Template
        </button>
      </div>

      <!-- Module filter tabs -->
      <div class="filter-tabs">
        @for (tab of tabs; track tab.key) {
          <button
            class="filter-tab"
            [class.active]="activeFilter() === tab.key"
            (click)="activeFilter.set(tab.key)"
          >
            <mat-icon>{{ tab.icon }}</mat-icon>
            {{ tab.label }}
            <span class="tab-count">{{ countByModule(tab.key) }}</span>
          </button>
        }
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else if (filteredTemplates().length === 0) {
        <div class="empty-state">
          <mat-icon>assignment</mat-icon>
          <h3>No survey templates yet</h3>
          <p>Create your first template to start collecting responses.</p>
          <button mat-raised-button color="primary" (click)="openCreateDialog()">
            <mat-icon>add</mat-icon> Create Template
          </button>
        </div>
      } @else {
        <div class="templates-grid">
          @for (t of filteredTemplates(); track t._id) {
            <div class="template-card" [class.inactive]="!t.isActive">
              <div class="card-top">
                <div class="module-badge" [class]="t.moduleType">
                  <mat-icon>{{ moduleIcon(t.moduleType) }}</mat-icon>
                  {{ moduleLabel(t.moduleType) }}
                </div>
                <div class="card-actions">
                  <mat-slide-toggle
                    [checked]="t.isActive"
                    (change)="toggleActive(t)"
                    [matTooltip]="t.isActive ? 'Deactivate' : 'Activate'"
                    color="primary"
                  ></mat-slide-toggle>
                  <button mat-icon-button [matMenuTriggerFor]="cardMenu">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #cardMenu="matMenu">
                    <button mat-menu-item (click)="openEditDialog(t)">
                      <mat-icon>edit</mat-icon> Edit
                    </button>
                    <button mat-menu-item (click)="copySurveyLink(t)">
                      <mat-icon>link</mat-icon> Copy Survey Link
                    </button>
                    <button mat-menu-item (click)="viewResponses(t)">
                      <mat-icon>bar_chart</mat-icon> View Responses
                    </button>
                    <mat-divider></mat-divider>
                    <button mat-menu-item class="danger-item" (click)="deleteTemplate(t)">
                      <mat-icon>delete</mat-icon> Delete
                    </button>
                  </mat-menu>
                </div>
              </div>

              <h3>{{ t.title }}</h3>

              <div class="card-meta">
                <span class="meta-item">
                  <mat-icon>quiz</mat-icon>
                  {{ t.questions.length }} questions
                </span>
                <span class="meta-item">
                  <mat-icon>people</mat-icon>
                  {{ t.responseCount ?? 0 }} responses
                </span>
                <span class="meta-item">
                  <mat-icon>calendar_today</mat-icon>
                  {{ t.createdAt | date:'MMM d, y' }}
                </span>
              </div>

              <!-- Question preview -->
              <div class="questions-preview">
                @for (q of t.questions.slice(0, 3); track q.id) {
                  <div class="question-chip">
                    <mat-icon>{{ questionIcon(q.type) }}</mat-icon>
                    {{ q.text | slice:0:60 }}{{ q.text.length > 60 ? '…' : '' }}
                  </div>
                }
                @if (t.questions.length > 3) {
                  <div class="question-chip more">
                    +{{ t.questions.length - 3 }} more questions
                  </div>
                }
              </div>

              <div class="card-footer">
                <button mat-stroked-button (click)="copySurveyLink(t)" [disabled]="!t.isActive">
                  <mat-icon>link</mat-icon> Copy Link
                </button>
                <button mat-stroked-button (click)="openEditDialog(t)">
                  <mat-icon>edit</mat-icon> Edit
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .surveys-page { padding: 32px; max-width: 1200px; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px;
      h1 { font-size: 28px; color: #1B2A47; margin: 0 0 4px; }
      p  { color: #5a6a7e; margin: 0; }
    }

    .filter-tabs {
      display: flex; gap: 8px; margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .filter-tab {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 999px;
      border: 1px solid #dce6f0; background: white;
      font-size: 13px; cursor: pointer; color: #5a6a7e;
      transition: all 0.15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      .tab-count {
        background: #f0f4f8; color: #5a6a7e;
        padding: 1px 7px; border-radius: 999px; font-size: 11px;
      }
      &.active {
        background: #1B2A47; color: white; border-color: #1B2A47;
        .tab-count { background: rgba(255,255,255,0.2); color: white; }
      }
      &:hover:not(.active) { border-color: #3A9FD6; color: #3A9FD6; }
    }

    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .empty-state {
      text-align: center; padding: 64px; background: white;
      border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      mat-icon { font-size: 56px; width: 56px; height: 56px; color: #9aa5b4; margin-bottom: 16px; }
      h3 { font-size: 20px; color: #1B2A47; margin-bottom: 8px; }
      p  { color: #5a6a7e; margin-bottom: 24px; }
    }

    .templates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 20px;
    }

    .template-card {
      background: white; border-radius: 16px; padding: 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      display: flex; flex-direction: column; gap: 12px;
      transition: box-shadow 0.15s;
      &:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.10); }
      &.inactive { opacity: 0.65; }
    }

    .card-top {
      display: flex; align-items: center; justify-content: space-between;
    }

    .module-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &.conflict       { background: rgba(232,108,58,0.12); color: #c04a14; }
      &.neuroinclusion { background: rgba(39,196,160,0.12);  color: #1a9678; }
      &.succession     { background: rgba(58,159,214,0.12);  color: #2080b0; }
    }

    .card-actions { display: flex; align-items: center; gap: 4px; }

    h3 { font-size: 16px; color: #1B2A47; margin: 0; font-weight: 600; line-height: 1.3; }

    .card-meta {
      display: flex; gap: 16px; flex-wrap: wrap;
      .meta-item {
        display: flex; align-items: center; gap: 4px;
        font-size: 12px; color: #9aa5b4;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
    }

    .questions-preview {
      display: flex; flex-direction: column; gap: 6px;
      .question-chip {
        display: flex; align-items: center; gap: 6px;
        background: #f8fafc; border-radius: 6px;
        padding: 6px 10px; font-size: 12px; color: #5a6a7e;
        mat-icon { font-size: 14px; width: 14px; height: 14px; color: #9aa5b4; flex-shrink: 0; }
        &.more { color: #9aa5b4; font-style: italic; }
      }
    }

    .card-footer {
      display: flex; gap: 8px; margin-top: 4px;
      button { flex: 1; font-size: 13px; }
    }

    .danger-item { color: #e53e3e; }
  `],
})
export class SurveyManagementComponent implements OnInit {
  templates = signal<SurveyTemplate[]>([]);
  loading = signal(true);
  activeFilter = signal('all');

  tabs = [
    { key: 'all',            label: 'All',            icon: 'assignment' },
    { key: 'conflict',       label: 'Conflict',       icon: 'warning_amber' },
    { key: 'neuroinclusion', label: 'Neuro-Inclusion', icon: 'psychology' },
    { key: 'succession',     label: 'Succession',     icon: 'trending_up' },
  ];

  filteredTemplates = () =>
    this.activeFilter() === 'all'
      ? this.templates()
      : this.templates().filter((t) => t.moduleType === this.activeFilter());

  countByModule = (key: string) =>
    key === 'all'
      ? this.templates().length
      : this.templates().filter((t) => t.moduleType === key).length;

  moduleIcon = (type: string) =>
    type === 'conflict' ? 'warning_amber' : type === 'neuroinclusion' ? 'psychology' : 'trending_up';

  moduleLabel = (type: string) =>
    type === 'conflict' ? 'Conflict' : type === 'neuroinclusion' ? 'Neuro-Inclusion' : 'Succession';

  questionIcon = (type: string) =>
    type === 'scale' ? 'linear_scale' : type === 'boolean' ? 'toggle_on' : 'short_text';

  constructor(
    private api: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading.set(true);
    this.api.get<SurveyTemplate[]>('/surveys/templates').subscribe({
      next: (templates) => {
        // Load response counts for each template
        this.templates.set(templates);
        this.loading.set(false);
        templates.forEach((t) => this.loadResponseCount(t._id));
      },
      error: () => this.loading.set(false),
    });
  }

  loadResponseCount(templateId: string): void {
    this.api.get<{ count: number }>(`/surveys/responses/${templateId}/count`).subscribe({
      next: (data) => {
        this.templates.update((list) =>
          list.map((t) => (t._id === templateId ? { ...t, responseCount: data.count } : t))
        );
      },
      error: () => {}, // count endpoint may return 403 if < 5 — that's fine
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(SurveyTemplateDialogComponent, {
      width: '720px',
      maxHeight: '90vh',
      disableClose: true,
    });
    ref.afterClosed().subscribe((result) => { if (result) this.loadTemplates(); });
  }

  openEditDialog(template: SurveyTemplate): void {
    const ref = this.dialog.open(SurveyTemplateDialogComponent, {
      width: '720px',
      maxHeight: '90vh',
      disableClose: true,
      data: template,
    });
    ref.afterClosed().subscribe((result) => { if (result) this.loadTemplates(); });
  }

  toggleActive(template: SurveyTemplate): void {
    this.api.put(`/surveys/templates/${template._id}`, { isActive: !template.isActive }).subscribe({
      next: () => {
        this.templates.update((list) =>
          list.map((t) => (t._id === template._id ? { ...t, isActive: !t.isActive } : t))
        );
        this.snackBar.open(
          `Template ${!template.isActive ? 'activated' : 'deactivated'}`,
          'Close',
          { duration: 2500 }
        );
      },
    });
  }

  copySurveyLink(template: SurveyTemplate): void {
    const url = `${window.location.origin}/survey/${template._id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snackBar.open('Survey link copied!', 'Close', { duration: 2500 });
    });
  }

  viewResponses(template: SurveyTemplate): void {
    this.snackBar.open('Response detail view coming soon', 'Close', { duration: 2500 });
  }

  deleteTemplate(template: SurveyTemplate): void {
    if (!confirm(`Delete "${template.title}"? This cannot be undone.`)) return;
    this.api.delete(`/surveys/templates/${template._id}`).subscribe({
      next: () => {
        this.templates.update((list) => list.filter((t) => t._id !== template._id));
        this.snackBar.open('Template deleted', 'Close', { duration: 2500 });
      },
      error: () => this.snackBar.open('Delete failed', 'Close', { duration: 2500 }),
    });
  }
}
