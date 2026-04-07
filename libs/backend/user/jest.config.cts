/* eslint-disable */
const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'));

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@org/user',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
    '^.+\\.mjs$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@prisma/client/runtime|meilisearch))',
  ],
  moduleNameMapper: {
    '^meilisearch$': '<rootDir>/../../../libs/backend/core/src/__mocks__/meilisearch.ts',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
