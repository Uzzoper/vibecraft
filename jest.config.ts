import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.test.json',
      useESM: true,
    }],
  },
  moduleNameMapper: {
    '^three$': '<rootDir>/test/mocks/three.mock.ts',
  },
  setupFiles: ['<rootDir>/test/setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/test/**/*.test.ts'],
  testTimeout: 30000,
};

export default config;
