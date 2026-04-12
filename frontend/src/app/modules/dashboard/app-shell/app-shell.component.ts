import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../../core/auth.service';
import { ApiService } from '../../../core/api.service';
import { ThemeService, OrgTheme } from '../../../core/theme.service';
import { OrgContextService } from '../../../core/org-context.service';
import { MessageHubDialogComponent } from '../../hub/message-hub-dialog.component';

interface OrgInfo {
  name: string;
  theme?: OrgTheme;
  modules?: string[];
}

import { AppRole } from '../../../core/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: AppRole[];   // undefined = visible to all authenticated users
  module?: string;     // org subscription module required (e.g. 'conflict')
}

interface NavGroup {
  label: string;
  icon: string;
  module?: string;     // org subscription module required for the whole group
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
    MatBadgeModule,
  ],
  template: `
    <div class="app-layout" [class.collapsed]="sidebarCollapsed()">
      <!-- Mobile header bar -->
      <div class="mobile-header">
        <button class="mobile-menu-btn" (click)="mobileMenuOpen.set(true)">
          <mat-icon>menu</mat-icon>
        </button>
        <img src="assets/PIP_Icon_512.png" alt="PIP" class="mobile-logo" />
        <span class="mobile-title">{{ orgName() }}</span>
        <button class="mobile-bell-btn" (click)="openHub()">
          <mat-icon [matBadge]="unreadCount() > 0 ? unreadCount() : null" matBadgeColor="warn" matBadgeSize="small">notifications</mat-icon>
        </button>
      </div>

      <!-- Mobile overlay backdrop -->
      @if (mobileMenuOpen()) {
        <div class="mobile-backdrop" (click)="mobileMenuOpen.set(false)"></div>
      }

      <!-- Sidebar -->
      <aside class="sidebar" [class.mobile-open]="mobileMenuOpen()">
        <div class="sidebar-header" [class.collapsed]="sidebarCollapsed()">
          @if (sidebarCollapsed()) {
            <!-- Collapsed: logo centred, toggle below -->
            <img src="assets/artes_icon_512.png" alt="PIP" class="brand-logo" />
            <button class="expand-btn" (click)="sidebarCollapsed.set(false)" title="Expand sidebar">
              <mat-icon>chevron_right</mat-icon>
            </button>
          } @else {
            <!-- Expanded: logo + text left, toggle right -->
            <div class="brand">
              <img src="assets/artes_transparent_dark.png" alt="PIP" class="brand-logo-wide" />
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
          @for (entry of navEntries(); track isGroup(entry) ? entry.label : entry.route) {

            @if (!isGroup(entry)) {
              <!-- Plain nav item -->
              <a [routerLink]="entry.route"
                 routerLinkActive="active"
                 class="nav-item"
                 [matTooltip]="sidebarCollapsed() ? entry.label : ''"
                 matTooltipPosition="right"
                 (click)="mobileMenuOpen.set(false)">
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
          <div class="footer-row">
            <button mat-button [matMenuTriggerFor]="userMenu" class="user-btn">
              @if (userPicture()) {
                <img class="user-avatar user-avatar-img" [src]="userPicture()" alt="" />
              } @else {
                <div class="user-avatar">{{ userInitials() }}</div>
              }
              @if (!sidebarCollapsed()) {
                <div class="user-info">
                  <span class="user-name">{{ userName() }}</span>
                  <span class="user-role">{{ userRole() }}</span>
                </div>
              }
            </button>
            <button class="hub-btn"
                    (click)="openHub()"
                    [matTooltip]="sidebarCollapsed() ? 'Messages & Alerts' : ''"
                    matTooltipPosition="right">
              <mat-icon
                [class.bell-ringing]="unreadCount() > 0"
                [matBadge]="unreadCount() > 0 ? unreadCount() : null"
                matBadgeColor="warn"
                matBadgeSize="small">
                notifications
              </mat-icon>
            </button>
          </div>
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
        @if (inactivityWarning()) {
          <div class="inactivity-banner">
            <mat-icon>timer</mat-icon>
            <span>You've been inactive. You'll be logged out in 2 minutes.</span>
            <button (click)="authService.startActivityTracking()">Stay logged in</button>
          </div>
        }
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
      background: var(--artes-primary);
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

      /* Collapsed: stack logo + toggle vertically, fully centred */
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
        width: 64px; height: 64px;
        object-fit: contain;
        flex-shrink: 0;
      }

      .brand-logo-wide {
        width: 200px; height: 64px;
        object-fit: contain;
        flex-shrink: 0;
      }
      .auth-brand-footer {
        text-align: center;
        margin-top: 24px;
        h1 { font-size: 20px; color: #1B2A47; margin: 0 0 4px; }
        p  { font-size: 12px; color: #9aa5b4; margin: 0; }
      }
      .icon-logo {
        width: 16px; height: 16px; margin: -3px 2px;
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
      &.active { background: color-mix(in srgb, var(--artes-accent) 20%, transparent); color: var(--artes-accent); }
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
      border-left: 2px solid color-mix(in srgb, var(--artes-accent) 30%, transparent);
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

      .footer-row {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .user-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;
        padding: 8px;
        border-radius: 8px;
        color: white;
        text-align: left;
        &:hover { background: rgba(255,255,255,0.08); }
      }

      .hub-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        background: none;
        border: none;
        cursor: pointer;
        color: rgba(255,255,255,0.65);
        border-radius: 8px;
        padding: 0;
        &:hover { background: rgba(255,255,255,0.08); color: white; }
        mat-icon { font-size: 22px; width: 22px; height: 22px; line-height: 22px; }
      }

    @keyframes bell-ring {
      0%   { transform: rotate(0deg);    }
      5%   { transform: rotate(18deg);   }
      15%  { transform: rotate(-16deg);  }
      25%  { transform: rotate(14deg);   }
      35%  { transform: rotate(-10deg);  }
      45%  { transform: rotate(6deg);    }
      55%  { transform: rotate(-4deg);   }
      65%  { transform: rotate(2deg);    }
      75%  { transform: rotate(0deg);    }
      100% { transform: rotate(0deg);    }
    }

    .bell-ringing {
      display: inline-block;
      transform-origin: top center;
      animation: bell-ring 2.4s ease-in-out infinite;
      color: #f0c040 !important;
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
      .user-avatar-img {
        object-fit: cover;
        background: none;
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

    .inactivity-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f0a500;
      color: #1B2A47;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 500;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
      span { flex: 1; }
      button {
        background: #1B2A47;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 6px 14px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        &:hover { background: #2a3f66; }
      }
    }

    /* ── Mobile ───────────────────────────────────── */
    .mobile-header { display: none; }
    .mobile-backdrop { display: none; }

    @media (max-width: 768px) {
      .mobile-header {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 16px;
        background: var(--artes-primary);
        color: white;
        position: fixed; top: 0; left: 0; right: 0; z-index: 1001;
        height: 56px;
      }
      .mobile-menu-btn, .mobile-bell-btn {
        background: none; border: none; color: white; cursor: pointer;
        width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
        border-radius: 8px; padding: 0;
        &:hover { background: rgba(255,255,255,0.1); }
      }
      .mobile-logo { width: 32px; height: 32px; object-fit: contain; }
      .mobile-title { flex: 1; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .mobile-backdrop {
        display: block; position: fixed; inset: 0; z-index: 1002;
        background: rgba(0,0,0,0.5); animation: fadeIn 0.2s;
      }

      .sidebar {
        position: fixed; top: 0; bottom: 0; left: 0; z-index: 1003;
        width: 280px !important;
        transform: translateX(-100%);
        transition: transform 0.25s ease;
        &.mobile-open { transform: translateX(0); }
      }

      .app-layout.collapsed .sidebar { width: 280px !important; transform: translateX(-100%); }
      .app-layout.collapsed .sidebar.mobile-open { transform: translateX(0); }

      .main-content { padding-top: 56px; }

      .sidebar-header.collapsed { flex-direction: row !important; padding: 20px 16px 16px !important; }
      .sidebar-header.collapsed .expand-btn { display: none; }
      .sidebar-header.collapsed .brand-logo { width: 200px; height: 64px; }

      .nav-item span, .nav-label { display: inline !important; }
      .org-switcher { display: flex !important; }
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `],
})
export class AppShellComponent implements OnInit, OnDestroy {
  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  openGroups = signal<Set<string>>(new Set());

