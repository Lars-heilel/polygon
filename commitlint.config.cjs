module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [1, 'never'],
    'body-max-line-length': [0],
  },
};
