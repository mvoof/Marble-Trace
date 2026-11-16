import { describe, expect, it } from 'vitest';

import { changeLabel, durationParts } from './home-format';

describe('changeLabel', () => {
  it('writes the change with its arrow, a dash for none', () => {
    expect([changeLabel(120), changeLabel(-32), changeLabel(0)]).toEqual([
      '▲ 120',
      '▼ 32',
      '—',
    ]);
    expect(changeLabel(0.034, 2)).toBe('▲ 0.03');
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
