/* eslint-disable */
// Jest shim for `import ... from 'vitest'` in specs that run under the
// repo's jest runner (libs/common uses jest, not vitest). Re-exports the
// matching jest globals so the brief's verbatim vitest-style contract spec
// can execute without a vitest runner.
const shim = {};
for (const key of [
  'describe',
  'it',
  'test',
  'expect',
  'beforeAll',
  'beforeEach',
  'afterAll',
  'afterEach',
  'suite',
]) {
  Object.defineProperty(shim, key, {
    enumerable: true,
    get: () => global[key],
  });
}
Object.defineProperty(shim, 'vi', {
  enumerable: true,
  get: () => global.vi ?? { fn: (...args) => jest.fn(...args) },
});
module.exports = shim;
