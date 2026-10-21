import { describe, expect, it } from 'vitest';

import { sectorChipStateOf } from './sector-chip';

const SECTOR_COUNT = 3;
const CURRENT_LAP_TIME_S = 40;
const FIRST_SECTOR_TIME_S = 28.412;
const RUNNING_SECTOR_TIME_S = 11.588;
const RUNNING_SECTOR_DELTA_S = -0.12;

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

  it('keeps the running sector current while the backend writes its time', () => {
    const chips = Array.from({ length: SECTOR_COUNT }, (_unused, sectorIndex) =>
      sectorChipStateOf({
        sectorIndex,
        currentSectorIdx: 1,
        sectorTimes: [FIRST_SECTOR_TIME_S, RUNNING_SECTOR_TIME_S, null],
        sectorDeltas: [null, null, null],
        currentLapTime: CURRENT_LAP_TIME_S,
      })
    );

    expect(chips.map((chip) => chip.isCurrent)).toEqual([false, true, false]);
    expect(chips[1]?.displayTime).toBe('11.588');
  });

  it('shows no delta on the running sector until there is a best lap', () => {
    const runningChipWith = (delta: number | null) =>
      sectorChipStateOf({
        sectorIndex: 1,
        currentSectorIdx: 1,
        sectorTimes: [FIRST_SECTOR_TIME_S, RUNNING_SECTOR_TIME_S, null],
        sectorDeltas: [null, delta, null],
        currentLapTime: CURRENT_LAP_TIME_S,
      });

    expect(runningChipWith(null).deltaText).toBeNull();
    expect(runningChipWith(RUNNING_SECTOR_DELTA_S).deltaText).toBe('-0.12');
  });

  it('colours the running sector edge by its live delta', () => {
    const runningChip = sectorChipStateOf({
      sectorIndex: 1,
      currentSectorIdx: 1,
      sectorTimes: [FIRST_SECTOR_TIME_S, RUNNING_SECTOR_TIME_S, null],
      sectorDeltas: [null, RUNNING_SECTOR_DELTA_S, null],
      currentLapTime: CURRENT_LAP_TIME_S,
    });

    expect(runningChip.borderColor).toBe(runningChip.deltaColor);
  });
});
