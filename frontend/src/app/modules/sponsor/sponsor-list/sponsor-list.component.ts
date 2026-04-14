import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Sponsor, SponsorService } from '../sponsor.service';
import { SponsorDialogComponent } from '../sponsor-dialog/sponsor-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-sponsor-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatMenuModule, MatTooltipModule, MatDialogModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Sponsors</h1>
          <p>Manage who gets billed for coaching engagements.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="36" /></div>
      } @else if (sponsors().length === 0) {
        <div class="empty">
          <mat-icon>account_balance</mat-icon>
          <h3>No sponsors yet</h3>
          <p>Create your first sponsor to start tracking coaching billing.</p>
          <button mat-flat-button color="primary" (click)="newSponsor()">
            <mat-icon>add</mat-icon> New sponsor
          </button>
        </div>
      } @else {
        <div class="grid">
          @for (s of sponsors(); track s._id) {
            <div class="card" [class.inactive]="!s.isActive">
              <div class="card-top">
                <div class="ident">
                  <div class="avatar">
                    {{ initials(s) }}
                  </div>
                  <div class="ident-body">
                    <strong>{{ s.name }}</strong>
                    <span class="email">{{ s.email }}</span>
                    @if (s.organization) { <span class="org">{{ s.organization }}</span> }
                  </div>
                </div>
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <a mat-menu-item [routerLink]="['/billing/sponsors', s._id]">
                    <mat-icon>receipt_long</mat-icon> View billing
                  </a>
                  <button mat-menu-item (click)="edit(s)">
                    <mat-icon>edit</mat-icon> Edit
                  </button>
                  <button mat-menu-item class="delete-item" (click)="confirmDelete(s)">
                    <mat-icon>delete</mat-icon> Delete
                  </button>
                </mat-menu>
              </div>

              <div class="badges">
                @if (s.coacheeId) {
                  <span class="badge self-pay">Self-pay</span>
                }
                <span class="badge eng-count" [class.zero]="!s.activeEngagements">
                  {{ s.activeEngagements || 0 }} active · {{ s.totalEngagements || 0 }} total
                </span>
                @if (s.defaultHourlyRate) {
                  <span class="badge rate">{{ s.defaultHourlyRate | currency }}/hr</span>
                }
              </div>

              <div class="card-footer">
                <a mat-stroked-button color="primary"
                   class="billing-btn"
                   [routerLink]="['/billing/sponsors', s._id]">
                  <mat-icon>receipt_long</mat-icon> View billing
                </a>
              </div>
            </div>
          }
          <button type="button" class="card new-card" (click)="newSponsor()">
            <mat-icon>add</mat-icon>
            <span>New sponsor</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 24px;
      h1 { margin: 0 0 4px; font-size: 24px; color: #1B2A47; }
      p  { margin: 0; color: #6b7c93; }
    }
    .loading { display: flex; justify-content: center; padding: 60px 0; }
    .empty {
      text-align: center; padding: 60px 24px; color: #6b7c93;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #c8d3df; }
      h3 { margin: 12px 0 4px; color: #1B2A47; }
    }
    .grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .card {
      background: #fff; border: 1px solid #eef2f7; border-radius: 12px;
      padding: 16px;
      &.inactive { opacity: 0.55; }
    }
    .card.new-card {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; min-height: 180px; cursor: pointer;
      border: 2px dashed #c3cfdd; background: #fafbfd; color: #5a6a7e;
      font: inherit; font-size: 14px; font-weight: 500;
      transition: all 0.15s;
      mat-icon {
        font-size: 36px; width: 36px; height: 36px;
        color: #3A9FD6;
      }
      &:hover {
        border-color: #3A9FD6; background: #EBF5FB; color: #1B2A47;
        box-shadow: 0 4px 16px rgba(58,159,214,0.12);
      }
    }
    .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .ident { display: flex; gap: 12px; min-width: 0; }
    .avatar {
      width: 44px; height: 44px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #3A9FD6, #27C4A0);
      color: #fff; font-weight: 600; font-size: 15px;
      flex-shrink: 0;
    }
    .ident-body {
      display: flex; flex-direction: column; gap: 2px; min-width: 0;
      strong { font-size: 14px; color: #1B2A47; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .email { font-size: 12px; color: #6b7c93; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .org   { font-size: 12px; color: #9aa5b4; }
    }
    .badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .badge {
      font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
      &.self-pay  { background: #f3eafc; color: #6b3aa0; }
      &.eng-count { background: #EBF5FB; color: #3A9FD6; }
      &.eng-count.zero { background: #f0f4f8; color: #9aa5b4; }
      &.rate      { background: #e8f9f2; color: #0f8a5f; }
    }
    .delete-item { color: #dc2626 !important; }

    .card-footer {
      margin-top: 14px; padding-top: 12px;
      border-top: 1px solid #f0f3f7;
      display: flex; justify-content: flex-end;
    }
    .billing-btn { font-size: 13px; }
  `],
})
export class SponsorListComponent implements OnInit {
  loading = signal(true);
  sponsors = signal<Sponsor[]>([]);

  constructor(
    private sponsorSvc: SponsorService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void { this.load(); }

  initials(s: Sponsor): string {
    const parts = s.name.trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }

  load(): void {
    this.loading.set(true);
    this.sponsorSvc.list().subscribe({
      next: (list) => { this.sponsors.set(list); this.loading.set(false); },
      error: () => { this.loading.set(false); this.snack.open('Failed to load sponsors', 'OK', { duration: 3000 }); },
    });
  }

  newSponsor(): void {
    const ref = this.dialog.open(SponsorDialogComponent, { data: {}, width: '560px' });
    ref.afterClosed().subscribe((sponsor) => { if (sponsor) this.load(); });
  }

  edit(s: Sponsor): void {
    const ref = this.dialog.open(SponsorDialogComponent, { data: { sponsor: s }, width: '560px' });
    ref.afterClosed().subscribe((sponsor) => { if (sponsor) this.load(); });
  }

  confirmDelete(s: Sponsor): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete sponsor',
        message: `Delete ${s.name}? Engagements that reference this sponsor will need a new one.`,
        confirmLabel: 'Delete',
        confirmColor: 'warn',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.sponsorSvc.delete(s._id).subscribe({
        next: () => { this.snack.open('Sponsor deleted', 'OK', { duration: 2500 }); this.load(); },
        error: (err: HttpErrorResponse) => {
          this.snack.open(err?.error?.error || 'Failed to delete', 'OK', { duration: 4000 });
        },
      });
    });
  }
}
