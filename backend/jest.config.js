/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  testTimeout: 30_000,
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  resetMocks: false,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  // Silence noisy logs from the app under test. Comment out when debugging.
  silent: true,
};
