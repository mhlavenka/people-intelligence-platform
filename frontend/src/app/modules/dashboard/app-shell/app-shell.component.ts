import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
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
}

interface NavGroup {
  label: string;
  icon: string;
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
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
        <div class="sidebar-header" [class.collapsed]="sidebarCollapsed()">
          @if (sidebarCollapsed()) {
            <!-- Collapsed: logo centred, toggle below -->
            <img src="assets/headsoft-logo.png" alt="HeadSoft" class="brand-logo" />
            <button class="expand-btn" (click)="sidebarCollapsed.set(false)" title="Expand sidebar">
              <mat-icon>chevron_right</mat-icon>
            </button>
          } @else {
            <!-- Expanded: logo + text left, toggle right -->
            <div class="brand">
              <img src="assets/headsoft-logo.png" alt="HeadSoft" class="brand-logo" />
              <div class="brand-text">
                <span class="brand-name">People Intelligence</span>
                <span class="brand-sub">HeadSoft × Helena</span>
              </div>
            </div>
            <button mat-icon-button class="collapse-btn" (click)="sidebarCollapsed.set(true)">
              <mat-icon>chevron_left</mat-icon>
            </button>
          }
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
          @for (entry of navEntries; track isGroup(entry) ? entry.label : entry.route) {

            @if (!isGroup(entry)) {
              <!-- Plain nav item -->
              <a [routerLink]="entry.route"
                 routerLinkActive="active"
                 class="nav-item"
                 [matTooltip]="sidebarCollapsed() ? entry.label : ''"
                 matTooltipPosition="right">
                <mat-icon>{{ entry.icon }}</mat-icon>
                @if (!sidebarCollapsed()) {
                  <span class="nav-label">{{ entry.label }}</span>
                }
              </a>

            } @else {
              <!-- Group with submenu -->
              @if (sidebarCollapsed()) {
                <!-- Collapsed: show icon with Mat menu flyout -->
                <button class="nav-item group-trigger"
                        [matMenuTriggerFor]="flyout"
                        [matTooltip]="entry.label"
                        matTooltipPosition="right"
                        [class.group-active]="isGroupActive(entry)">
                  <mat-icon>{{ entry.icon }}</mat-icon>
                </button>
                <mat-menu #flyout="matMenu" xPosition="after">
                  @for (child of entry.children; track child.route) {
                    <button mat-menu-item [routerLink]="child.route">
                      <mat-icon>{{ child.icon }}</mat-icon>
                      {{ child.label }}
                    </button>
                  }
                </mat-menu>

              } @else {
                <!-- Expanded: collapsible inline submenu -->
                <button class="nav-item group-header"
                        (click)="toggleGroup(entry.label)"
                        [class.group-active]="isGroupActive(entry)">
                  <mat-icon>{{ entry.icon }}</mat-icon>
                  <span class="nav-label">{{ entry.label }}</span>
                  <mat-icon class="chevron" [class.open]="isGroupOpen(entry.label)">
                    chevron_right
                  </mat-icon>
                </button>

                @if (isGroupOpen(entry.label)) {
                  <div class="submenu">
                    @for (child of entry.children; track child.route) {
                      <a [routerLink]="child.route"
                         routerLinkActive="active"
                         class="nav-item sub-item">
                        <mat-icon>{{ child.icon }}</mat-icon>
                        <span class="nav-label">{{ child.label }}</span>
                      </a>
                    }
                  </div>
                }
              }
            }
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
      flex-shrink: 0;

      // Collapsed: stack logo + toggle vertically, fully centred
      &.collapsed {
        flex-direction: column;
        align-items: center;
        justify-content: center;
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

      .expand-btn {
        display: flex; align-items: center; justify-content: center;
        width: 28px; height: 28px;
        background: none; border: none; cursor: pointer;
        color: rgba(255,255,255,0.5); padding: 0;
        border-radius: 6px;
        &:hover { color: white; background: rgba(255,255,255,0.1); }
        mat-icon { font-size: 20px; width: 20px; height: 20px; line-height: 20px; }
      }
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
      padding: 10px;
      border-radius: 8px;
      color: rgba(255,255,255,0.65);
      text-decoration: none;
      font-size: 14px;
      transition: all 0.15s;
      border: none;
      background: none;
      cursor: pointer;
      width: 100%;
      text-align: left;

      mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
      .nav-label { white-space: nowrap; flex: 1; }

      &:hover { background: rgba(255,255,255,0.08); color: white; }
      &.active { background: rgba(58,159,214,0.2); color: #3A9FD6; }
    }

    .group-header {
      .chevron {
        font-size: 16px; width: 16px; height: 16px;
        transition: transform 0.2s ease;
        color: rgba(255,255,255,0.3);
        &.open { transform: rotate(90deg); }
      }
    }

    .group-active { color: rgba(255,255,255,0.9) !important; }

    .group-trigger { justify-content: center; }

    .submenu {
      display: flex;
      flex-direction: column;
      gap: 1px;
      margin-left: 12px;
      padding-left: 8px;
      border-left: 2px solid rgba(58,159,214,0.3);
      margin-bottom: 4px;
    }

    .sub-item {
      font-size: 13px;
      padding: 8px 10px;
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
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
  openGroups = signal<Set<string>>(new Set(['Maintenance']));

  isGroup = isGroup;

  navEntries: NavEntry[] = [
    { label: 'Dashboard',              icon: 'dashboard',    route: '/dashboard' },
    { label: 'Conflict Intelligence',  icon: 'warning_amber',route: '/conflict' },
    { label: 'Neuro-Inclusion',        icon: 'psychology',   route: '/neuroinclusion' },
    { label: 'Leadership & Succession',icon: 'trending_up',  route: '/succession' },
    {
      label: 'Maintenance',
      icon: 'build',
      children: [
        { label: 'Survey Management', icon: 'assignment',         route: '/surveys' },
        { label: 'Users',             icon: 'group',              route: '/admin/users' },
        { label: 'Organization',      icon: 'business',           route: '/admin/organization' },
        { label: 'Role Permissions',  icon: 'admin_panel_settings',route: '/admin/roles' },
      ],
    },
  ];

  user        = computed(() => this.authService.currentUser());
  userName    = computed(() => { const u = this.user(); return u ? `${u.firstName} ${u.lastName}` : ''; });
  userInitials= computed(() => { const u = this.user(); return u ? `${u.firstName[0]}${u.lastName[0]}`.toUpperCase() : '??'; });
  userRole    = computed(() => this.user()?.role?.replace('_', ' ') || '');
  orgName     = computed(() => 'My Organization');

  constructor(private authService: AuthService, private router: Router) {}

  toggleGroup(label: string): void {
    this.openGroups.update((set) => {
      const next = new Set(set);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  isGroupOpen(label: string): boolean {
    return this.openGroups().has(label);
  }

  isGroupActive(group: NavGroup): boolean {
    return group.children.some((c) => this.router.isActive(c.route, {
      paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored',
    }));
  }

  logout(): void {
    this.authService.logout();
  }
}
