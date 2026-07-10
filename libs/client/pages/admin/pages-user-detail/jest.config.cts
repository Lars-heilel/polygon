module.exports = {
  displayName: '@org/pages-admin-user-detail',
  preset: '../../../../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/../jest.setup.ts'],
  moduleNameMapper: {
    '^@org/entities-admin$': '<rootDir>/../../../entities/admin/src/index.ts',
    '^@org/features-admin-ban$': '<rootDir>/../../../features/admin-ban/src/index.ts',
    '^@org/common$': '<rootDir>/../../../../common/src/index.ts',
    '^@org/shared$': '<rootDir>/../test-stubs/shared.tsx',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: 'test-output/jest/coverage',
};
