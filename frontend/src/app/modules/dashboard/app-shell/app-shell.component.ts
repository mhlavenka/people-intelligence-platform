import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: string;
}

@Component({
  selector: 'app-shell',
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
  ],
  template: `
    <div class="app-layout" [class.collapsed]="sidebarCollapsed()">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="brand">
            <img src="assets/headsoft-logo.png" alt="HeadSoft" class="brand-logo" />
            @if (!sidebarCollapsed()) {
              <div class="brand-text">
                <span class="brand-name">People Intelligence</span>
                <span class="brand-sub">HeadSoft × Helena</span>
              </div>
            }
          </div>
          <button mat-icon-button class="collapse-btn" (click)="sidebarCollapsed.set(!sidebarCollapsed())">
            <mat-icon>{{ sidebarCollapsed() ? 'chevron_right' : 'chevron_left' }}</mat-icon>
          </button>
        </div>

        <!-- Org switcher -->
        @if (!sidebarCollapsed()) {
          <div class="org-switcher">
            <mat-icon>business</mat-icon>
            <span class="org-name">{{ orgName() }}</span>
            <mat-icon class="plan-badge">star</mat-icon>
          </div>
        }

        <!-- Navigation -->
        <nav class="nav-list">
          @for (item of navItems; track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="active"
              class="nav-item"
              [matTooltip]="sidebarCollapsed() ? item.label : ''"
              matTooltipPosition="right"
            >
              <mat-icon>{{ item.icon }}</mat-icon>
              @if (!sidebarCollapsed()) {
                <span class="nav-label">{{ item.label }}</span>
              }
            </a>
          }
        </nav>

        <!-- User menu -->
        <div class="sidebar-footer">
          <button mat-button [matMenuTriggerFor]="userMenu" class="user-btn">
            <div class="user-avatar">{{ userInitials() }}</div>
            @if (!sidebarCollapsed()) {
              <div class="user-info">
                <span class="user-name">{{ userName() }}</span>
                <span class="user-role">{{ userRole() }}</span>
              </div>
            }
          </button>
          <mat-menu #userMenu="matMenu">
            <button mat-menu-item routerLink="/profile">
              <mat-icon>person</mat-icon> Profile
            </button>
            <button mat-menu-item routerLink="/settings">
              <mat-icon>settings</mat-icon> Settings
            </button>
            <mat-divider />
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon> Sign out
            </button>
          </mat-menu>
        </div>
      </aside>

      <!-- Main content -->
      <main class="main-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    .sidebar {
      width: 260px;
      background: #1B2A47;
      color: white;
      display: flex;
      flex-direction: column;
      transition: width 0.2s ease;
      flex-shrink: 0;
      overflow: hidden;
    }

    .app-layout.collapsed .sidebar { width: 72px; }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 16px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        overflow: hidden;
      }

      .brand-logo {
        width: 36px;
        height: 36px;
        object-fit: contain;
        flex-shrink: 0;
      }

      .brand-text {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        .brand-name { font-size: 13px; font-weight: 600; white-space: nowrap; }
        .brand-sub  { font-size: 10px; color: rgba(255,255,255,0.5); white-space: nowrap; }
      }

      .collapse-btn { color: rgba(255,255,255,0.5); width: 28px; height: 28px; }
    }

    .org-switcher {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(255,255,255,0.05);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      font-size: 13px;
      mat-icon { font-size: 18px; color: #3A9FD6; }
      .org-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .plan-badge { font-size: 16px; color: #f0a500; }
    }

    .nav-list {
      flex: 1;
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow-y: auto;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 10px;
      border-radius: 8px;
      color: rgba(255,255,255,0.65);
      text-decoration: none;
      font-size: 14px;
      transition: all 0.15s;

      mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
      .nav-label { white-space: nowrap; }

      &:hover { background: rgba(255,255,255,0.08); color: white; }
      &.active { background: rgba(58, 159, 214, 0.2); color: #3A9FD6; }
    }

    .sidebar-footer {
      padding: 12px 8px;
      border-top: 1px solid rgba(255,255,255,0.08);

      .user-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 8px;
        border-radius: 8px;
        color: white;
        text-align: left;
        &:hover { background: rgba(255,255,255,0.08); }
      }

      .user-avatar {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #3A9FD6, #27C4A0);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        flex-shrink: 0;
      }

      .user-info {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        .user-name { font-size: 13px; font-weight: 500; white-space: nowrap; }
        .user-role { font-size: 11px; color: rgba(255,255,255,0.5); text-transform: capitalize; }
      }
    }

    .main-content {
      flex: 1;
      overflow-y: auto;
      background: #EBF5FB;
    }
  `],
})
export class AppShellComponent {
  sidebarCollapsed = signal(false);

  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Conflict Intelligence', icon: 'warning_amber', route: '/conflict' },
    { label: 'Neuro-Inclusion', icon: 'psychology', route: '/neuroinclusion' },
    { label: 'Leadership & Succession', icon: 'trending_up', route: '/succession' },
    { label: 'Survey Management', icon: 'assignment', route: '/surveys' },
  ];

  user = computed(() => this.authService.currentUser());
  userName = computed(() => {
    const u = this.user();
    return u ? `${u.firstName} ${u.lastName}` : '';
  });
  userInitials = computed(() => {
    const u = this.user();
    return u ? `${u.firstName[0]}${u.lastName[0]}`.toUpperCase() : '??';
  });
  userRole = computed(() => this.user()?.role?.replace('_', ' ') || '');
  orgName = computed(() => 'My Organization'); // TODO: load from OrgService

  constructor(private authService: AuthService) {}

  logout(): void {
    this.authService.logout();
  }
}
