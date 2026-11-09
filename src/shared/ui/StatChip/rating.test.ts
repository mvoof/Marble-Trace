import { describe, expect, it } from 'vitest';

import { formatIr } from './rating';

describe('formatIr', () => {
  it('keeps one decimal below 9950', () => {
    expect(formatIr(1000)).toBe('1.0k');
    expect(formatIr(9949)).toBe('9.9k');
  });

  it('drops the decimal from 9950 so the value fits four characters', () => {
    expect(formatIr(9950)).toBe('10k');
    expect(formatIr(12345)).toBe('12k');
    expect(formatIr(99999)).toBe('100k');
  });

  it('writes the full number below 1000 or when not abbreviating', () => {
    expect(formatIr(999)).toBe('999');
    expect(formatIr(12345, false)).toBe('12345');
  });
});
