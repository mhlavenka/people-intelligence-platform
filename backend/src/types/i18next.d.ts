import 'i18next';

declare module 'express-serve-static-core' {
  interface Request {
    t: import('i18next').TFunction;
    language: string;
  }
}
