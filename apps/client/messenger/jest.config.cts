module.exports = {
  displayName: '@org/messenger',
  preset: '../../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  passWithNoTests: true,
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  coverageDirectory: 'test-output/jest/coverage',
};
