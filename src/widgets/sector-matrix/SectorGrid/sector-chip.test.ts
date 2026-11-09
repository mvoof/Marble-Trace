import { describe, expect, it } from 'vitest';

import { sectorChipStateOf } from './sector-chip';

const SECTOR_COUNT = 3;
const CURRENT_LAP_TIME_S = 40;
const FIRST_SECTOR_TIME_S = 28.412;
const RUNNING_SECTOR_TIME_S = 11.588;
const RUNNING_SECTOR_DELTA_S = -0.12;
const RUNNING_SECTOR_BEHIND_DELTA_S = 0.34;

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

    expect(chips.map((chip) => chip.kind)).toEqual([
      'level',
      'current',
      'empty',
    ]);
  });

  it('leaves every sector ahead while the car is off the lap', () => {
    const chips = chipsAt(null);

    expect(chips.every((chip) => chip.kind === 'empty')).toBe(true);
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

    expect(chips[1]?.kind).toBe('current');
    expect(chips[1]?.displayTime).toBe('11.588');
  });

  it('reads LIVE on the running sector until there is a best lap', () => {
    const runningChipWith = (delta: number | null) =>
      sectorChipStateOf({
        sectorIndex: 1,
        currentSectorIdx: 1,
        sectorTimes: [FIRST_SECTOR_TIME_S, RUNNING_SECTOR_TIME_S, null],
        sectorDeltas: [null, delta, null],
        currentLapTime: CURRENT_LAP_TIME_S,
      });

    expect(runningChipWith(null).delta).toEqual({
      text: 'LIVE',
      tone: 'positive',
      isLive: true,
    });
    expect(runningChipWith(RUNNING_SECTOR_DELTA_S).delta?.text).toBe('-0.12');
  });

  it('colours a banked sector by its delta', () => {
    const bankedChip = sectorChipStateOf({
      sectorIndex: 0,
      currentSectorIdx: 1,
      sectorTimes: [FIRST_SECTOR_TIME_S, RUNNING_SECTOR_TIME_S, null],
      sectorDeltas: [RUNNING_SECTOR_BEHIND_DELTA_S, null, null],
      currentLapTime: CURRENT_LAP_TIME_S,
    });

    expect(bankedChip.kind).toBe('behind');
    expect(bankedChip.delta?.tone).toBe('danger');
  });

  it("dims last lap's time on a sector not reached yet", () => {
    const upcomingChip = sectorChipStateOf({
      sectorIndex: 2,
      currentSectorIdx: 1,
      sectorTimes: [
        FIRST_SECTOR_TIME_S,
        RUNNING_SECTOR_TIME_S,
        FIRST_SECTOR_TIME_S,
      ],
      sectorDeltas: [null, null, null],
      currentLapTime: CURRENT_LAP_TIME_S,
    });

    expect(upcomingChip.kind).toBe('upcoming');
    expect(upcomingChip.displayTime).toBe('28.412');
    expect(upcomingChip.delta).toBeNull();
  });
});
