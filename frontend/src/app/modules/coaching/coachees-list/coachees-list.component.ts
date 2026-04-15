import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { ApiService } from '../../../core/api.service';

type EngagementStatus = 'prospect' | 'contracted' | 'active' | 'paused' | 'completed' | 'alumni';
type FilterKey = 'all' | EngagementStatus | 'none';

interface CoacheeUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  profilePicture?: string;
  isActive?: boolean;
  sponsorId?: string | { _id: string; name?: string; email?: string; organization?: string } | null;
}

interface Engagement {
  _id: string;
  coacheeId: { _id: string; firstName: string; lastName: string; email: string; department?: string; profilePicture?: string } | string;
  status: EngagementStatus;
  sessionsPurchased: number;
  sessionsUsed: number;
  createdAt: string;
}

interface Row {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  profilePicture?: string;
  sponsorName?: string;
  sponsorOrg?: string;
  /** Flattened list of engagements the current coach has with this coachee. */
  engagements: Engagement[];
  /** Best/most-current status — or 'none' when no engagements exist. */
  primaryStatus: EngagementStatus | 'none';
  /** The engagement that matches the primary status (for direct-open link). */
  primaryEngagement?: Engagement;
  sessionsUsed: number;
  sessionsPurchased: number;
}

const STATUS_LABEL: Record<EngagementStatus | 'none', string> = {
  prospect:   'Prospect',
  contracted: 'Contracted',
  active:     'Active',
  paused:     'Paused',
  completed:  'Completed',
  alumni:     'Alumni',
  none:       'No engagement',
};

const STATUS_COLOR: Record<EngagementStatus | 'none', string> = {
  prospect:   '#9aa5b4',
  contracted: '#3A9FD6',
  active:     '#27C4A0',
  paused:     '#f0a500',
  completed:  '#6b7c93',
  alumni:     '#b07cc6',
  none:       '#c3cfdd',
};

// Priority order for picking a single status per coachee.
const STATUS_PRIORITY: EngagementStatus[] = ['active', 'contracted', 'prospect', 'paused', 'completed', 'alumni'];

