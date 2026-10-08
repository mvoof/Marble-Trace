import { describe, expect, it } from 'vitest';

import { sectorChipStateOf } from './sector-chip';

const SECTOR_COUNT = 3;
const CURRENT_LAP_TIME_S = 40;

const chipsAt = (currentSectorIdx: number | null) =>
  Array.from({ length: SECTOR_COUNT }, (_unused, sectorIndex) =>
    sectorChipStateOf({
      sectorIndex,
      currentSectorIdx,
      sectorTimes: [null, null, null],
      sectorDeltas: [null, null, null],
      currentLapTime: CURRENT_LAP_TIME_S,
    })
  );

describe('sectorChipStateOf', () => {
  it('marks only the sector the car is in as current', () => {
    const chips = chipsAt(1);

    expect(chips.map((chip) => chip.isCurrent)).toEqual([false, true, false]);
    expect(chips.map((chip) => chip.isFuture)).toEqual([false, false, true]);
  });

  it('leaves every sector ahead while the car is off the lap', () => {
    const chips = chipsAt(null);

    expect(chips.every((chip) => chip.isFuture && !chip.isCurrent)).toBe(true);
  });
});
