import { isPositive } from './rules';

test('positive boundary excludes zero', () => {
  expect(isPositive(0)).toBe(false);
  expect(isPositive(1)).toBe(true);
});
