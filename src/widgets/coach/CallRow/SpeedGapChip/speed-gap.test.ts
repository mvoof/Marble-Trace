import { describe, expect, it } from 'vitest';

import {
  NO_SPEED_GAP,
  settleSpeedGap,
  SPEED_GAP_HIDE_UNITS,
  SPEED_GAP_SHOW_UNITS,
  type ShownSpeedGap,
} from './speed-gap';

const EVEN: ShownSpeedGap = { kind: 'even' };

/** What the chip shows after each gap in turn, starting from nothing. */
const replay = (gaps: (number | null)[]): ShownSpeedGap[] => {
  let shown: ShownSpeedGap = NO_SPEED_GAP;

  return gaps.map((gap) => {
    shown = settleSpeedGap(shown, gap);

    return shown;
  });
};

describe('settleSpeedGap', () => {
  it('holds a gap wobbling across zero as even', () => {
    const shown = replay([1, 0, -1, 0, 1, -1, 2, -2]);

    expect(shown.every((gap) => gap.kind === 'even')).toBe(true);
  });

  it('shows a gap once it reaches the show threshold', () => {
    expect(settleSpeedGap(EVEN, SPEED_GAP_SHOW_UNITS)).toEqual({
      kind: 'gap',
      units: SPEED_GAP_SHOW_UNITS,
    });
    expect(settleSpeedGap(EVEN, -SPEED_GAP_SHOW_UNITS)).toEqual({
      kind: 'gap',
      units: -SPEED_GAP_SHOW_UNITS,
    });
  });

  it('keeps a shown gap until it falls back to the hide threshold', () => {
    const shown = replay([5, 2, SPEED_GAP_HIDE_UNITS, 2]);

    expect(shown).toEqual([
      { kind: 'gap', units: 5 },
      { kind: 'gap', units: 2 },
      EVEN,
      EVEN,
    ]);
  });

  it('has nothing to show without a reference speed', () => {
    expect(settleSpeedGap({ kind: 'gap', units: 7 }, null)).toBe(NO_SPEED_GAP);
  });
});
