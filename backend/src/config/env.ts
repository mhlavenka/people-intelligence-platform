import dotenv from 'dotenv';
dotenv.config();

export const config = {
  nodeEnv: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['PORT'] || '3030', 10),
  frontendUrl: process.env['FRONTEND_URL'] || 'http://localhost:4200',
  mongoUri: process.env['MONGODB_URI'] || '',
  jwt: {
    secret: process.env['JWT_SECRET'] || 'fallback-secret',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '15m',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] || 'fallback-refresh-secret',
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d',
  },
  anthropic: {
    apiKey: process.env['ANTHROPIC_API_KEY'] || '',
  },
  aws: {
    region: process.env['AWS_REGION'] || 'us-east-1',
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'] || '',
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || '',
    s3Bucket: process.env['AWS_S3_BUCKET'] || '',
    sesFromEmail: process.env['AWS_SES_FROM_EMAIL'] || '',
  },
  stripe: {
    secretKey: process.env['STRIPE_SECRET_KEY'] || '',
    webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'] || '',
  },
  oauth: {
    google: {
      clientId: process.env['GOOGLE_CLIENT_ID'] || '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] || '',
      calendarRedirectUri: process.env['GOOGLE_CALENDAR_REDIRECT_URI'] || '',
    },
    microsoft: {
      clientId: process.env['MICROSOFT_CLIENT_ID'] || '',
      clientSecret: process.env['MICROSOFT_CLIENT_SECRET'] || '',
      tenantId: process.env['MICROSOFT_TENANT_ID'] || 'common',
      calendarRedirectUri: process.env['MICROSOFT_CALENDAR_REDIRECT_URI'] || '',
    },
  },
  booking: {
    cancelTokenSecret: process.env['CANCEL_TOKEN_JWT_SECRET'] || 'cancel-token-fallback',
    webhookSecret: process.env['GOOGLE_WEBHOOK_SECRET'] || '',
    microsoftWebhookSecret: process.env['MICROSOFT_WEBHOOK_SECRET'] || '',
    apiBaseUrl: process.env['API_BASE_URL'] || 'http://localhost:3030',
    // Gate Google Calendar push-notification subscriptions. Keep OFF until
    // the public HTTPS path /api/webhooks/gcal is reachable from Google
    // (Apache vhost must proxy it to the PM2 artes-backend).
    webhooksEnabled: process.env['BOOKING_WEBHOOKS_ENABLED'] === 'true',
    publicApiBaseUrl: process.env['PUBLIC_API_BASE_URL'] || process.env['API_BASE_URL'] || '',
  },
  recaptcha: {
    secretKey: process.env['RECAPTCHA_SECRET_KEY'] || '',
    minScore: parseFloat(process.env['RECAPTCHA_MIN_SCORE'] || '0.5'),
  },
  webauthn: {
    rpName: process.env['WEBAUTHN_RP_NAME'] || 'Artes Hub',
    rpId: process.env['WEBAUTHN_RP_ID'] || new URL(process.env['FRONTEND_URL'] || 'http://localhost:4200').hostname,
    origin: process.env['WEBAUTHN_ORIGIN'] || process.env['FRONTEND_URL'] || 'http://localhost:4200',
  },
};
