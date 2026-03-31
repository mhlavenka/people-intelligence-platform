import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Protects regular-user routes. Redirects system_admin to their own portal. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/auth/login']);
    return false;
  }

  if (auth.currentUser()?.role === 'system_admin') {
    router.navigate(['/system-admin']);
    return false;
  }

  return true;
};
