import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-preset-angular',
  setupFilesAfterFramework: ['<rootDir>/src/setup-jest.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/android/'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@ionic|@capacitor|ionicons|capacitor-.*|@ngx-translate)/)',
  ],
};

export default config;
