import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';

type EngagementStatus = 'prospect' | 'contracted' | 'active' | 'paused' | 'completed' | 'alumni';

interface Engagement {
  _id: string;
  coacheeId: { _id: string; firstName: string; lastName: string; email: string; department?: string; profilePicture?: string } | string;
  status: EngagementStatus;
  sessionsPurchased: number;
  sessionsUsed: number;
  startDate?: string;
  targetEndDate?: string;
  createdAt: string;
}

interface CoacheeRow {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  profilePicture?: string;
  engagements: Engagement[];
  /** Best/most-representative status (prefers active over completed/alumni). */
  primaryStatus: EngagementStatus;
  activeEngagementId?: string;
}

const STATUS_LABEL: Record<EngagementStatus, string> = {
  prospect:   'Prospect',
  contracted: 'Contracted',
  active:     'Active',
  paused:     'Paused',
  completed:  'Completed',
  alumni:     'Alumni',
};

const STATUS_COLOR: Record<EngagementStatus, string> = {
  prospect:   '#9aa5b4',
  contracted: '#3A9FD6',
  active:     '#27C4A0',
  paused:     '#f0a500',
  completed:  '#6b7c93',
  alumni:     '#b07cc6',
};

// Priority order for picking a single status per coachee: the "most current"
// engagement wins. Active > Contracted > Prospect > Paused > Completed > Alumni.
const STATUS_PRIORITY: EngagementStatus[] = ['active', 'contracted', 'prospect', 'paused', 'completed', 'alumni'];

type FilterKey = 'all' | EngagementStatus;

