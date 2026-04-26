import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    organizationId: string;
    role: string;             // system role (or base role when a custom role is active)
    email: string;
    isCoachee?: boolean;      // true when the user is in (or has been in) a coaching engagement — orthogonal to role
    permissions?: string[];   // all granted permission keys — populated at login for every user
    customRoleId?: string;    // set when the user is on a custom role
    customRoleName?: string;  // display name of the custom role
  };
}

/** True when the user is being coached, independent of their org role.
 *  Use this everywhere we previously checked `role === 'coachee'` to mean
 *  "treat as a coachee" — so internal employees with isCoachee=true are
 *  handled the same as external coachees. */
export function isCoacheeUser(req: AuthRequest): boolean {
  return req.user?.isCoachee === true || req.user?.role === 'coachee';
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: req.t ? req.t('errors.accessTokenRequired') : 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as AuthRequest['user'];
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: req.t ? req.t('errors.invalidOrExpiredToken') : 'Invalid or expired token' });
  }
}

/** Same as authenticateToken but never blocks. Attaches req.user when a
 *  valid bearer token is present, otherwise lets the request through
 *  unauthenticated. Used on public routes that benefit from knowing the
 *  caller (e.g. coachee booking via the public flow). */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) { next(); return; }
  try {
    req.user = jwt.verify(token, config.jwt.secret) as AuthRequest['user'];
  } catch {
    // ignore — public route, treat as anonymous
  }
  next();
}

/** Gate by system role key (unchanged behaviour — backward compatible). */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: req.t ? req.t('errors.insufficientPermissions') : 'Insufficient permissions' });
      return;
    }
    next();
  };
}

/**
 * Gate by one or more fine-grained permission keys.
 * The user must hold ALL supplied keys (AND logic).
 * Use requirePermission('A') | requirePermission('A', 'B') — never pass large lists.
 * system_admin always passes.
 */
export function requirePermission(...keys: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: req.t ? req.t('errors.notAuthenticated') : 'Not authenticated' });
      return;
    }
    // system_admin bypasses all permission checks
    if (req.user.role === 'system_admin') {
      next();
      return;
    }
    const granted = req.user.permissions ?? [];
    if (keys.every((k) => granted.includes(k))) {
      next();
      return;
    }
    res.status(403).json({ error: req.t ? req.t('errors.insufficientPermissions') : 'Insufficient permissions' });
  };
}
