module.exports = {
  displayName: '@org/pages-admin-overview',
  preset: '../../../../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/../jest.setup.ts'],
  moduleNameMapper: {
    '^@org/shared$': '<rootDir>/../test-stubs/shared.tsx',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: 'test-output/jest/coverage',
};