@Component({
  selector: 'app-coachees-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Coachees</h1>
          <p>Everyone you're currently coaching or have coached.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="36" /></div>
      } @else if (!allCoachees().length) {
        <div class="empty">
          <mat-icon>people_alt</mat-icon>
          <h3>No coachees yet</h3>
          <p>Create an engagement to start coaching someone.</p>
          <a mat-flat-button color="primary" routerLink="/coaching">
            <mat-icon>arrow_forward</mat-icon> Go to engagements
          </a>
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
          <div class="grid">
            @for (c of filtered(); track c._id) {
              <div class="card" (click)="openCoachee(c)">
                <div class="avatar">
                  @if (c.profilePicture) {
                    <img [src]="c.profilePicture" alt="" />
                  } @else {
                    {{ initials(c) }}
                  }
                </div>
                <div class="body">
                  <div class="name-row">
                    <strong>{{ c.firstName }} {{ c.lastName }}</strong>
                    <span class="status-chip" [style.background]="statusColor(c.primaryStatus) + '22'"
                                              [style.color]="statusColor(c.primaryStatus)">
                      {{ statusLabel(c.primaryStatus) }}
                    </span>
                  </div>
                  <span class="email">{{ c.email }}</span>
                  @if (c.department) { <span class="dept"><mat-icon>apartment</mat-icon>{{ c.department }}</span> }
                  <div class="eng-meta">
                    {{ c.engagements.length }} engagement{{ c.engagements.length === 1 ? '' : 's' }}
                    @if (totalSessions(c); as s) {
                      · {{ s.used }} / {{ s.purchased }} sessions
                    }
                  </div>
                </div>
              </div>
            }
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
    .pills {
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;
    }
    .pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 999px; cursor: pointer;
      background: #fff; border: 1px solid #dde5ee; color: #5a6a7e;
      font-size: 13px; font-weight: 500; font-family: inherit;
      transition: all 0.12s;
      .dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--dot, #9aa5b4);
      }
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

    .search { width: 360px; max-width: 100%; margin-bottom: 18px; display: block; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 14px;
    }
    .card {
      display: flex; gap: 12px; padding: 14px 16px;
      background: #fff; border: 1px solid #eef2f7; border-radius: 12px;
      cursor: pointer; transition: box-shadow 0.12s, transform 0.12s;
      &:hover { box-shadow: 0 4px 14px rgba(27,42,71,0.08); transform: translateY(-1px); }
    }
    .avatar {
      width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #3A9FD6, #27C4A0);
      color: #fff; font-weight: 600; font-size: 14px; overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .name-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .name-row strong { font-size: 14px; color: #1B2A47;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .email { font-size: 12px; color: #6b7c93;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dept {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; color: #9aa5b4;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .eng-meta { font-size: 12px; color: #5a6a7e; margin-top: 6px; }

    .status-chip {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      padding: 2px 8px; border-radius: 999px; flex-shrink: 0;
    }
  `],
})
export class CoacheesListComponent implements OnInit {
  loading = signal(true);
  engagements = signal<Engagement[]>([]);
  filter = signal<FilterKey>('active');
  search = signal('');

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.get<Engagement[]>('/coaching/engagements').subscribe({
      next: (list) => { this.engagements.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  /** Unique coachees grouped from the coach's engagement list. */
  allCoachees = computed<CoacheeRow[]>(() => {
    const map = new Map<string, CoacheeRow>();
    for (const e of this.engagements()) {
      if (typeof e.coacheeId === 'string' || !e.coacheeId) continue;
      const c = e.coacheeId;
      const row = map.get(c._id) ?? {
        _id: c._id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        department: c.department,
        profilePicture: c.profilePicture,
        engagements: [],
        primaryStatus: 'completed' as EngagementStatus,
      };
      row.engagements.push(e);
      map.set(c._id, row);
    }
    // Derive primaryStatus + activeEngagementId per coachee.
    for (const row of map.values()) {
      let best: EngagementStatus = 'alumni';
      let bestRank = STATUS_PRIORITY.length;
      for (const e of row.engagements) {
        const rank = STATUS_PRIORITY.indexOf(e.status);
        if (rank !== -1 && rank < bestRank) { bestRank = rank; best = e.status; }
      }
      row.primaryStatus = best;
      row.activeEngagementId = row.engagements.find((e) => e.status === best)?._id;
    }
    return [...map.values()].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  });

  pills = computed(() => {
    const all = this.allCoachees();
    const byStatus: Record<EngagementStatus, number> = {
      prospect: 0, contracted: 0, active: 0, paused: 0, completed: 0, alumni: 0,
    };
    for (const c of all) byStatus[c.primaryStatus] += 1;
    return [
      { key: 'all' as FilterKey,     label: 'All',        count: all.length,           color: '#1B2A47' },
      { key: 'active' as FilterKey,  label: 'Active',     count: byStatus.active,      color: STATUS_COLOR.active },
      { key: 'contracted' as FilterKey, label: 'Contracted', count: byStatus.contracted, color: STATUS_COLOR.contracted },
      { key: 'prospect' as FilterKey, label: 'Prospect',  count: byStatus.prospect,    color: STATUS_COLOR.prospect },
      { key: 'paused' as FilterKey,  label: 'Paused',     count: byStatus.paused,      color: STATUS_COLOR.paused },
      { key: 'completed' as FilterKey, label: 'Completed', count: byStatus.completed,  color: STATUS_COLOR.completed },
      { key: 'alumni' as FilterKey,  label: 'Alumni',     count: byStatus.alumni,      color: STATUS_COLOR.alumni },
    ];
  });

  filtered = computed<CoacheeRow[]>(() => {
    const f = this.filter();
    const q = this.search().trim().toLowerCase();
    return this.allCoachees().filter((c) => {
      if (f !== 'all' && c.primaryStatus !== f) return false;
      if (q) {
        const hay = `${c.firstName} ${c.lastName} ${c.email} ${c.department ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  statusLabel(s: EngagementStatus): string { return STATUS_LABEL[s] ?? s; }
  statusColor(s: EngagementStatus): string { return STATUS_COLOR[s] ?? '#9aa5b4'; }

  initials(c: CoacheeRow): string {
    return `${c.firstName[0] ?? ''}${c.lastName[0] ?? ''}`.toUpperCase();
  }

  totalSessions(c: CoacheeRow): { used: number; purchased: number } | null {
    const used = c.engagements.reduce((sum, e) => sum + (e.sessionsUsed || 0), 0);
    const purchased = c.engagements.reduce((sum, e) => sum + (e.sessionsPurchased || 0), 0);
    if (!purchased) return null;
    return { used, purchased };
  }

  /** Open the coachee's best-matching engagement. */
  openCoachee(c: CoacheeRow): void {
    const id = c.activeEngagementId ?? c.engagements[0]?._id;
    if (id) this.router.navigate(['/coaching', id]);
  }
}
