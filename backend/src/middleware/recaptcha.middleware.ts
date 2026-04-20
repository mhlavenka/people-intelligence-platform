import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

export async function verifyRecaptcha(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!config.recaptcha.secretKey) {
    next();
    return;
  }

  // Skip reCAPTCHA for native mobile apps (Capacitor origin)
  const origin = req.headers.origin || '';
  if (origin === 'https://localhost' || origin === 'http://localhost') {
    next();
    return;
  }

  const token = req.body?.recaptchaToken;
  if (!token) {
    res.status(400).json({ error: req.t('errors.recaptchaRequired') });
    return;
  }

  try {
    const params = new URLSearchParams({
      secret: config.recaptcha.secretKey,
      response: token,
      remoteip: req.ip || '',
    });

    const resp = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      { method: 'POST', body: params },
    );
    const data = (await resp.json()) as RecaptchaResponse;

    if (!data.success || (data.score !== undefined && data.score < config.recaptcha.minScore)) {
      console.warn(
        `[reCAPTCHA] Blocked: success=${data.success} score=${data.score} errors=${data['error-codes']?.join(',')}`,
      );
      res.status(403).json({ error: req.t('errors.recaptchaFailed') });
      return;
    }

    next();
  } catch (err) {
    console.error('[reCAPTCHA] Verification request failed:', err);
    next();
  }
}
