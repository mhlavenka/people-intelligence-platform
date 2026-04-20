import 'jest-preset-angular/setup-jest';

// Mock Capacitor plugins for testing
const mockCapacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web',
};

Object.defineProperty(global, 'Capacitor', { value: mockCapacitor });
