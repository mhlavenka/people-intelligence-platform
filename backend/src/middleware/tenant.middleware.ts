import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export function tenantResolver(req: AuthRequest, res: Response, next: NextFunction): void {
  const orgIdFromHeader = req.headers['x-organization-id'] as string;

  if (!req.user?.organizationId && !orgIdFromHeader) {
    res.status(400).json({ error: req.t ? req.t('errors.organizationContextRequired') : 'Organization context required' });
    return;
  }

  // Security: ensure orgId from token matches header if both are present
  if (
    req.user?.organizationId &&
    orgIdFromHeader &&
    req.user.organizationId !== orgIdFromHeader &&
    req.user.role !== 'super_admin'
  ) {
    res.status(403).json({ error: req.t ? req.t('errors.organizationContextMismatch') : 'Organization context mismatch' });
    return;
  }

  next();
}
