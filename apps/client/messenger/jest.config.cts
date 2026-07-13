module.exports = {
  displayName: '@org/messenger',
  preset: '../../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    '^@org/common$': '<rootDir>/../../../libs/common/src/index.ts',
    '^@org/entities-user$': '<rootDir>/../../../libs/client/entities/user/src/index.ts',
    '^@org/shared$': '<rootDir>/src/test-stubs/shared.tsx',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  passWithNoTests: true,
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  coverageDirectory: 'test-output/jest/coverage',
};
