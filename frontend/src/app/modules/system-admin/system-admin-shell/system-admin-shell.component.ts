import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/auth.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-system-admin-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    TranslateModule,
  ],
  template: `
    <div class="sa-layout" [class.collapsed]="collapsed()">

      <!-- Sidebar -->
      <aside class="sa-sidebar">
        <div class="sa-header" [class.collapsed]="collapsed()">
          @if (collapsed()) {
            <img src="assets/artes_icon_512.png" alt="PIP" class="brand-logo" />
            <button class="expand-btn" (click)="collapsed.set(false)" title="Expand">
              <mat-icon>chevron_right</mat-icon>
            </button>
          } @else {
            <div class="brand">
              <img src="assets/artes_v2_transparent_dark.png" alt="PIP" class="brand-logo-wide" />
              <div class="brand-text">
                <span class="brand-name">HeadSoft</span>
                <span class="brand-sub">{{ "SYSADMIN.systemAdmin" | translate }}</span>
              </div>
            </div>
            <button mat-icon-button class="collapse-btn" (click)="collapsed.set(true)">
              <mat-icon>chevron_left</mat-icon>
            </button>
          }
        </div>

        <nav class="sa-nav">
          <a routerLink="/system-admin/organizations" routerLinkActive="active"
             class="nav-item"
             [matTooltip]="collapsed() ? ('SYSADMIN.navOrganizations' | translate) : ''"
             matTooltipPosition="right">
            <mat-icon>business</mat-icon>
            @if (!collapsed()) { <span>{{ "SYSADMIN.navOrganizations" | translate }}</span> }
          </a>
          <a routerLink="/system-admin/invoices" routerLinkActive="active"
             class="nav-item"
             [matTooltip]="collapsed() ? ('SYSADMIN.navInvoices' | translate) : ''"
             matTooltipPosition="right">
            <mat-icon>receipt_long</mat-icon>
            @if (!collapsed()) { <span>{{ "SYSADMIN.navInvoices" | translate }}</span> }
          </a>
          <a routerLink="/system-admin/plans" routerLinkActive="active"
             class="nav-item"
             [matTooltip]="collapsed() ? ('SYSADMIN.navPlans' | translate) : ''"
             matTooltipPosition="right">
            <mat-icon>sell</mat-icon>
            @if (!collapsed()) { <span>{{ "SYSADMIN.navPlans" | translate }}</span> }
          </a>
          <a routerLink="/system-admin/assessment-hub" routerLinkActive="active"
             class="nav-item"
             [matTooltip]="collapsed() ? ('SYSADMIN.navAssessmentHub' | translate) : ''"
             matTooltipPosition="right">
            <mat-icon>quiz</mat-icon>
            @if (!collapsed()) { <span>{{ "SYSADMIN.navAssessmentHub" | translate }}</span> }
          </a>
          <a routerLink="/system-admin/reports" routerLinkActive="active"
             class="nav-item"
             [matTooltip]="collapsed() ? ('SYSADMIN.navReports' | translate) : ''"
             matTooltipPosition="right">
            <mat-icon>assessment</mat-icon>
            @if (!collapsed()) { <span>{{ "SYSADMIN.navReports" | translate }}</span> }
          </a>
          <a routerLink="/system-admin/settings" routerLinkActive="active"
             class="nav-item"
             [matTooltip]="collapsed() ? ('SYSADMIN.navSettings' | translate) : ''"
             matTooltipPosition="right">
            <mat-icon>settings</mat-icon>
            @if (!collapsed()) { <span>{{ "SYSADMIN.navSettings" | translate }}</span> }
          </a>
        </nav>

        <!-- User menu -->
        <div class="sa-footer">
          <button mat-button [matMenuTriggerFor]="userMenu" class="user-btn">
            <div class="user-avatar">{{ initials() }}</div>
            @if (!collapsed()) {
              <div class="user-info">
                <span class="user-name">{{ name() }}</span>
                <span class="user-role">{{ "SYSADMIN.systemAdmin" | translate }}</span>
              </div>
            }
          </button>
          <mat-menu #userMenu="matMenu">
            <button mat-menu-item routerLink="/system-admin/profile">
              <mat-icon>person</mat-icon> {{ "SYSADMIN.profile" | translate }}
            </button>
            <mat-divider />
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon> {{ "SYSADMIN.signOut" | translate }}
            </button>
          </mat-menu>
        </div>
      </aside>

      <!-- Main content -->
      <main class="sa-main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .sa-layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    .sa-sidebar {
      width: 240px;
      background: #0f1923;
      color: white;
      display: flex;
      flex-direction: column;
      transition: width 0.2s ease;
      flex-shrink: 0;
      overflow: hidden;
    }

    .sa-layout.collapsed .sa-sidebar { width: 64px; }

    .sa-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 16px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;

      &.collapsed {
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 14px 0;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        overflow: hidden;
      }

      .brand-logo {
        width: 64px; height: 64px;
        object-fit: contain;
        flex-shrink: 0;
      }

      .brand-logo-wide {
        width: 200px; height: 64px;
        object-fit: contain;
        flex-shrink: 0;
      }

      .brand-text {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        .brand-name { font-size: 13px; font-weight: 700; white-space: nowrap; }
        .brand-sub  { font-size: 10px; color: rgba(255,255,255,0.45); white-space: nowrap; }
      }

      .collapse-btn { color: rgba(255,255,255,0.4); width: 28px; height: 28px; }

      .expand-btn {
        display: flex; align-items: center; justify-content: center;
        width: 28px; height: 28px;
        background: none; border: none; cursor: pointer;
        color: rgba(255,255,255,0.4); padding: 0;
        border-radius: 6px;
        &:hover { color: white; background: rgba(255,255,255,0.1); }
        mat-icon { font-size: 20px; width: 20px; height: 20px; line-height: 20px; }
      }
    }

    .sa-nav {
      flex: 1;
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      border-radius: 8px;
      color: rgba(255,255,255,0.6);
      text-decoration: none;
      font-size: 14px;
      transition: all 0.15s;

      mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
      span { white-space: nowrap; }

      &:hover { background: rgba(255,255,255,0.07); color: white; }
      &.active { background: rgba(99,179,237,0.15); color: #63b3ed; }
    }

    .sa-footer {
      padding: 12px 8px;
      border-top: 1px solid rgba(255,255,255,0.08);

      .user-btn {
        display: flex; align-items: center; gap: 10px;
        width: 100%; padding: 8px; border-radius: 8px;
        color: white; text-align: left;
        &:hover { background: rgba(255,255,255,0.07); }
      }

      .user-avatar {
        width: 32px; height: 32px;
        background: linear-gradient(135deg, #e86c3a, #c04a14);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 700; flex-shrink: 0;
      }

      .user-info {
        display: flex; flex-direction: column; overflow: hidden;
        .user-name { font-size: 13px; font-weight: 500; white-space: nowrap; }
        .user-role { font-size: 11px; color: #e86c3a; text-transform: uppercase; letter-spacing: 0.5px; }
      }
    }

    .sa-main {
      flex: 1;
      overflow-y: auto;
      background: #f0f4f8;
    }
  `],
})
export class SystemAdminShellComponent {
  collapsed = signal(false);

  private user = computed(() => this.authService.currentUser());
  name     = computed(() => { const u = this.user(); return u ? `${u.firstName} ${u.lastName}` : ''; });
  initials = computed(() => { const u = this.user(); return u ? `${u.firstName[0]}${u.lastName[0]}`.toUpperCase() : 'SA'; });

  constructor(private authService: AuthService, private router: Router) {}

  logout(): void {
    this.authService.logout();
  }
}
