import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, from, switchMap, tap, catchError, of } from 'rxjs';
import { ApiService } from './api.service';
import { BiometricService } from './biometric.service';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  profilePicture?: string;
  isCoachee?: boolean;
  preferredLanguage?: string;
}

export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: User;
  requiresTwoFactor?: boolean;
  tempToken?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);
  private biometric = inject(BiometricService);

  private _user = signal<User | null>(null);
  private _token = signal<string | null>(null);

  currentUser = this._user.asReadonly();
  isAuthenticated = computed(() => !!this._token());

  getToken(): string | null {
    return this._token();
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('/auth/login', { email, password }).pipe(
      tap((res) => {
        if (res.accessToken && res.user) {
          this._token.set(res.accessToken);
          this._user.set(res.user);
          this.storeRefreshToken(res.refreshToken!);
        }
      })
    );
  }

  verify2fa(tempToken: string, code: string): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('/auth/verify-2fa', { tempToken, code }).pipe(
      tap((res) => {
        if (res.accessToken && res.user) {
          this._token.set(res.accessToken);
          this._user.set(res.user);
          this.storeRefreshToken(res.refreshToken!);
        }
      })
    );
  }

  refreshToken(): Observable<LoginResponse | null> {
    return from(this.getStoredRefreshToken()).pipe(
      switchMap((refreshToken) => {
        if (!refreshToken) return of(null);
        return this.api.post<LoginResponse>('/auth/refresh', { refreshToken }).pipe(
          tap((res) => {
            if (res.accessToken && res.user) {
              this._token.set(res.accessToken);
              this._user.set(res.user);
              this.storeRefreshToken(res.refreshToken!);
            }
          }),
          catchError(() => {
            this.clearSession();
            return of(null);
          })
        );
      })
    );
  }

  async tryBiometricLogin(): Promise<boolean> {
    const available = await this.biometric.isAvailable();
    if (!available) return false;

    const hasToken = await this.hasStoredRefreshToken();
    if (!hasToken) return false;

    const verified = await this.biometric.verify();
    if (!verified) return false;

    return new Promise((resolve) => {
      this.refreshToken().subscribe((res) => resolve(!!res));
    });
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/auth']);
  }

  private async storeRefreshToken(token: string): Promise<void> {
    await SecureStoragePlugin.set({ key: 'refresh_token', value: token });
  }

  private async getStoredRefreshToken(): Promise<string | null> {
    try {
      const result = await SecureStoragePlugin.get({ key: 'refresh_token' });
      return result.value;
    } catch {
      return null;
    }
  }

  private async hasStoredRefreshToken(): Promise<boolean> {
    const token = await this.getStoredRefreshToken();
    return !!token;
  }

  private async clearSession(): Promise<void> {
    this._token.set(null);
    this._user.set(null);
    try {
      await SecureStoragePlugin.remove({ key: 'refresh_token' });
    } catch {}
  }
}
