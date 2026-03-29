import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../../core/api.service';
import { IdpGenerateDialogComponent } from '../idp-generate-dialog/idp-generate-dialog.component';

interface Milestone {
  _id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

interface IDP {
  _id: string;
  goal: string;
  currentReality: string;
  options: string[];
  willDoActions: string[];
  milestones: Milestone[];
  competencyGaps: string[];
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
}

@Component({
  selector: 'app-idp-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  template: `
    <div class="idp-page">
      <div class="page-header">
        <div>
          <h1>Leadership & Succession Hub™</h1>
          <p>Individual Development Plans powered by GROW methodology</p>
        </div>
        <button mat-raised-button color="primary" (click)="generateNew()">
          <mat-icon>auto_awesome</mat-icon> Generate IDP
        </button>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner /></div>
      } @else if (idps().length === 0) {
        <div class="empty-state">
          <mat-icon>psychology_alt</mat-icon>
          <h3>No Development Plans Yet</h3>
          <p>Generate your first AI-powered IDP using the GROW model.</p>
          <button mat-raised-button color="primary" (click)="generateNew()">
            <mat-icon>auto_awesome</mat-icon> Generate First IDP
          </button>
        </div>
      } @else {
        <div class="idp-grid">
          @for (idp of idps(); track idp._id) {
            <div class="idp-card" [class]="'status-' + idp.status">
              <div class="idp-card-header">
                <div class="idp-status-badge" [class]="idp.status">{{ idp.status }}</div>
                <span class="idp-date">{{ idp.createdAt | date:'MMM d, y' }}</span>
              </div>

              <!-- GROW sections -->
              <mat-accordion class="grow-accordion">
                <mat-expansion-panel class="grow-panel goal-panel">
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon>flag</mat-icon> Goal
                    </mat-panel-title>
                  </mat-expansion-panel-header>
                  <p>{{ idp.goal }}</p>
                </mat-expansion-panel>

                <mat-expansion-panel class="grow-panel reality-panel">
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon>explore</mat-icon> Reality
                    </mat-panel-title>
                  </mat-expansion-panel-header>
                  <p>{{ idp.currentReality }}</p>
                </mat-expansion-panel>

                <mat-expansion-panel class="grow-panel options-panel">
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon>lightbulb</mat-icon> Options ({{ idp.options.length }})
                    </mat-panel-title>
                  </mat-expansion-panel-header>
                  <ul>
                    @for (opt of idp.options; track opt) {
                      <li>{{ opt }}</li>
                    }
                  </ul>
                </mat-expansion-panel>

                <mat-expansion-panel class="grow-panel will-panel">
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon>bolt</mat-icon> Will Do ({{ idp.willDoActions.length }})
                    </mat-panel-title>
                  </mat-expansion-panel-header>
                  <ul>
                    @for (action of idp.willDoActions; track action) {
                      <li>{{ action }}</li>
                    }
                  </ul>
                </mat-expansion-panel>
              </mat-accordion>

              <!-- Milestone timeline -->
              <div class="milestone-section">
                <h4>Milestones</h4>
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
                          <button mat-icon-button [matTooltip]="'Mark complete'" (click)="updateMilestone(idp._id, ms._id, 'completed')">
                            <mat-icon>check_circle_outline</mat-icon>
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Competency gaps -->
              @if (idp.competencyGaps.length) {
                <div class="gaps-section">
                  <h4>Competency Gaps</h4>
                  <mat-chip-set>
                    @for (gap of idp.competencyGaps; track gap) {
                      <mat-chip>{{ gap }}</mat-chip>
                    }
                  </mat-chip-set>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .idp-page { padding: 32px; max-width: 1200px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; h1 { font-size: 28px; color: #1B2A47; margin: 0 0 4px; } p { color: #5a6a7e; margin: 0; } }

    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .empty-state {
      text-align: center; padding: 64px; background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      mat-icon { font-size: 64px; width: 64px; height: 64px; color: #3A9FD6; margin-bottom: 16px; }
      h3 { font-size: 20px; color: #1B2A47; margin-bottom: 8px; }
      p  { color: #5a6a7e; margin-bottom: 24px; }
    }

    .idp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(480px, 1fr)); gap: 24px; }

    .idp-card {
      background: white; border-radius: 16px; padding: 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      &.status-active   { border-top: 3px solid #3A9FD6; }
      &.status-draft    { border-top: 3px solid #9aa5b4; }
      &.status-completed{ border-top: 3px solid #27C4A0; }
    }

    .idp-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .idp-status-badge {
      padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase;
      &.active    { background: rgba(58,159,214,0.15); color: #2080b0; }
      &.draft     { background: rgba(154,165,180,0.15); color: #5a6a7e; }
      &.completed { background: rgba(39,196,160,0.15);  color: #1a9678; }
    }
    .idp-date { font-size: 12px; color: #9aa5b4; }

    .grow-accordion { margin-bottom: 20px; }
    .grow-panel {
      &.goal-panel    ::ng-deep .mat-expansion-panel-header-title mat-icon { color: #3A9FD6; }
      &.reality-panel ::ng-deep .mat-expansion-panel-header-title mat-icon { color: #27C4A0; }
      &.options-panel ::ng-deep .mat-expansion-panel-header-title mat-icon { color: #f0a500; }
      &.will-panel    ::ng-deep .mat-expansion-panel-header-title mat-icon { color: #e86c3a; }
    }
    ::ng-deep .mat-expansion-panel-header-title { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    ul { margin: 0; padding-left: 20px; li { margin-bottom: 6px; font-size: 14px; color: #5a6a7e; } }

    .milestone-section { margin-bottom: 16px; h4 { font-size: 14px; color: #1B2A47; margin-bottom: 12px; } }
    .milestone-timeline { display: flex; flex-direction: column; gap: 8px; }
    .milestone-item {
      display: flex; align-items: center; gap: 10px;
      .ms-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; background: #dce6f0; }
      .ms-content { flex: 1; .ms-title { display: block; font-size: 13px; color: #1B2A47; } .ms-date { font-size: 11px; color: #9aa5b4; } }
      &.completed .ms-dot { background: #27C4A0; }
      &.in_progress .ms-dot { background: #3A9FD6; }
      &.pending .ms-dot { background: #dce6f0; border: 2px solid #9aa5b4; }
    }

    .gaps-section { h4 { font-size: 14px; color: #1B2A47; margin-bottom: 8px; } }
  `],
})
export class IDPViewComponent implements OnInit {
  idps = signal<IDP[]>([]);
  loading = signal(true);

  constructor(private api: ApiService, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.loadIDPs();
  }

  loadIDPs(): void {
    this.api.get<IDP[]>('/succession/idps').subscribe({
      next: (data) => { this.idps.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  updateMilestone(idpId: string, milestoneId: string, status: string): void {
    this.api.put(`/succession/idps/${idpId}/milestone`, { milestoneId, status }).subscribe({
      next: () => this.loadIDPs(),
    });
  }

  generateNew(): void {
    const ref = this.dialog.open(IdpGenerateDialogComponent, {
      width: '640px',
      disableClose: true,
    });

    ref.afterClosed().subscribe((result) => {
      if (result) this.loadIDPs();
    });
  }
}
