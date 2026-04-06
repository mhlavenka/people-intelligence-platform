import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    organizationId: string;
    role: string;             // system role (or base role when a custom role is active)
    email: string;
    permissions?: string[];   // all granted permission keys — populated at login for every user
    customRoleId?: string;    // set when the user is on a custom role
    customRoleName?: string;  // display name of the custom role
  };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as AuthRequest['user'];
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Gate by system role key (unchanged behaviour — backward compatible). */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
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
      res.status(401).json({ error: 'Not authenticated' });
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
    res.status(403).json({ error: 'Insufficient permissions' });
  };
}