  isGroup = isGroup;

  private readonly ALL_NAV: NavEntry[] = [
    { label: 'Dashboard',               icon: 'dashboard',    route: '/dashboard', roles: ['admin', 'hr_manager', 'manager', 'coach'] as AppRole[] },
    {
      label: 'Conflict Intelligence',
      icon: 'warning_amber',
      module: 'conflict',
      children: [
        { label: 'Analysis',           icon: 'analytics',   route: '/conflict/analysis',           roles: ['admin', 'hr_manager', 'manager'] as AppRole[], module: 'conflict' },
        { label: 'Conflict IDPs',      icon: 'psychology',  route: '/conflict/skill-development',  roles: ['admin', 'hr_manager', 'manager'] as AppRole[], module: 'conflict' },
        { label: 'Knowledge Building', icon: 'school',      route: '/conflict/skill-building',     roles: ['admin', 'hr_manager', 'manager'] as AppRole[], module: 'conflict' },
      ],
    },
    { label: 'Neuro-Inclusion',         icon: 'psychology',   route: '/neuroinclusion', roles: ['admin', 'hr_manager', 'manager'],               module: 'neuroinclusion' },
    { label: 'Leadership & Succession', icon: 'trending_up',  route: '/succession',  roles: ['admin', 'hr_manager', 'coach', 'coachee'],        module: 'succession' },
    { label: 'Coaching',           icon: 'psychology_alt',  route: '/coaching',    roles: ['admin', 'hr_manager', 'coach', 'coachee'],  module: 'coaching' },
    { label: 'Booking',            icon: 'event_available', route: '/booking',     roles: ['admin', 'hr_manager', 'coach'],              module: 'coaching' },
    {
      label: 'Intakes',
      icon: 'record_voice_over',
      children: [
        { label: 'Conduct Interview', icon: 'mic',        route: '/coach/interview', roles: ['coach'] as AppRole[] },
        { label: 'Intake Management',  icon: 'assignment', route: '/intakes',         roles: ['coach'] as AppRole[] },
      ],
    },
    {
      label: 'Administration',
      icon: 'admin_panel_settings',
      children: [
        { label: 'Intake Management', icon: 'assignment',           route: '/intakes',              roles: ['admin', 'hr_manager'] },
        { label: 'Users',             icon: 'group',               route: '/admin/users',          roles: ['admin', 'hr_manager'] },
        { label: 'Organization',      icon: 'business',            route: '/admin/organization',   roles: ['admin'] },
        { label: 'Org Chart',         icon: 'account_tree',        route: '/org-chart',            roles: ['admin', 'hr_manager'] },
        { label: 'Role Permissions',  icon: 'policy',              route: '/admin/roles',          roles: ['admin', 'hr_manager'] },
        { label: 'EQi Assessments',    icon: 'psychology',          route: '/eq-import/records',    roles: ['admin'] },
        { label: 'Reports',           icon: 'assessment',          route: '/admin/reports',        roles: ['admin', 'hr_manager'] },
        { label: 'Billing',           icon: 'receipt_long',        route: '/billing',              roles: ['admin'] },
      ],
    },
  ];

