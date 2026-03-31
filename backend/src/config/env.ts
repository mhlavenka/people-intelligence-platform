import dotenv from 'dotenv';
dotenv.config();

export const config = {
  nodeEnv: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['PORT'] || '3000', 10),
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
};
