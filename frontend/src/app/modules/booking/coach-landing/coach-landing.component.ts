import { Component, Inject, OnInit, Optional, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  PublicBookingService,
  CoachLanding,
  CoachLandingEventType,
} from '../booking.service';

@Component({
  selector: 'app-coach-landing',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page" [class.dialog-mode]="isDialog">
      @if (isDialog) {
        <button mat-icon-button class="close-btn" (click)="closeDialog()" aria-label="Close">
          <mat-icon>close</mat-icon>
        </button>
      }
      @if (loading()) {
        <div class="loading"><mat-spinner diameter="40" /></div>
      } @else if (notFound()) {
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <h2>Coach page not found</h2>
          <p>The link you followed may be broken or the coach page is no longer available.</p>
        </div>
      } @else if (data()) {
        <div class="container">
          <header class="header">
            <div class="avatar-wrap">
              @if (data()!.coach.profilePicture) {
                <img [src]="data()!.coach.profilePicture" [alt]="fullName()" class="avatar" />
              } @else {
                <div class="avatar-fallback">{{ initials() }}</div>
              }
            </div>
            <h1>{{ fullName() }}</h1>
            @if (data()!.coach.bio) {
              <p class="bio">{{ data()!.coach.bio }}</p>
            }
          </header>

          <section class="events">
            <h2 class="events-label">Book a session</h2>
            @if (!data()!.eventTypes.length) {
              <p class="empty">No booking types are currently available.</p>
            } @else {
              <ul class="event-list">
                @for (et of data()!.eventTypes; track et._id) {
                  <li class="event-card" [style.borderLeftColor]="et.color">
                    <div class="event-body">
                      <h3>{{ et.title }}</h3>
                      <div class="meta">
                        <span class="meta-item">
                          <mat-icon>schedule</mat-icon> {{ et.duration }} min
                        </span>
                        @if (et.googleMeetEnabled) {
                          <span class="meta-item">
                            <mat-icon>videocam</mat-icon> Google Meet
                          </span>
                        }
                      </div>
                      @if (et.description) {
                        <p class="event-desc">{{ et.description }}</p>
                      }
                    </div>
                    <button mat-flat-button color="primary"
                            (click)="selectEventType(et)"
                            class="book-btn">
                      Select
                      <mat-icon>arrow_forward</mat-icon>
                    </button>
                  </li>
                }
              </ul>
            }
          </section>

          <footer class="footer">
            Powered by ARTES
          </footer>
        </div>
      }
    </div>
  `,
  styles: [`
    .page {
      min-height: 100vh;
      background: linear-gradient(180deg, #f7f9fc 0%, #EBF5FB 100%);
      padding: 48px 16px;
      box-sizing: border-box;
      position: relative;
    }
    .page.dialog-mode {
      min-height: auto; padding: 32px 24px 24px;
    }
    .close-btn {
      position: absolute; top: 8px; right: 8px; z-index: 2;
    }
    .loading, .error-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 60vh; gap: 12px;
      h2 { margin: 0; color: #1B2A47; font-size: 22px; }
      p { margin: 0; color: #6b7c93; max-width: 420px; text-align: center; }
      mat-icon { font-size: 56px; width: 56px; height: 56px; color: #c8d3df; }
    }

    .container {
      max-width: 720px; margin: 0 auto;
    }

    .header {
      text-align: center; margin-bottom: 40px;
      h1 {
        margin: 16px 0 8px; font-size: 30px; color: #1B2A47;
        letter-spacing: -0.5px; font-weight: 700;
      }
    }
    .avatar-wrap {
      display: inline-block; position: relative;
    }
    .avatar, .avatar-fallback {
      width: 96px; height: 96px; border-radius: 50%;
      border: 4px solid #fff; box-shadow: 0 4px 16px rgba(27, 42, 71, 0.1);
    }
    .avatar { object-fit: cover; }
    .avatar-fallback {
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #3A9FD6, #27C4A0);
      color: #fff; font-size: 32px; font-weight: 600;
    }
    .bio {
      margin: 0 auto; max-width: 520px; line-height: 1.55;
      color: #46546b; font-size: 15px;
    }

    .events-label {
      font-size: 13px; text-transform: uppercase; letter-spacing: 0.8px;
      color: #6b7c93; margin: 0 0 12px; font-weight: 600;
    }
    .empty { color: #6b7c93; font-style: italic; }
    .event-list {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 12px;
    }
    .event-card {
      display: flex; align-items: center; gap: 16px;
      background: #fff; border-radius: 12px; padding: 20px 22px;
      border-left: 4px solid #3A9FD6;
      box-shadow: 0 1px 3px rgba(27, 42, 71, 0.06);
      transition: transform 0.12s ease, box-shadow 0.12s ease;
      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(27, 42, 71, 0.08);
      }
    }
    .event-body {
      flex: 1; min-width: 0;
      h3 {
        margin: 0 0 8px; font-size: 17px; color: #1B2A47;
        font-weight: 600;
      }
    }
    .meta {
      display: flex; flex-wrap: wrap; gap: 14px;
      color: #6b7c93; font-size: 13px;
    }
    .meta-item {
      display: inline-flex; align-items: center; gap: 4px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #3A9FD6; }
    }
    .event-desc {
      margin: 8px 0 0; color: #46546b; font-size: 14px; line-height: 1.5;
    }
    .book-btn {
      white-space: nowrap; border-radius: 999px !important;
      mat-icon { margin-left: 4px; font-size: 18px; width: 18px; height: 18px; }
    }

    .footer {
      text-align: center; margin-top: 48px;
      color: #9aa5b4; font-size: 12px; letter-spacing: 0.5px;
    }

    @media (max-width: 600px) {
      .page { padding: 32px 12px; }
      .event-card { flex-direction: column; align-items: stretch; gap: 12px; }
      .book-btn { align-self: stretch; }
    }
  `],
})
export class CoachLandingComponent implements OnInit {
  loading = signal(true);
  notFound = signal(false);
  data = signal<CoachLanding | null>(null);

  isDialog = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingSvc: PublicBookingService,
    @Optional() private dialogRef?: MatDialogRef<CoachLandingComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) private dialogData?: { slug: string },
  ) {
    this.isDialog = !!this.dialogRef;
  }

  ngOnInit(): void {
    const slug = this.dialogData?.slug ?? this.route.snapshot.params['slug'];
    this.bookingSvc.getCoachLanding(slug).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  fullName(): string {
    const d = this.data();
    return d ? `${d.coach.firstName} ${d.coach.lastName}`.trim() : '';
  }

  initials(): string {
    const d = this.data();
    if (!d) return '';
    return `${d.coach.firstName.charAt(0)}${d.coach.lastName.charAt(0)}`.toUpperCase();
  }

  selectEventType(et: CoachLandingEventType): void {
    if (this.isDialog) {
      this.dialogRef?.close();
    }
    this.router.navigate(['/book', et.coachSlug]);
  }

  closeDialog(): void {
    this.dialogRef?.close();
  }

  trackEt = (_: number, et: CoachLandingEventType) => et._id;
}
