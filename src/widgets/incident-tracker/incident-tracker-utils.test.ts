import { describe, expect, it } from 'vitest';

import {
  deltaDirection,
  formatSr,
  formatSrDelta,
  roundCornersUp,
} from './incident-tracker-utils';

describe('formatting', () => {
  it('writes the rating to the hundredth, or a dash', () => {
    expect(formatSr(3.4712)).toBe('3.47');
    expect(formatSr(null)).toBe('—');
  });

  it('always signs the change, so its length holds', () => {
    expect(formatSrDelta(0.123)).toBe('+0.12');
    expect(formatSrDelta(-0.08)).toBe('-0.08');
    expect(formatSrDelta(-0.001)).toBe('+0.00');
  });

  it('points the change the way it is drawn', () => {
    expect(deltaDirection(0.12)).toBe('up');
    expect(deltaDirection(-0.08)).toBe('down');
    expect(deltaDirection(-0.001)).toBe('flat');
    expect(deltaDirection(null)).toBe('flat');
  });

  it('owes a whole corner for a part of one', () => {
    expect(roundCornersUp(0)).toBe(0);
    expect(roundCornersUp(45.1)).toBe(46);
  });
});
