import { Injectable, NgZone, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ThemeService } from './theme.service';

export type AppRole = 'admin' | 'hr_manager' | 'manager' | 'coachee' | 'coach' | 'system_admin';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AppRole;
  organizationId: string;
  permissions?: string[];
  customRoleId?: string;
  customRoleName?: string;
  profilePicture?: string;
  isCoachee?: boolean;
  canChooseCoach?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginResponse {
  // Full auth (no 2FA)
  accessToken?: string;
  refreshToken?: string;
  user?: User;
  // 2FA required
  requiresTwoFactor?: boolean;
  tempToken?: string;
}

const INACTIVITY_MS = 30 * 60 * 1000;       // 30 minutes
const WARN_BEFORE_MS = 2 * 60 * 1000;        // warn 2 minutes before logout
// Scroll + touchmove don't bubble from inner containers, so listeners are
// registered with { capture: true } to pick them up in the capture phase.
const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown', 'touchstart', 'touchmove', 'wheel', 'scroll',
];
const ACTIVITY_THROTTLE_MS = 1_000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'pip_access_token';
  private readonly REFRESH_KEY = 'pip_refresh_token';
  private readonly USER_KEY = 'pip_user';

  currentUser = signal<User | null>(this.loadUser());
  inactivityWarning = signal(false);   // true → show "logging out soon" notice

  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private warnTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private boundLocalActivity!: () => void;
  private boundStorage!: (ev: StorageEvent) => void;
  private boundVisibility!: () => void;
  private lastActivityWrite = 0;
  private readonly ACTIVITY_KEY = 'pip_last_activity';

  constructor(
    private http: HttpClient,
    private router: Router,
    private themeService: ThemeService,
    private ngZone: NgZone,
  ) {}

  startActivityTracking(): void {
    this.boundLocalActivity = () => this.onLocalActivity();
    // capture: true so scroll/wheel/touchmove on inner scrollable containers
    // (which don't bubble) still register as activity.
    ACTIVITY_EVENTS.forEach((e) =>
      document.addEventListener(e, this.boundLocalActivity, { passive: true, capture: true }),
    );

    // Cross-tab activity sync: any tab's activity resets every tab's timer,
    // so a background tab can't log the user out while they work in another.
    this.boundStorage = (ev: StorageEvent) => {
      if (ev.key === this.ACTIVITY_KEY) this.armInactivityTimer();
    };
    window.addEventListener('storage', this.boundStorage);

    // Pause the local timer while the tab is hidden; re-arm on visible.
    this.boundVisibility = () => {
      if (document.hidden) this.clearTimers();
      else this.armInactivityTimer();
    };
    document.addEventListener('visibilitychange', this.boundVisibility);

    this.onLocalActivity();
  }

  stopActivityTracking(): void {
    if (this.boundLocalActivity) {
      ACTIVITY_EVENTS.forEach((e) =>
        document.removeEventListener(e, this.boundLocalActivity, { capture: true } as EventListenerOptions),
      );
    }
    if (this.boundStorage)    window.removeEventListener('storage', this.boundStorage);
    if (this.boundVisibility) document.removeEventListener('visibilitychange', this.boundVisibility);
    this.clearTimers();
  }

  /** Local activity: throttle writes, then re-arm based on shared timestamp. */
  private onLocalActivity(): void {
    const now = Date.now();
    if (now - this.lastActivityWrite >= ACTIVITY_THROTTLE_MS) {
      this.lastActivityWrite = now;
      localStorage.setItem(this.ACTIVITY_KEY, String(now));
    }
    this.armInactivityTimer();
  }

  /** Arm the warn + logout timers based on the shared last-activity timestamp.
   *  Skipped while the tab is hidden — visibilitychange will re-arm. */
  private armInactivityTimer(): void {
    this.clearTimers();
    this.inactivityWarning.set(false);
    if (document.hidden) return;

    const last = Number(localStorage.getItem(this.ACTIVITY_KEY)) || Date.now();
    const elapsed = Date.now() - last;
    const remaining = INACTIVITY_MS - elapsed;
    if (remaining <= 0) { this.logout(); return; }

    const untilWarn = Math.max(remaining - WARN_BEFORE_MS, 0);
    this.ngZone.runOutsideAngular(() => {
      if (untilWarn > 0) {
        this.warnTimer = setTimeout(() => {
          this.ngZone.run(() => this.inactivityWarning.set(true));
        }, untilWarn);
      } else {
        this.ngZone.run(() => this.inactivityWarning.set(true));
      }
      this.inactivityTimer = setTimeout(() => {
        this.ngZone.run(() => this.logout());
      }, remaining);
    });
  }

  private clearTimers(): void {
    if (this.inactivityTimer) { clearTimeout(this.inactivityTimer); this.inactivityTimer = null; }
    if (this.warnTimer)       { clearTimeout(this.warnTimer);       this.warnTimer = null; }
  }

  /** Schedule a silent token refresh ~60 s before the access token expires. */
  scheduleTokenRefresh(): void {
    if (this.refreshTimer) { clearTimeout(this.refreshTimer); this.refreshTimer = null; }

    const token = this.getToken();
    if (!token) return;

    // Decode JWT payload (base64url) to read the `exp` claim
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!payload.exp) return;

      const expiresInMs = payload.exp * 1000 - Date.now();
      const refreshInMs = Math.max(expiresInMs - 60_000, 0); // 60 s before expiry

      this.ngZone.runOutsideAngular(() => {
        this.refreshTimer = setTimeout(() => {
          this.ngZone.run(() => {
            this.refreshToken().subscribe({
              next: () => this.scheduleTokenRefresh(),   // chain next refresh
              error: () => {},                           // silent — interceptor handles 401 fallback
            });
          });
        }, refreshInMs);
      });
    } catch {
      // Malformed token — leave refresh to the interceptor
    }
  }

  register(data: {
    orgName: string;
    orgSlug: string;
    billingEmail: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, data).pipe(
      tap((res) => this.storeAuth(res))
    );
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((res) => { if (res.accessToken) this.storeAuth(res as AuthResponse); }));
  }

  verify2fa(tempToken: string, otp: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/verify-2fa`, { tempToken, otp })
      .pipe(tap((res) => this.storeAuth(res)));
  }

  refreshToken(): Observable<{ accessToken: string; refreshToken: string }> {
    const refreshToken = localStorage.getItem(this.REFRESH_KEY);
    return this.http
      .post<{ accessToken: string; refreshToken: string }>(
        `${environment.apiUrl}/auth/refresh`,
        { refreshToken }
      )
      .pipe(
        tap((res) => {
          localStorage.setItem(this.TOKEN_KEY, res.accessToken);
          localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
          this.scheduleTokenRefresh();
        })
      );
  }

  logout(): void {
    this.stopActivityTracking();
    if (this.refreshTimer) { clearTimeout(this.refreshTimer); this.refreshTimer = null; }
    this.inactivityWarning.set(false);
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.ACTIVITY_KEY);
    this.currentUser.set(null);
    this.themeService.reset();
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private storeAuth(res: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.accessToken);
    localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
    this.currentUser.set(res.user);
    this.scheduleTokenRefresh();
  }

  /** Handle response from OAuth callback — stores tokens and user. */
  handleOAuthResponse(res: AuthResponse): void {
    this.storeAuth(res);
  }

  private loadUser(): User | null {
    const stored = localStorage.getItem(this.USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }
}
