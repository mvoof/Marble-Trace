import { describe, expect, it } from 'vitest';

import { segmentFills } from './segment-fill';

const FOUR_SECTORS = [
  { sectorNum: 0, sectorStartPct: 0 },
  { sectorNum: 1, sectorStartPct: 0.25 },
  { sectorNum: 2, sectorStartPct: 0.5 },
  { sectorNum: 3, sectorStartPct: 0.75 },
];

describe('segmentFills', () => {
  it('fills the sectors left, part of the running one, none ahead', () => {
    expect(segmentFills(FOUR_SECTORS, 2, 0.625)).toEqual([1, 1, 0.5, 0]);
  });

  it('takes the last sector to the end of the lap', () => {
    expect(segmentFills(FOUR_SECTORS, 3, 0.875)).toEqual([1, 1, 1, 0.5]);
  });

  it('leaves every segment empty off the lap', () => {
    expect(segmentFills(FOUR_SECTORS, null, 0.4)).toEqual([0, 0, 0, 0]);
  });

  it('orders the sectors by where they start', () => {
    const shuffled = [
      FOUR_SECTORS[2],
      FOUR_SECTORS[0],
      FOUR_SECTORS[3],
      FOUR_SECTORS[1],
    ];

    expect(
      segmentFills(
        shuffled.filter((sector) => sector !== undefined),
        1,
        0.375
      )
    ).toEqual([1, 0.5, 0, 0]);
  });
});
