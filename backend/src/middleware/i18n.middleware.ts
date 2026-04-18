import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import i18nextMiddleware from 'i18next-http-middleware';
import path from 'path';
import type { RequestHandler } from 'express';

export async function initI18n(): Promise<void> {
  await i18next
    .use(Backend)
    .use(i18nextMiddleware.LanguageDetector)
    .init({
      backend: {
        loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
      },
      fallbackLng: 'en',
      preload: ['en', 'fr'],
      ns: ['common', 'emails'],
      defaultNS: 'common',
      detection: {
        order: ['header'],
        lookupHeader: 'accept-language',
      },
    });
}

export const i18nMiddleware: RequestHandler = i18nextMiddleware.handle(i18next);