@Component({
  selector: 'app-coachees-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule, MatTableModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Coachees</h1>
          <p>Every active coachee in the organization. Filter by engagement status.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="36" /></div>
      } @else if (!allRows().length) {
        <div class="empty">
          <mat-icon>people_alt</mat-icon>
          <h3>No active coachees</h3>
          <p>Invite coachees from User Management to start coaching.</p>
        </div>
      } @else {
        <!-- Filter pills -->
        <div class="pills">
          @for (p of pills(); track p.key) {
            <button type="button" class="pill"
                    [class.active]="filter() === p.key"
                    [style.--dot]="p.color"
                    (click)="filter.set(p.key)">
              @if (p.key !== 'all') { <span class="dot"></span> }
              {{ p.label }}
              <span class="count">{{ p.count }}</span>
            </button>
          }
        </div>

        <!-- Search -->
        <mat-form-field appearance="outline" class="search">
          <mat-icon matPrefix>search</mat-icon>
          <input matInput type="search" [ngModel]="search()" (ngModelChange)="search.set($event)"
                 placeholder="Search name, email or department" />
        </mat-form-field>

        @if (!filtered().length) {
          <div class="empty-small">
            <mat-icon>filter_list_off</mat-icon>
            <p>No coachees match the current filter.</p>
          </div>
        } @else {
          <div class="table-wrap">
            <table mat-table [dataSource]="filtered()" class="coachees-table">

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let r">
                  <div class="name-cell">
                    <div class="avatar">
                      @if (r.profilePicture) {
                        <img [src]="r.profilePicture" alt="" />
                      } @else {
                        {{ initials(r) }}
                      }
                    </div>
                    <div class="n-col">
                      <strong>{{ r.firstName }} {{ r.lastName }}</strong>
                      @if (r.department) { <span class="dept">{{ r.department }}</span> }
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="email">
                <th mat-header-cell *matHeaderCellDef>Email</th>
                <td mat-cell *matCellDef="let r" class="muted">{{ r.email }}</td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let r">
                  <span class="status-chip"
                        [style.background]="statusColor(r.primaryStatus) + '22'"
                        [style.color]="statusColor(r.primaryStatus)">
                    {{ statusLabel(r.primaryStatus) }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="sponsor">
                <th mat-header-cell *matHeaderCellDef>Sponsor</th>
                <td mat-cell *matCellDef="let r">
                  @if (r.sponsorName) {
                    <div class="sponsor-cell">
                      <strong>{{ r.sponsorName }}</strong>
                      @if (r.sponsorOrg) { <span class="sponsor-org">{{ r.sponsorOrg }}</span> }
                    </div>
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="engagement">
                <th mat-header-cell *matHeaderCellDef>Active engagement</th>
                <td mat-cell *matCellDef="let r">
                  @if (activeEngagement(r); as e) {
                    <a [routerLink]="['/coaching', e._id]" class="eng-link" (click)="$event.stopPropagation()">
                      <mat-icon>play_circle</mat-icon>
                      Open
                    </a>
                  } @else if (r.primaryEngagement) {
                    <a [routerLink]="['/coaching', r.primaryEngagement._id]" class="eng-link muted-link"
                       (click)="$event.stopPropagation()">
                      <mat-icon>history</mat-icon>
                      Last engagement
                    </a>
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="sessions">
                <th mat-header-cell *matHeaderCellDef>Sessions</th>
                <td mat-cell *matCellDef="let r">
                  @if (r.sessionsPurchased) {
                    <div class="sess-cell">
                      <div class="sess-bar">
                        <div class="sess-fill" [style.width.%]="sessPct(r)"></div>
                      </div>
                      <span class="sess-txt">{{ r.sessionsUsed }} / {{ r.sessionsPurchased }}</span>
                    </div>
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;"></tr>
            </table>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .page { padding: 24px 32px; width: 100%; max-width: 100%; box-sizing: border-box; }
    .page-header { margin-bottom: 20px;
      h1 { margin: 0 0 4px; font-size: 24px; color: #1B2A47; }
      p  { margin: 0; color: #6b7c93; }
    }
    .loading { display: flex; justify-content: center; padding: 60px 0; }
    .empty, .empty-small {
      text-align: center; padding: 48px 24px; color: #6b7c93;
      background: #fff; border-radius: 12px; border: 1px solid #eef2f7;
      mat-icon { font-size: 42px; width: 42px; height: 42px; color: #c8d3df; display: block; margin: 0 auto 10px; }
      h3 { margin: 0 0 4px; color: #1B2A47; }
      p  { margin: 0 0 14px; }
    }
    .empty-small { padding: 32px 16px;
      mat-icon { font-size: 28px; width: 28px; height: 28px; }
    }

    /* Filter pills */
    .pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 999px; cursor: pointer;
      background: #fff; border: 1px solid #dde5ee; color: #5a6a7e;
      font-size: 13px; font-weight: 500; font-family: inherit;
      transition: all 0.12s;
      .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dot, #9aa5b4); }
      .count {
        font-size: 11px; color: #9aa5b4; padding: 1px 7px;
        background: #f0f4f8; border-radius: 999px; font-weight: 600;
      }
      &:hover { border-color: #b8c6d4; color: #1B2A47; }
      &.active {
        background: #1B2A47; color: #fff; border-color: #1B2A47;
        .count { background: rgba(255,255,255,0.2); color: #fff; }
      }
    }

    .search { width: 360px; max-width: 100%; margin-bottom: 14px; display: block; }

    .table-wrap { background: #fff; border-radius: 12px; border: 1px solid #eef2f7; overflow: hidden; }
    .coachees-table { width: 100%; }
    .coachees-table th {
      font-size: 11px; font-weight: 700; color: #9aa5b4;
      text-transform: uppercase; letter-spacing: 0.3px;
    }
    .coachees-table td { color: #1B2A47; font-size: 14px; }

    .name-cell { display: flex; align-items: center; gap: 10px; }
    .avatar {
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #3A9FD6, #27C4A0);
      color: #fff; font-weight: 600; font-size: 13px; overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .n-col { display: flex; flex-direction: column; gap: 2px; }
    .n-col strong { color: #1B2A47; font-size: 14px; }
    .n-col .dept { font-size: 12px; color: #9aa5b4; }

    .muted { color: #9aa5b4; }
    .status-chip {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      padding: 3px 10px; border-radius: 999px; display: inline-block;
    }

    .eng-link {
      display: inline-flex; align-items: center; gap: 4px;
      color: #27C4A0; font-size: 13px; font-weight: 600; text-decoration: none;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { text-decoration: underline; }
      &.muted-link { color: #6b7c93; mat-icon { color: #6b7c93; } }
    }

    .sess-cell { display: flex; align-items: center; gap: 10px; min-width: 140px; }
    .sess-bar {
      flex: 1; height: 6px; background: #eef2f7; border-radius: 999px; overflow: hidden;
    }
    .sess-fill { height: 100%; background: #27C4A0; transition: width 0.2s; }
    .sess-txt { font-size: 12px; color: #5a6a7e; font-weight: 500; min-width: 46px; text-align: right; }

    .sponsor-cell { display: flex; flex-direction: column; gap: 2px; }
    .sponsor-cell strong { font-size: 13px; color: #1B2A47; font-weight: 600; }
    .sponsor-org { font-size: 11px; color: #9aa5b4; }
  `],
})
export class CoacheesListComponent implements OnInit {
  loading = signal(true);
  coachees = signal<CoacheeUser[]>([]);
  engagements = signal<Engagement[]>([]);
  filter = signal<FilterKey>('active');
  search = signal('');

  columns = ['name', 'email', 'sponsor', 'status', 'engagement', 'sessions'];

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    forkJoin({
      coachees: this.api.get<CoacheeUser[]>('/users/coachees'),
      engagements: this.api.get<Engagement[]>('/coaching/engagements'),
    }).subscribe({
      next: ({ coachees, engagements }) => {
        this.coachees.set(coachees.filter((c) => c.isActive !== false));
        this.engagements.set(engagements);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Build one row per enabled coachee, merging in any engagements this
   *  coach has with them. Coachees without engagements still appear. */
  allRows = computed<Row[]>(() => {
    const engByCoachee = new Map<string, Engagement[]>();
    for (const e of this.engagements()) {
      if (typeof e.coacheeId === 'string' || !e.coacheeId) continue;
      const id = e.coacheeId._id;
      const bucket = engByCoachee.get(id) ?? [];
      bucket.push(e);
      engByCoachee.set(id, bucket);
    }

    return this.coachees()
      .map((c) => {
        const engs = engByCoachee.get(c._id) ?? [];
        let primaryStatus: EngagementStatus | 'none' = 'none';
        let primaryEngagement: Engagement | undefined;
        if (engs.length) {
          let bestRank = STATUS_PRIORITY.length;
          for (const e of engs) {
            const rank = STATUS_PRIORITY.indexOf(e.status);
            if (rank !== -1 && rank < bestRank) {
              bestRank = rank;
              primaryStatus = e.status;
              primaryEngagement = e;
            }
          }
        }
        const sessionsUsed = engs.reduce((sum, e) => sum + (e.sessionsUsed || 0), 0);
        const sessionsPurchased = engs.reduce((sum, e) => sum + (e.sessionsPurchased || 0), 0);
        const sponsor = typeof c.sponsorId === 'object' && c.sponsorId ? c.sponsorId : null;
        return {
          _id: c._id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          department: c.department,
          profilePicture: c.profilePicture,
          sponsorName: sponsor?.name,
          sponsorOrg: sponsor?.organization,
          engagements: engs,
          primaryStatus,
          primaryEngagement,
          sessionsUsed,
          sessionsPurchased,
        } as Row;
      })
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  });

  pills = computed(() => {
    const all = this.allRows();
    const by: Record<string, number> = {
      active: 0, contracted: 0, prospect: 0, paused: 0, completed: 0, alumni: 0, none: 0,
    };
    for (const r of all) by[r.primaryStatus] += 1;
    return [
      { key: 'all' as FilterKey,        label: 'All',          count: all.length,   color: '#1B2A47' },
      { key: 'active' as FilterKey,     label: 'Active',       count: by['active'],     color: STATUS_COLOR.active },
      { key: 'contracted' as FilterKey, label: 'Contracted',   count: by['contracted'], color: STATUS_COLOR.contracted },
      { key: 'prospect' as FilterKey,   label: 'Prospect',     count: by['prospect'],   color: STATUS_COLOR.prospect },
      { key: 'paused' as FilterKey,     label: 'Paused',       count: by['paused'],     color: STATUS_COLOR.paused },
      { key: 'completed' as FilterKey,  label: 'Completed',    count: by['completed'],  color: STATUS_COLOR.completed },
      { key: 'alumni' as FilterKey,     label: 'Alumni',       count: by['alumni'],     color: STATUS_COLOR.alumni },
      { key: 'none' as FilterKey,       label: 'No engagement', count: by['none'],      color: STATUS_COLOR.none },
    ];
  });

  filtered = computed<Row[]>(() => {
    const f = this.filter();
    const q = this.search().trim().toLowerCase();
    return this.allRows().filter((r) => {
      if (f !== 'all' && r.primaryStatus !== f) return false;
      if (q) {
        const hay = `${r.firstName} ${r.lastName} ${r.email} ${r.department ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  statusLabel(s: EngagementStatus | 'none'): string { return STATUS_LABEL[s] ?? s; }
  statusColor(s: EngagementStatus | 'none'): string { return STATUS_COLOR[s] ?? '#9aa5b4'; }

  initials(r: Row): string {
    return `${r.firstName[0] ?? ''}${r.lastName[0] ?? ''}`.toUpperCase();
  }

  /** Return the engagement whose status is literally 'active' (the one the
   *  Open link should target). Falls back to primaryEngagement otherwise. */
  activeEngagement(r: Row): Engagement | undefined {
    return r.engagements.find((e) => e.status === 'active');
  }

  sessPct(r: Row): number {
    if (!r.sessionsPurchased) return 0;
    return Math.min(100, Math.round((r.sessionsUsed / r.sessionsPurchased) * 100));
  }
}
