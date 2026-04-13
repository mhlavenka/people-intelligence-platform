import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SponsorBilling, SponsorService } from '../sponsor.service';

@Component({
  selector: 'app-sponsor-billing',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="page">
      <div class="header">
        <a mat-icon-button routerLink="/sponsors"><mat-icon>arrow_back</mat-icon></a>
        <div>
          <h1>Sponsor billing</h1>
          @if (data()) {
            <p>{{ data()!.sponsor.name }} · {{ data()!.sponsor.email }}</p>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="36" /></div>
      } @else if (data()) {
        @if (data()!.engagements.length === 0) {
          <div class="empty">
            <mat-icon>receipt_long</mat-icon>
            <p>No billable engagements for this sponsor yet.</p>
          </div>
        } @else {
          <div class="totals">
            <span class="totals-label">Grand total</span>
            <span class="totals-value">{{ data()!.grandTotal | currency }}</span>
          </div>
          <div class="cards">
            @for (e of data()!.engagements; track e.engagementId) {
              <a class="card" [routerLink]="['/coaching', e.engagementId]">
                <div class="card-row">
                  <strong>{{ e.coachee.firstName }} {{ e.coachee.lastName }}</strong>
                  <span class="amt">{{ e.totalAmount | currency }}</span>
                </div>
                <div class="card-meta">
                  <span>Coach: {{ e.coach.firstName }} {{ e.coach.lastName }}</span>
                  <span class="status" [class]="'st-' + e.status">{{ e.status }}</span>
                </div>
                <div class="card-meta small">
                  <span>{{ e.sessionsCompleted }} / {{ e.sessionsPurchased }} sessions</span>
                  <span>{{ e.hourlyRate | currency }}/hr</span>
                </div>
              </a>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1100px; margin: 0 auto; }
    .header {
      display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
      h1 { margin: 0; font-size: 22px; color: #1B2A47; }
      p  { margin: 4px 0 0; color: #6b7c93; font-size: 13px; }
    }
    .loading { display: flex; justify-content: center; padding: 40px 0; }
    .empty {
      text-align: center; color: #6b7c93; padding: 40px 24px;
      mat-icon { font-size: 40px; width: 40px; height: 40px; color: #c8d3df; }
    }
    .totals {
      display: flex; align-items: center; justify-content: space-between;
      background: #fff; border: 1px solid #e8eef4; border-radius: 12px;
      padding: 14px 20px; margin-bottom: 16px;
      .totals-label { color: #6b7c93; font-size: 13px; text-transform: uppercase; letter-spacing: 0.6px; }
      .totals-value { font-size: 22px; color: #1B2A47; font-weight: 700; }
    }
    .cards { display: flex; flex-direction: column; gap: 10px; }
    .card {
      display: block; background: #fff; border: 1px solid #eef2f7; border-radius: 10px;
      padding: 14px 18px; text-decoration: none; color: inherit;
      transition: border-color 0.1s, box-shadow 0.1s;
      &:hover { border-color: #3A9FD6; box-shadow: 0 2px 8px rgba(58,159,214,0.08); }
    }
    .card-row { display: flex; justify-content: space-between; align-items: baseline; }
    .card-row strong { color: #1B2A47; font-size: 15px; }
    .card-row .amt { font-size: 16px; font-weight: 700; color: #0f8a5f; }
    .card-meta {
      display: flex; gap: 14px; margin-top: 6px; align-items: center;
      color: #6b7c93; font-size: 13px;
      &.small { font-size: 12px; color: #9aa5b4; margin-top: 2px; }
    }
    .status {
      text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
      font-size: 10px; padding: 2px 8px; border-radius: 999px;
      background: #f0f4f8; color: #6b7c93;
      &.st-active { background: #e8f9f2; color: #0f8a5f; }
      &.st-completed { background: #EBF5FB; color: #3A9FD6; }
      &.st-paused { background: #fef6e6; color: #b87e08; }
    }
  `],
})
export class SponsorBillingComponent implements OnInit {
  loading = signal(true);
  data = signal<SponsorBilling | null>(null);

  constructor(private route: ActivatedRoute, private sponsorSvc: SponsorService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    this.sponsorSvc.billing(id).subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
