import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { SessionDialogComponent } from '../session-dialog/session-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { JournalService, SessionNote } from '../../journal/journal.service';

interface Session {
  _id: string;
  date: string;
  duration: number;
  format: string;
  growFocus: string[];
  frameworks: string[];
  coachNotes: string;
  sharedNotes: string;
  preSessionRating?: number;
  postSessionRating?: number;
  topics: string[];
  status: string;
  googleMeetLink?: string;
  createdAt: string;
}

@Component({
  selector: 'app-engagement-detail',
  standalone: true,
  imports: [
    CommonModule, DatePipe, CurrencyPipe, RouterLink, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatDividerModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
    <div class="detail-page">
      <div class="page-header">
        <a routerLink="/coaching" class="back-link"><mat-icon>arrow_back</mat-icon> Coaching</a>
        @if (canManage()) {
          <button mat-raised-button color="primary" (click)="addSession()">
            <mat-icon>add</mat-icon> New Session
          </button>
        }
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else if (engagement()) {
        <div class="detail-layout">

          <!-- Sidebar info -->
          <div class="info-card">
            <div class="coachee-block">
              @if (engagement()!.coacheeId?.profilePicture) {
                <img class="avatar avatar-img" [src]="engagement()!.coacheeId.profilePicture" alt="" />
              } @else {
                <div class="avatar">{{ initials() }}</div>
              }
              <h2>{{ coacheeName() }}</h2>
              <span class="status-chip" [style.background]="statusColor() + '18'" [style.color]="statusColor()">
                {{ engagement()!.status | titlecase }}
              </span>
            </div>
            <mat-divider />
            <div class="info-list">
              <div class="info-item"><span class="info-label">Sessions</span><span>{{ engagement()!.sessionsUsed }} / {{ engagement()!.sessionsPurchased }}</span></div>
              @if (engagement()!.cadence) { <div class="info-item"><span class="info-label">Cadence</span><span>{{ engagement()!.cadence }}</span></div> }
              @if (engagement()!.startDate) { <div class="info-item"><span class="info-label">Started</span><span>{{ engagement()!.startDate | date:'MMM d, y' }}</span></div> }
              @if (engagement()!.sponsorName) { <div class="info-item"><span class="info-label">Sponsor</span><span>{{ engagement()!.sponsorName }}</span></div> }
            </div>
            @if (engagement()!.goals?.length) {
              <mat-divider />
              <div class="goals-block">
                <span class="info-label">Goals</span>
                @for (g of engagement()!.goals; track g) {
                  <span class="goal-chip">{{ g }}</span>
                }
              </div>
            }
            @if (engagement()!.notes && canManage()) {
              <mat-divider />
              <div class="notes-block">
                <span class="info-label">Private Notes</span>
                <p>{{ engagement()!.notes }}</p>
              </div>
            }
            @if (engagement()!.rebillCoachee && canManage()) {
              <mat-divider />
              <div class="billing-block">
                <span class="info-label">Billing</span>
                <div class="billing-row">
                  <mat-icon>receipt_long</mat-icon>
                  <span>Rebill coachee</span>
                  <span class="billing-badge">Active</span>
                </div>
                @if (engagementHourlyRate()) {
                  <div class="billing-rate">{{ engagementHourlyRate() | currency:'CAD':'symbol':'1.2-2' }} / hr</div>
                }
                <a class="billing-link" [routerLink]="'/coaching/billing/' + coacheeId()" [queryParams]="{ engagementId: engagement()!._id }">
                  <mat-icon>open_in_new</mat-icon> Coachee Billing
                </a>
              </div>
            }
            @if (canManage()) {
              <mat-divider />
              <div class="journal-block">
                <a class="journal-link" [routerLink]="'/journal/engagement/' + engagement()!._id">
                  <mat-icon>auto_stories</mat-icon> Session Journal
                </a>
              </div>
            }
          </div>

          <!-- Sessions timeline -->
          <div class="sessions-col">
            <h3>Sessions <span class="session-count">{{ sessions().length }}</span></h3>

            @if (sessions().length === 0) {
              <div class="empty-sessions">
                <mat-icon>event_note</mat-icon>
                <p>No sessions recorded yet.</p>
              </div>
            }

            @for (s of sessions(); track s._id) {
              <div class="session-card" [class]="'status-' + s.status">
                <div class="session-header">
                  <div class="session-date">
                    <mat-icon>event</mat-icon>
                    <strong>{{ s.date | date:'MMM d, y — h:mm a' }}</strong>
                  </div>
                  <span class="session-duration">{{ s.duration }} min · {{ s.format }}</span>
                  <span class="session-status" [class]="s.status">{{ s.status }}</span>
                  @if (canManage()) {
                    <button mat-icon-button matTooltip="Edit" (click)="editSession(s)"><mat-icon>edit</mat-icon></button>
                    <button mat-icon-button matTooltip="Delete" class="del-btn" (click)="deleteSession(s)"><mat-icon>delete_outline</mat-icon></button>
                  }
                </div>

                @if (s.googleMeetLink) {
                  <a class="meet-link" [href]="s.googleMeetLink" target="_blank" rel="noopener">
                    <mat-icon>videocam</mat-icon> Join Google Meet
                  </a>
                }

                @if (s.topics?.length) {
                  <div class="session-topics">
                    @for (t of s.topics; track t) { <span class="topic-chip">{{ t }}</span> }
                  </div>
                }

                @if (s.growFocus?.length) {
                  <div class="grow-tags">
                    @for (g of s.growFocus; track g) {
                      <span class="grow-tag" [class]="g">{{ g | titlecase }}</span>
                    }
                  </div>
                }

                @if (s.sharedNotes) {
                  <div class="notes-section shared">
                    <span class="notes-label"><mat-icon>visibility</mat-icon> Shared Notes</span>
                    <p>{{ s.sharedNotes }}</p>
                  </div>
                }

                @if (s.coachNotes && canManage()) {
                  <div class="notes-section private">
                    <span class="notes-label"><mat-icon>lock</mat-icon> Private Notes</span>
                    <p>{{ s.coachNotes }}</p>
                  </div>
                }

                <div class="session-footer">
                  @if (s.preSessionRating) {
                    <span class="rating">
                      <span class="rating-label">Mood</span>
                      @for (i of [1,2,3,4,5,6,7,8,9,10]; track i) {
                        <mat-icon class="star-sm" [class.filled]="i <= s.preSessionRating!">{{ i <= s.preSessionRating! ? 'star' : 'star_border' }}</mat-icon>
                      }
                    </span>
                  }
                  @if (s.postSessionRating) {
                    <span class="rating">
                      <span class="rating-label">Rating</span>
                      @for (i of [1,2,3,4,5]; track i) {
                        <mat-icon class="star-sm" [class.filled]="i <= s.postSessionRating!">{{ i <= s.postSessionRating! ? 'star' : 'star_border' }}</mat-icon>
                      }
                    </span>
                  }
                </div>

                <!-- Journal note -->
                @if (canManage()) {
                  @if (noteFor(s._id); as note) {
                    <div class="journal-summary">
                      <mat-icon>auto_stories</mat-icon>
                      <div class="journal-text">
                        <span class="journal-label">Journal Note #{{ note.sessionNumber }}
                          <span class="journal-status" [class]="note.status">{{ note.status }}</span>
                        </span>
                        <span class="journal-preview">{{ note.aiSummary || note.inSession?.observations?.slice(0, 100) || 'No observations yet' }}</span>
                      </div>
                      <a mat-icon-button [routerLink]="'/journal/note/' + note._id" matTooltip="View journal note">
                        <mat-icon>open_in_new</mat-icon>
                      </a>
                    </div>
                  } @else {
                    <a class="add-journal-link" [routerLink]="'/journal/note/new/' + engId" [queryParams]="{ sessionId: s._id }">
                      <mat-icon>auto_stories</mat-icon> Add Journal Note
                    </a>
                  }
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .detail-page { padding: 32px; }
    .back-link { display: flex; align-items: center; gap: 4px; color: #3A9FD6; text-decoration: none; font-size: 14px; font-weight: 500; }

    .detail-layout { display: grid; grid-template-columns: 280px 1fr; gap: 24px; align-items: start; }

    .info-card {
      background: white; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      overflow: hidden; position: sticky; top: 24px;
    }
    .coachee-block { padding: 24px; text-align: center; }
    .avatar {
      width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 12px;
      background: linear-gradient(135deg, #3A9FD6, #27C4A0);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: 700; color: white;
    }
    .avatar-img { object-fit: cover; background: none; }
    .coachee-block h2 { font-size: 18px; color: #1B2A47; margin: 0 0 8px; }
    .status-chip { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }

    .info-list, .goals-block, .notes-block, .billing-block { padding: 16px 20px; }
    .info-item { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #374151; }
    .info-label { font-size: 11px; color: #9aa5b4; text-transform: uppercase; letter-spacing: 0.4px; display: block; margin-bottom: 4px; }
    .goal-chip { display: inline-block; font-size: 11px; background: #EBF5FB; color: #3A9FD6; padding: 2px 8px; border-radius: 4px; margin: 2px; }
    .notes-block p { font-size: 13px; color: #5a6a7e; margin: 0; line-height: 1.5; }

    .billing-row {
      display: flex; align-items: center; gap: 6px; font-size: 13px; color: #374151;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #7c5cbf; }
    }
    .billing-badge {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      background: rgba(124,92,191,0.12); color: #7c5cbf; padding: 2px 8px; border-radius: 999px;
    }
    .billing-rate { font-size: 13px; color: #1B2A47; font-weight: 600; margin-top: 6px; }
    .billing-link {
      display: flex; align-items: center; gap: 4px; font-size: 12px; color: #3A9FD6;
      cursor: pointer; margin-top: 8px; text-decoration: none;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &:hover { text-decoration: underline; }
    }

    .journal-summary {
      display: flex; align-items: flex-start; gap: 8px; margin-top: 10px;
      padding: 10px 12px; background: #faf8f2; border-radius: 8px; border-left: 3px solid #7c5cbf;
      > mat-icon { color: #7c5cbf; font-size: 18px; width: 18px; height: 18px; margin-top: 2px; flex-shrink: 0; }
    }
    .journal-text { flex: 1; min-width: 0; }
    .journal-label {
      display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #1B2A47;
    }
    .journal-status {
      font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 999px;
      &.complete { background: #e8faf4; color: #1a9678; }
      &.draft { background: #f0f4f8; color: #9aa5b4; }
    }
    .journal-preview { display: block; font-size: 12px; color: #5a6a7e; line-height: 1.4; margin-top: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .add-journal-link {
      display: flex; align-items: center; gap: 4px; margin-top: 8px;
      font-size: 12px; color: #7c5cbf; text-decoration: none; font-weight: 500;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &:hover { text-decoration: underline; }
    }

    .journal-block { padding: 16px; }
    .journal-link {
      display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #7c5cbf;
      text-decoration: none;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover { text-decoration: underline; }
    }

    .sessions-col h3 {
      font-size: 16px; color: #1B2A47; margin: 0 0 16px; display: flex; align-items: center; gap: 8px;
      .session-count { font-size: 12px; background: #f0f4f8; color: #5a6a7e; padding: 2px 8px; border-radius: 999px; }
    }

    .empty-sessions { text-align: center; padding: 48px; color: #9aa5b4; mat-icon { font-size: 40px; width: 40px; height: 40px; display: block; margin: 0 auto 8px; } p { margin: 0; } }

    .session-card {
      background: white; border-radius: 14px; padding: 18px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 12px;
      border-left: 4px solid #e8edf4;
      &.status-completed { border-left-color: #27C4A0; }
      &.status-scheduled { border-left-color: #3A9FD6; }
      &.status-cancelled { border-left-color: #9aa5b4; opacity: 0.7; }
      &.status-no_show { border-left-color: #e53e3e; opacity: 0.7; }
    }

    .session-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .session-date { display: flex; align-items: center; gap: 4px; font-size: 14px; color: #1B2A47; mat-icon { font-size: 16px; color: #3A9FD6; } }
    .session-duration { font-size: 12px; color: #9aa5b4; margin-left: auto; }
    .session-status {
      font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 999px;
      &.completed { background: #e8faf4; color: #1a9678; }
      &.scheduled { background: #EBF5FB; color: #3A9FD6; }
      &.cancelled { background: #f0f4f8; color: #9aa5b4; }
      &.no_show { background: #fef2f2; color: #e53e3e; }
    }
    .del-btn { color: #c5d0db; &:hover { color: #e53e3e; } }

    .session-topics { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
    .topic-chip { font-size: 11px; background: #f0f4f8; color: #5a6a7e; padding: 2px 8px; border-radius: 4px; }

    .grow-tags { display: flex; gap: 4px; margin-bottom: 8px; }
    .grow-tag {
      font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;
      &.goal { background: #f0fdf4; color: #1a9678; }
      &.reality { background: #eff6ff; color: #2080b0; }
      &.options { background: #fefce8; color: #b07800; }
      &.will { background: #fdf2f8; color: #9b2c5b; }
    }

    .notes-section {
      padding: 10px 14px; border-radius: 8px; margin-bottom: 8px;
      &.shared { background: #f0f9ff; border-left: 3px solid #3A9FD6; }
      &.private { background: #fff8f0; border-left: 3px solid #f0a500; }
      .notes-label { font-size: 11px; font-weight: 600; color: #9aa5b4; display: flex; align-items: center; gap: 4px; margin-bottom: 4px; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
      p { font-size: 13px; color: #374151; margin: 0; line-height: 1.6; white-space: pre-wrap; }
    }

    .session-footer { display: flex; gap: 12px; }
    .rating { font-size: 12px; color: #5a6a7e; display: flex; align-items: center; gap: 1px; }
    .rating-label { font-size: 11px; font-weight: 600; color: #9aa5b4; margin-right: 4px; }
    .star-sm { font-size: 14px; width: 14px; height: 14px; color: #d1d5db; &.filled { color: #f59e0b; } }

    .meet-link {
      display: inline-flex; align-items: center; gap: 4px; margin: 6px 0;
      font-size: 12px; font-weight: 600; color: white; text-decoration: none;
      background: #1a73e8; padding: 4px 12px; border-radius: 6px;
      transition: background 0.15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #1557b0; }
    }

    @media (max-width: 768px) { .detail-layout { grid-template-columns: 1fr; } .info-card { position: static; } }
  `],
})
export class EngagementDetailComponent implements OnInit {
  engagement = signal<any>(null);
  sessions = signal<Session[]>([]);
  loading = signal(true);
  private notesBySession = new Map<string, SessionNote>();
  engId = '';

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private auth: AuthService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
    private journal: JournalService,
  ) {}

  canManage = () => ['admin', 'hr_manager', 'coach'].includes(this.auth.currentUser()?.role ?? '');

  initials(): string {
    const c = this.engagement()?.coacheeId;
    return c && typeof c === 'object' ? `${c.firstName[0]}${c.lastName[0]}` : '?';
  }

  coacheeName(): string {
    const c = this.engagement()?.coacheeId;
    return c && typeof c === 'object' ? `${c.firstName} ${c.lastName}` : 'Unknown';
  }

  coacheeId(): string {
    const c = this.engagement()?.coacheeId;
    return c && typeof c === 'object' ? c._id : c ?? '';
  }

  engagementHourlyRate(): number | null {
    return this.engagement()?.hourlyRate ?? null;
  }

  noteFor(sessionId: string): SessionNote | undefined {
    return this.notesBySession.get(sessionId);
  }

  statusColor(): string {
    const map: Record<string, string> = { prospect: '#9aa5b4', contracted: '#3A9FD6', active: '#27C4A0', paused: '#f0a500', completed: '#1a9678', alumni: '#7c5cbf' };
    return map[this.engagement()?.status] || '#9aa5b4';
  }

  ngOnInit(): void {
    this.engId = this.route.snapshot.params['id'];
    this.load();
  }

  load(): void {
    this.loading.set(true);
    Promise.all([
      this.api.get(`/coaching/engagements/${this.engId}`).toPromise(),
      this.api.get<Session[]>(`/coaching/sessions?engagementId=${this.engId}`).toPromise(),
      this.journal.getEngagementNotes(this.engId).toPromise(),
    ]).then(([eng, sessions, notes]) => {
      this.engagement.set(eng);
      this.sessions.set(sessions!);
      // Index journal notes by sessionId
      this.notesBySession.clear();
      (notes || []).forEach((n) => { if (n.sessionId) this.notesBySession.set(n.sessionId, n); });
      this.loading.set(false);
    }).catch(() => this.loading.set(false));
  }

  addSession(): void {
    const ref = this.dialog.open(SessionDialogComponent, {
      data: { engagementId: this.engId, coacheeId: this.engagement()?.coacheeId?._id },
      minWidth: '600px', maxHeight: '92vh',
    });
    ref.afterClosed().subscribe((r) => { if (r) this.load(); });
  }

  editSession(s: Session): void {
    const ref = this.dialog.open(SessionDialogComponent, {
      data: { ...s, engagementId: this.engId, coacheeId: this.engagement()?.coacheeId?._id },
      minWidth: '600px', maxHeight: '92vh',
    });
    ref.afterClosed().subscribe((r) => { if (r) this.load(); });
  }

  deleteSession(s: Session): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px', data: { title: 'Delete Session', message: 'Delete this session?', confirmLabel: 'Delete', confirmColor: 'warn', icon: 'delete_forever' },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.api.delete(`/coaching/sessions/${s._id}`).subscribe({ next: () => this.load() });
    });
  }
}
