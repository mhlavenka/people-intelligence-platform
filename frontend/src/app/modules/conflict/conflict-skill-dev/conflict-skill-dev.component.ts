import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { ApiService } from '../../../core/api.service';
import { ConflictIdpDialogComponent } from '../conflict-idp-dialog/conflict-idp-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface ConflictMilestone {
  _id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

interface ConflictIDP {
  _id: string;
  coacheeId: { _id: string; firstName: string; lastName: string } | string;
  goal: string;
  currentReality: string;
  options: string[];
  willDoActions: string[];
  competencyGaps: string[];
  milestones: ConflictMilestone[];
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
}

interface ConflictAnalysis {
  _id: string;
  departmentId: string;
  name: string;
  riskScore: number;
  riskLevel: string;
  conflictTypes: string[];
}

@Component({
  selector: 'app-conflict-skill-dev',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatDialogModule, MatSnackBarModule, MatTooltipModule, MatExpansionModule, DatePipe,
    TranslateModule,
  ],
  template: `
    <div class="section-header">
      <div class="section-icon purple"><mat-icon>psychology</mat-icon></div>
      <div>
        <h3>{{ "CONFLICT.skillDevPlans" | translate }}</h3>
        <p>Generate AI-powered Individual Development Plans (IDPs) based on conflict analysis findings — targeted skill building using the GROW model.</p>
      </div>
      <button mat-raised-button color="primary" class="section-action-btn" (click)="openDialog()">
        <mat-icon>add_circle</mat-icon> {{ "CONFLICT.generateConflictIDP" | translate }}
      </button>
    </div>

    @if (loading()) {
      <div class="loading-center"><mat-spinner diameter="28" /></div>
    } @else if (idps().length === 0) {
      <div class="empty-state">
        <mat-icon>psychology</mat-icon>
        <p>No conflict-based development plans yet. Run an analysis first, then generate a targeted IDP for team members.</p>
      </div>
    } @else {
      <div class="idp-grid">
        @for (idp of idps(); track idp._id) {
          <div class="idp-card" [class]="'status-' + idp.status">
            <div class="idp-card-header">
              <div class="idp-status-badge" [class]="idp.status">{{ idp.status }}</div>
              @if (isPopulated(idp.coacheeId)) {
                <span class="idp-coachee-name">
                  <mat-icon class="coachee-icon">person</mat-icon>
                  {{ idp.coacheeId.firstName }} {{ idp.coacheeId.lastName }}
                </span>
              }
              <span class="idp-date-label">{{ idp.createdAt | date:'MMM d, y' }}</span>
              <button class="card-action-btn delete-btn" matTooltip="Delete IDP" (click)="deleteIdp(idp)">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>

            <mat-accordion class="grow-accordion">
              <mat-expansion-panel class="grow-panel goal-panel">
                <mat-expansion-panel-header><mat-panel-title><mat-icon>flag</mat-icon> Goal</mat-panel-title></mat-expansion-panel-header>
                <p>{{ idp.goal }}</p>
              </mat-expansion-panel>
              <mat-expansion-panel class="grow-panel reality-panel">
                <mat-expansion-panel-header><mat-panel-title><mat-icon>explore</mat-icon> Reality</mat-panel-title></mat-expansion-panel-header>
                <p>{{ idp.currentReality }}</p>
              </mat-expansion-panel>
              <mat-expansion-panel class="grow-panel options-panel">
                <mat-expansion-panel-header><mat-panel-title><mat-icon>lightbulb</mat-icon> Options ({{ idp.options.length }})</mat-panel-title></mat-expansion-panel-header>
                <ul>@for (opt of idp.options; track opt) { <li>{{ opt }}</li> }</ul>
              </mat-expansion-panel>
              <mat-expansion-panel class="grow-panel will-panel">
                <mat-expansion-panel-header><mat-panel-title><mat-icon>bolt</mat-icon> Will Do ({{ idp.willDoActions.length }})</mat-panel-title></mat-expansion-panel-header>
                <ul>@for (a of idp.willDoActions; track a) { <li>{{ a }}</li> }</ul>
              </mat-expansion-panel>
            </mat-accordion>

            <div class="milestone-section">
              <h4>{{ "CONFLICT.milestones" | translate }}</h4>
              <div class="milestone-timeline">
                @for (ms of idp.milestones; track ms._id) {
                  <div class="milestone-item" [class]="ms.status">
                    <div class="ms-dot"></div>
                    <div class="ms-content">
                      <span class="ms-title">{{ ms.title }}</span>
                      <span class="ms-date">{{ ms.dueDate | date:'MMM d' }}</span>
                    </div>
                    <div class="ms-actions">
                      @if (ms.status !== 'completed') {
                        <button mat-icon-button [matTooltip]="'Mark complete'" (click)="completeMilestone(idp._id, ms._id)">
                          <mat-icon>check_circle_outline</mat-icon>
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            @if (idp.competencyGaps.length) {
              <mat-expansion-panel class="grow-panel conflict-areas-panel">
                <mat-expansion-panel-header><mat-panel-title><mat-icon>warning_amber</mat-icon> Conflict Areas ({{ idp.competencyGaps.length }})</mat-panel-title></mat-expansion-panel-header>
                <ul>@for (gap of idp.competencyGaps; track gap) { <li>{{ gap }}</li> }</ul>
              </mat-expansion-panel>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .section-action-btn { margin-left: auto; flex-shrink: 0; }
    /* All IDP card, GROW panel, milestone styles come from global styles.scss */
  `],
})
export class ConflictSkillDevComponent implements OnInit {
  idps = signal<ConflictIDP[]>([]);
  analyses = signal<ConflictAnalysis[]>([]);
  loading = signal(true);

  constructor(private api: ApiService, private dialog: MatDialog, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.api.get<ConflictIDP[]>('/succession/idps?module=conflict').subscribe({
      next: (data) => { this.idps.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.api.get<ConflictAnalysis[]>('/conflict/analyses').subscribe({
      next: (data) => this.analyses.set(data.filter((a: any) => !a.parentId)),
    });
  }

  isPopulated(c: ConflictIDP['coacheeId']): c is { _id: string; firstName: string; lastName: string } {
    return typeof c === 'object' && c !== null;
  }

  coacheeName(idp: ConflictIDP): string {
    return this.isPopulated(idp.coacheeId) ? `${idp.coacheeId.firstName} ${idp.coacheeId.lastName}` : 'Unknown';
  }

  completeMilestone(idpId: string, milestoneId: string): void {
    this.api.put(`/succession/idps/${idpId}/milestone`, { milestoneId, status: 'completed' }).subscribe({
      next: () => this.ngOnInit(),
    });
  }

  deleteIdp(idp: ConflictIDP): void {
    if (!confirm(`Delete development plan for ${this.coacheeName(idp)}?`)) return;
    this.api.delete(`/succession/idps/${idp._id}`).subscribe({
      next: () => { this.idps.update((l) => l.filter((i) => i._id !== idp._id)); this.snackBar.open('Plan deleted', 'OK', { duration: 3000 }); },
    });
  }

  openDialog(): void {
    const ref = this.dialog.open(ConflictIdpDialogComponent, {
      width: '560px', disableClose: true, data: { analyses: this.analyses() },
    });
    ref.afterClosed().subscribe((r) => { if (r) this.ngOnInit(); });
  }
}
