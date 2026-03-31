import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Protects system-admin routes. Non-admins are sent to /dashboard. */
export const systemAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/auth/login']);
    return false;
  }

  if (auth.currentUser()?.role !== 'system_admin') {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
