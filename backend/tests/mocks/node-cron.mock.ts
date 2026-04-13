/**
 * node-cron stub. Jobs start in app.bootstrap but we don't want the real
 * cron scheduler running in tests.
 */
export const schedule = jest.fn(() => ({
  stop: jest.fn(),
  start: jest.fn(),
}));
