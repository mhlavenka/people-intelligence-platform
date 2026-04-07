import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';

interface Session {
  _id: string;
  engagementId: string;
  coacheeId: { firstName: string; lastName: string } | string;
  date: string;
  duration: number;
  format: string;
  status: string;
  topics: string[];
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  sessions: Session[];
}

@Component({
  selector: 'app-coaching-calendar',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <div class="calendar-page">
      <div class="page-header">
        <a routerLink="/coaching" class="back-link"><mat-icon>arrow_back</mat-icon> Coaching</a>
        <div class="month-nav">
          <button mat-icon-button (click)="prevMonth()"><mat-icon>chevron_left</mat-icon></button>
          <h2>{{ monthLabel() }}</h2>
          <button mat-icon-button (click)="nextMonth()"><mat-icon>chevron_right</mat-icon></button>
          <button mat-stroked-button class="today-btn" (click)="goToday()">Today</button>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {
        <!-- Legend -->
        <div class="legend">
          <span class="legend-item"><span class="dot completed"></span> Completed</span>
          <span class="legend-item"><span class="dot scheduled"></span> Scheduled</span>
          <span class="legend-item"><span class="dot cancelled"></span> Cancelled</span>
        </div>

        <div class="calendar-grid">
          <!-- Day headers -->
          @for (day of dayHeaders; track day) {
            <div class="day-header">{{ day }}</div>
          }

          <!-- Day cells -->
          @for (day of calendarDays(); track day.date.toISOString()) {
            <div class="day-cell" [class.other-month]="!day.isCurrentMonth" [class.today]="day.isToday">
              <span class="day-num">{{ day.date.getDate() }}</span>

              @for (s of day.sessions; track s._id) {
                <div class="event session-event" [class]="s.status"
                     [matTooltip]="sessionTooltip(s)"
                     [routerLink]="'/coaching/' + s.engagementId">
                  <span class="event-time">{{ s.date | date:'h:mm a' }}</span>
                  <span class="event-name">{{ coacheeName(s.coacheeId) }}</span>
                </div>
              }

            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .calendar-page { padding: 32px; }
    .back-link { display: flex; align-items: center; gap: 4px; color: #3A9FD6; text-decoration: none; font-size: 14px; }
    .month-nav { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .month-nav h2 { font-size: 20px; color: #1B2A47; margin: 0; min-width: 180px; text-align: center; }
    .today-btn { font-size: 12px; margin-left: 8px; }

    .legend { display: flex; gap: 16px; margin-bottom: 12px; font-size: 12px; color: #5a6a7e; }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; }
    .dot.completed { background: #27C4A0; }
    .dot.scheduled { background: #3A9FD6; }
    .dot.cancelled { background: #c5d0db; }

    .calendar-grid {
      display: grid; grid-template-columns: repeat(7, 1fr);
      border: 1px solid #e8edf4; border-radius: 12px; overflow: hidden;
      background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }

    .day-header {
      padding: 10px; text-align: center; font-size: 12px; font-weight: 600;
      color: #5a6a7e; background: #f8fafc; border-bottom: 1px solid #e8edf4;
    }

    .day-cell {
      min-height: 100px; padding: 6px; border-right: 1px solid #f0f4f8; border-bottom: 1px solid #f0f4f8;
      display: flex; flex-direction: column; gap: 3px;
      &:nth-child(7n) { border-right: none; }
      &.other-month { background: #fafbfc; .day-num { color: #c5d0db; } }
      &.today { background: #f0f9ff; .day-num { background: #3A9FD6; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; } }
    }

    .day-num { font-size: 12px; color: #5a6a7e; margin-bottom: 2px; }

    .event {
      font-size: 10px; padding: 2px 6px; border-radius: 4px; cursor: pointer;
      text-decoration: none; display: flex; flex-direction: column; gap: 1px;
      transition: opacity 0.15s;
      &:hover { opacity: 0.8; }
    }

    .session-event {
      &.completed { background: #e8faf4; color: #1a9678; border-left: 3px solid #27C4A0; }
      &.scheduled { background: #EBF5FB; color: #2080b0; border-left: 3px solid #3A9FD6; }
      &.cancelled { background: #f0f4f8; color: #9aa5b4; border-left: 3px solid #c5d0db; text-decoration: line-through; }
      &.no_show { background: #fef2f2; color: #c53030; border-left: 3px solid #e53e3e; }
    }

    .event-time { font-weight: 600; }
    .event-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    @media (max-width: 768px) {
      .calendar-grid { font-size: 10px; }
      .day-cell { min-height: 60px; padding: 3px; }
      .event { font-size: 9px; padding: 1px 4px; }
    }
  `],
})
export class CoachingCalendarComponent implements OnInit {
  loading = signal(true);
  currentMonth = signal(new Date());
  private sessions = signal<Session[]>([]);

  dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  monthLabel = computed(() => {
    const d = this.currentMonth();
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  calendarDays = computed<CalendarDay[]>(() => {
    const month = this.currentMonth();
    const year = month.getFullYear();
    const m = month.getMonth();
    const today = new Date();

    // First day of month and padding
    const firstDay = new Date(year, m, 1);
    const startPad = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(year, m + 1, 0).getDate();

    const days: CalendarDay[] = [];

    // Previous month padding
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, m, -i);
      days.push({ date: d, isCurrentMonth: false, isToday: false, sessions: [] });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, m, day);
      const isToday = d.toDateString() === today.toDateString();
      const daySessions = this.sessions().filter((s) => new Date(s.date).toDateString() === d.toDateString());
      days.push({ date: d, isCurrentMonth: true, isToday, sessions: daySessions });
    }

    // Next month padding to fill grid (6 rows)
    while (days.length < 42) {
      const d = new Date(year, m + 1, days.length - daysInMonth - startPad + 1);
      days.push({ date: d, isCurrentMonth: false, isToday: false, sessions: [] });
    }

    return days;
  });

  constructor(private api: ApiService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.get<Session[]>('/coaching/sessions').subscribe({
      next: (sessions) => { this.sessions.set(sessions); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  prevMonth(): void {
    const d = new Date(this.currentMonth());
    d.setMonth(d.getMonth() - 1);
    this.currentMonth.set(d);
  }

  nextMonth(): void {
    const d = new Date(this.currentMonth());
    d.setMonth(d.getMonth() + 1);
    this.currentMonth.set(d);
  }

  goToday(): void { this.currentMonth.set(new Date()); }

  coacheeName(c: Session['coacheeId']): string {
    return typeof c === 'object' && c ? `${c.firstName} ${c.lastName}` : 'Unknown';
  }

  sessionTooltip(s: Session): string {
    const name = this.coacheeName(s.coacheeId);
    const topics = s.topics?.length ? ` — ${s.topics.join(', ')}` : '';
    return `${name} · ${s.duration}min ${s.format} · ${s.status}${topics}`;
  }

}
