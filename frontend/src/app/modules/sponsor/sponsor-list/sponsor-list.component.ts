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
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-sponsor-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatMenuModule, MatTooltipModule, MatDialogModule,
    AvatarComponent,
    TranslateModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>{{ "SPONSOR.title" | translate }}</h1>
          <p>{{ "SPONSOR.titleDesc" | translate }}</p>
        </div>
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="36" /></div>
      } @else if (sponsors().length === 0) {
        <div class="empty">
          <mat-icon>account_balance</mat-icon>
          <h3>{{ "SPONSOR.noSponsors" | translate }}</h3>
          <p>{{ "SPONSOR.noSponsorsDesc" | translate }}</p>
          <button mat-flat-button color="primary" (click)="newSponsor()">
            <mat-icon>add</mat-icon> {{ "SPONSOR.newSponsor" | translate }}
          </button>
        </div>
      } @else {
        <div class="grid">
          @for (s of sponsors(); track s._id) {
            <div class="card" [class.inactive]="!s.isActive">
              <div class="card-top">
                <div class="ident">
                  <app-avatar [firstName]="sponsorFirstName(s)" [lastName]="sponsorLastName(s)" [size]="44" />
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
                    <mat-icon>receipt_long</mat-icon> {{ 'SPONSOR.viewBilling' | translate }}
                  </a>
                  <button mat-menu-item (click)="edit(s)">
                    <mat-icon>edit</mat-icon> {{ 'COMMON.edit' | translate }}
                  </button>
                  <button mat-menu-item class="delete-item" (click)="confirmDelete(s)">
                    <mat-icon>delete</mat-icon> {{ 'COMMON.delete' | translate }}
                  </button>
                </mat-menu>
              </div>

              <div class="badges">
                @if (s.coacheeId) {
                  <span class="badge self-pay">{{ 'SPONSOR.selfPay' | translate }}</span>
                }
                <span class="badge eng-count" [class.zero]="!s.activeEngagements">
                  {{ s.activeEngagements || 0 }} {{ 'COMMON.active' | translate | lowercase }} · {{ s.totalEngagements || 0 }} {{ 'COMMON.total' | translate }}
                </span>
                @if (s.defaultHourlyRate) {
                  <span class="badge rate">{{ s.defaultHourlyRate | currency }}/{{ 'SPONSOR.perHour' | translate }}</span>
                }
              </div>

              <div class="card-footer">
                <a mat-stroked-button color="primary"
                   class="billing-btn"
                   [routerLink]="['/billing/sponsors', s._id]">
                  <mat-icon>receipt_long</mat-icon> {{ 'SPONSOR.viewBilling' | translate }}
                </a>
              </div>
            </div>
          }
          <button type="button" class="card new-card" (click)="newSponsor()">
            <mat-icon>add</mat-icon>
            <span>{{ 'SPONSOR.newSponsor' | translate }}</span>
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
      h1 { margin: 0 0 4px; font-size: 24px; color: var(--artes-primary); }
      p  { margin: 0; color: #6b7c93; }
    }
    .loading { display: flex; justify-content: center; padding: 60px 0; }
    .empty {
      text-align: center; padding: 60px 24px; color: #6b7c93;
      > mat-icon { font-size: 36px; width: 36px; height: 36px; color: #c8d3df; }
      h3 { margin: 12px 0 4px; color: var(--artes-primary); }
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
        color: var(--artes-accent);
      }
      &:hover {
        border-color: var(--artes-accent); background: var(--artes-bg); color: var(--artes-primary);
        box-shadow: 0 4px 16px rgba(58,159,214,0.12);
      }
    }
    .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .ident { display: flex; gap: 12px; min-width: 0; }
    .ident-body {
      display: flex; flex-direction: column; gap: 2px; min-width: 0;
      strong { font-size: 14px; color: var(--artes-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .email { font-size: 12px; color: #6b7c93; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .org   { font-size: 12px; color: #9aa5b4; }
    }
    .badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .badge {
      font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
      &.self-pay  { background: #f3eafc; color: #6b3aa0; }
      &.eng-count { background: var(--artes-bg); color: var(--artes-accent); }
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
    private translate: TranslateService,
  ) {}

  ngOnInit(): void { this.load(); }

  sponsorFirstName(s: Sponsor): string {
    return s.name.trim().split(/\s+/)[0] || '';
  }

  sponsorLastName(s: Sponsor): string {
    return s.name.trim().split(/\s+/)[1] || '';
  }

  load(): void {
    this.loading.set(true);
    this.sponsorSvc.list().subscribe({
      next: (list) => { this.sponsors.set(list); this.loading.set(false); },
      error: () => { this.loading.set(false); this.snack.open(this.translate.instant('SPONSOR.loadFailed'), this.translate.instant('COMMON.ok'), { duration: 3000 }); },
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
        title: this.translate.instant('SPONSOR.deleteSponsor'),
        message: this.translate.instant('SPONSOR.deleteSponsorConfirm', { name: s.name }),
        confirmLabel: this.translate.instant('COMMON.delete'),
        confirmColor: 'warn',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.sponsorSvc.delete(s._id).subscribe({
        next: () => { this.snack.open(this.translate.instant('SPONSOR.sponsorDeleted'), this.translate.instant('COMMON.ok'), { duration: 2500 }); this.load(); },
        error: (err: HttpErrorResponse) => {
          this.snack.open(err?.error?.error || this.translate.instant('SPONSOR.deleteFailed'), this.translate.instant('COMMON.ok'), { duration: 4000 });
        },
      });
    });
  }
}