  navEntries = computed<NavEntry[]>(() => {
    const role = this.authService.currentUser()?.role as AppRole | undefined;
    if (!role) return [];
    const modules = this.orgCtx.modules();

    const isItemVisible = (item: NavItem): boolean => {
      if (item.roles && !item.roles.includes(role)) return false;
      if (item.module && !modules.includes(item.module)) return false;
      return true;
    };

    return this.ALL_NAV.reduce<NavEntry[]>((acc, entry) => {
      if (isGroup(entry)) {
        if (entry.module && !modules.includes(entry.module)) return acc;
        const visibleChildren = entry.children.filter(isItemVisible);
        if (visibleChildren.length) {
          acc.push({ ...entry, children: visibleChildren });
        }
      } else {
        if (isItemVisible(entry)) {
          acc.push(entry);
        }
      }
      return acc;
    }, []);
  });

  user        = computed(() => this.authService.currentUser());
  userName    = computed(() => { const u = this.user(); return u ? `${u.firstName} ${u.lastName}` : ''; });
  userInitials= computed(() => { const u = this.user(); return u ? `${u.firstName[0]}${u.lastName[0]}`.toUpperCase() : '??'; });
  userPicture = computed(() => this.user()?.profilePicture || '');
  userRole    = computed(() => this.user()?.role?.replace('_', ' ') || '');
  orgName     = signal('My Organization');
  unreadCount = signal(0);

  constructor(
    public authService: AuthService,
    private router: Router,
    private api: ApiService,
    private themeService: ThemeService,
    private dialog: MatDialog,
    private orgCtx: OrgContextService,
  ) {}

  inactivityWarning = computed(() => this.authService.inactivityWarning());

  ngOnInit(): void {
    // Coachees land on coaching (not dashboard)
    if (this.authService.currentUser()?.role === 'coachee' && this.router.url === '/dashboard') {
      this.router.navigate(['/coaching'], { replaceUrl: true });
    }

    this.orgCtx.load();
    this.api.get<OrgInfo>('/organizations/me').subscribe({
      next: (org) => {
        this.orgName.set(org.name);
        this.themeService.apply(org.theme);
      },
      error: () => {},
    });
    this.loadUnreadCount();
    this.authService.startActivityTracking();
    this.authService.scheduleTokenRefresh();
  }

  ngOnDestroy(): void {
    this.authService.stopActivityTracking();
  }

  loadUnreadCount(): void {
    this.api.get<{ total: number }>('/hub/unread-count').subscribe({
      next: (r) => this.unreadCount.set(r.total),
      error: () => {},
    });
  }

  openHub(): void {
    const ref = this.dialog.open(MessageHubDialogComponent, {
      width: '640px',
      height: '80vh',
      panelClass: 'hub-dialog',
    });
    ref.afterClosed().subscribe((hadUnread: boolean) => {
      if (hadUnread) this.loadUnreadCount();
    });
  }

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
