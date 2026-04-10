/* eslint-disable */
const { readFileSync } = require('fs');

const swcJestConfig = JSON.parse(readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'));
swcJestConfig.swcrc = false;

const sharedConfig = {
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
    '^.+\\.mjs$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: ['/node_modules/(?!(@prisma/client/runtime|meilisearch))'],
  moduleNameMapper: {
    '^meilisearch$': '<rootDir>/../../../libs/backend/core/src/__mocks__/meilisearch.ts',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};

module.exports = {
  displayName: '@org/user',
  projects: [
    {
      ...sharedConfig,
      displayName: 'unit',
      testMatch: ['**/Tests/units/**/*.spec.ts'],
      moduleNameMapper: {
        ...sharedConfig.moduleNameMapper,
        '^@org/core$': '<rootDir>/src/Tests/__mocks__/core.mock.ts',
      },
    },
    {
      ...sharedConfig,
      displayName: 'integration',
      testMatch: ['**/Tests/integration/**/*.spec.ts'],
    },
  ],
};
