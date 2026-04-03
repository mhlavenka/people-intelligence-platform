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
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'pip_access_token';
  private readonly REFRESH_KEY = 'pip_refresh_token';
  private readonly USER_KEY = 'pip_user';

  currentUser = signal<User | null>(this.loadUser());
  inactivityWarning = signal(false);   // true → show "logging out soon" notice

  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private warnTimer: ReturnType<typeof setTimeout> | null = null;
  private boundReset!: () => void;

  constructor(
    private http: HttpClient,
    private router: Router,
    private themeService: ThemeService,
    private ngZone: NgZone,
  ) {}

  startActivityTracking(): void {
    this.boundReset = () => this.resetInactivityTimer();
    ACTIVITY_EVENTS.forEach((e) => document.addEventListener(e, this.boundReset, { passive: true }));
    this.resetInactivityTimer();
  }

  stopActivityTracking(): void {
    if (this.boundReset) {
      ACTIVITY_EVENTS.forEach((e) => document.removeEventListener(e, this.boundReset));
    }
    this.clearTimers();
  }

  private resetInactivityTimer(): void {
    this.clearTimers();
    this.inactivityWarning.set(false);
    this.ngZone.runOutsideAngular(() => {
      this.warnTimer = setTimeout(() => {
        this.ngZone.run(() => this.inactivityWarning.set(true));
      }, INACTIVITY_MS - WARN_BEFORE_MS);

      this.inactivityTimer = setTimeout(() => {
        this.ngZone.run(() => this.logout());
      }, INACTIVITY_MS);
    });
  }

  private clearTimers(): void {
    if (this.inactivityTimer) { clearTimeout(this.inactivityTimer); this.inactivityTimer = null; }
    if (this.warnTimer)       { clearTimeout(this.warnTimer);       this.warnTimer = null; }
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
        })
      );
  }

  logout(): void {
    this.stopActivityTracking();
    this.inactivityWarning.set(false);
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.USER_KEY);
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
  }

  private loadUser(): User | null {
    const stored = localStorage.getItem(this.USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }
}
