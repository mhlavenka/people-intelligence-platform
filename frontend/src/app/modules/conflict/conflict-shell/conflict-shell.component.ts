import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-conflict-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule,
    TranslateModule,
  ],
  template: `
    <div class="conflict-shell">
      <div class="page-header">
        <div>
          <h1>{{ "CONFLICT.title" | translate }}</h1>
          <p>Proactive workplace conflict detection and resolution grounded in Helena's coaching-integrated mediation methodology</p>
        </div>
      </div>

      <router-outlet />
    </div>
  `,
  styles: [`
    .conflict-shell { padding: 32px; }

    .conflict-nav {
      display: flex; gap: 4px;
      margin-bottom: 28px;
      border-bottom: 2px solid #edf2f7;
      padding-bottom: 0;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .nav-tab {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 20px;
      font-size: 14px; font-weight: 500;
      white-space: nowrap;
      color: #5a6a7e;
      text-decoration: none;
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
      transition: color 0.15s, border-color 0.15s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }

      &:hover { color: var(--artes-primary); }

      &.active {
        color: #e86c3a;
        border-bottom-color: #e86c3a;
        font-weight: 600;
      }
    }

    @media (max-width: 768px) {
      .conflict-shell { padding: 16px; }
      .nav-tab { padding: 10px 14px; font-size: 13px; }
      .nav-tab mat-icon { display: none; }
    }
  `],
})
export class ConflictShellComponent {}
