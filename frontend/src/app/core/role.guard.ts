import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, AppRole } from './auth.service';

/**
 * Factory that returns a route guard allowing only the listed roles.
 * Redirects unauthorised users to /dashboard.
 */
export const roleGuard = (allowedRoles: AppRole[]): CanActivateFn => () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const role   = auth.currentUser()?.role;

  if (!role || !allowedRoles.includes(role)) {
    router.navigate(['/dashboard']);
    return false;
  }
  return true;
};
