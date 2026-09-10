import { describe, expect, it } from 'vitest';

import { formatTime } from '../date-format';

describe('formatTime', () => {
  it('returns HH:mm only', () => {
    expect(formatTime('2026-09-08T06:46:00')).toBe('06:46');
  });
});
