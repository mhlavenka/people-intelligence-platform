import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface OrgContext {
  name: string;
  modules: string[];
  plan: string;
  departments: string[];
}

/**
 * Shared org context — loaded once by AppShell, consumed by Dashboard and sidebar.
 * Provides helpers for checking module access and permission-based visibility.
 */
@Injectable({ providedIn: 'root' })
export class OrgContextService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  private _modules = signal<string[]>([]);
  private _orgName = signal('');
  private _plan = signal('');
  private _loaded = signal(false);

  /** Enabled module keys for the current org subscription (e.g. 'conflict', 'neuroinclusion', 'succession'). */
  modules = this._modules.asReadonly();
  orgName = this._orgName.asReadonly();
  plan = this._plan.asReadonly();
  loaded = this._loaded.asReadonly();

  /** Load org context from API — call once from AppShell. */
  load(): void {
    this.api.get<OrgContext>('/organizations/me').subscribe({
      next: (org) => {
        this._modules.set(org.modules ?? []);
        this._orgName.set(org.name);
        this._plan.set(org.plan);
        this._loaded.set(true);
      },
      error: () => this._loaded.set(true),
    });
  }

  /** Check if a module is enabled for the current org subscription. */
  hasModule(moduleKey: string): boolean {
    return this._modules().includes(moduleKey);
  }

  /** Check if the current user holds a specific permission key. */
  hasPermission(key: string): boolean {
    const user = this.auth.currentUser();
    if (!user) return false;
    if (user.role === 'system_admin') return true;
    return user.permissions?.includes(key) ?? false;
  }
}
