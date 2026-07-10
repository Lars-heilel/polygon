module.exports = {
  displayName: '@org/admin',
  preset: '../../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  testEnvironmentOptions: {
    url: 'http://localhost/admin/',
  },
  moduleNameMapper: {
    '^@org/pages-admin-not-found$':
      '<rootDir>/../../../libs/client/pages/admin/pages-not-found/src/index.ts',
    '^@org/pages-admin-overview$':
      '<rootDir>/../../../libs/client/pages/admin/pages-overview/src/index.ts',
    '^@org/pages-admin-user-detail$':
      '<rootDir>/../../../libs/client/pages/admin/pages-user-detail/src/index.ts',
    '^@org/pages-admin-users$': '<rootDir>/../../../libs/client/pages/admin/pages-users/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: 'test-output/jest/coverage',
};
