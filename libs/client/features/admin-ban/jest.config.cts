module.exports = {
  displayName: '@org/features-admin-ban',
  preset: '../../../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@org/entities-admin$': '<rootDir>/../../entities/admin/src/index.ts',
    '^@org/common$': '<rootDir>/../../../common/src/index.ts',
    '^@org/shared$': '<rootDir>/src/test-stubs/shared.tsx',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: 'test-output/jest/coverage',
};
