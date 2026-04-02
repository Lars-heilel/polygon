const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  coverageThreshold: {
    global: {
      lines: 10,
      branches: 10,
      functions: 10,
      statements: 10,
    },
  },
};
