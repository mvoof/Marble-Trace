import { describe, expect, it } from 'vitest';

import { durationParts, formatClock, signedChange } from './home-format';

describe('signedChange', () => {
  it('writes the sign, then the size as asked', () => {
    expect([signedChange(212), signedChange(-3), signedChange(0)]).toEqual([
      '+212',
      '−3',
      '+0',
    ]);
    expect(signedChange(-4_500, formatClock)).toBe('−1:15');
  });
});

describe('formatClock', () => {
  it('writes hours and two-digit minutes', () => {
    expect([formatClock(24_120), formatClock(300), formatClock(0)]).toEqual([
      '6:42',
      '0:05',
      '0:00',
    ]);
  });
});

describe('durationParts', () => {
  it('names minutes under an hour, hours and minutes under ten, whole hours after', () => {
    expect(
      [59, 60, 2_520, 3_600, 5_100, 35_999, 36_000, 111_600].map(durationParts)
    ).toEqual([
      { kind: 'minutes', minutes: 1 },
      { kind: 'minutes', minutes: 1 },
      { kind: 'minutes', minutes: 42 },
      { kind: 'hoursMinutes', hours: 1, minutes: 0 },
      { kind: 'hoursMinutes', hours: 1, minutes: 25 },
      { kind: 'hours', hours: 10 },
      { kind: 'hours', hours: 10 },
      { kind: 'hours', hours: 31 },
    ]);
  });
});
