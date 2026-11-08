import { describe, expect, it } from 'vitest';

import type { CarIdentity } from '@shared/contracts/car-identity';
import type { DriverEntry } from '@shared/contracts/driver-entry';
import {
  NAME_COLUMN_DEFAULT_PX,
  NAME_COLUMN_MAX_PX,
  NAME_COLUMN_MIN_PX,
  buildGridTemplate,
  computeStandingsDesignWidth,
  buildLapProgress,
  buildVisibleRows,
  drawsClassHeaders,
  formatLapCell,
  formatLapDelta,
  formatPitStopTime,
  getStandingsGap,
  getStandingsInterval,
  maxScrollOffset,
  resolveBestLapDisplay,
} from './standings-utils';
import type { StandingsWidgetSettings } from './settings-schema';

const makeField = (count: number, playerIdx: number): DriverEntry[] =>
  Array.from(
    { length: count },
    (_, index) =>
      ({
        carIdx: index,
        livePosition: index + 1,
        liveClassPosition: index + 1,
        isPlayer: index === playerIdx,
      }) as DriverEntry
  );

const carIndices = (drivers: CarIdentity[]) =>
  drivers.map((driver) => driver.carIdx);

describe('buildVisibleRows', () => {
  it('returns the whole field when it fits the budget', () => {
    const result = buildVisibleRows(makeField(5, 4), 8, 2, 2);

    expect(carIndices(result.drivers)).toEqual([0, 1, 2, 3, 4]);
    expect(result.windowStartIndex).toBe(-1);
  });

  it('keeps the plain top slice while the player is still visible', () => {
    const result = buildVisibleRows(makeField(20, 3), 6, 2, 2);

    expect(carIndices(result.drivers)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.windowStartIndex).toBe(-1);
  });

  it('carves a window when the player sits on the last visible row', () => {
    // Without it the player would be the bottom row with nobody behind them.
    const result = buildVisibleRows(makeField(20, 5), 6, 2, 2);

    expect(carIndices(result.drivers)).toEqual([0, 3, 4, 5, 6, 7]);
    expect(result.windowStartIndex).toBe(1);
  });

  it('keeps the leader and marks the gap when the rows behind do not fit', () => {
    const result = buildVisibleRows(makeField(20, 8), 6, 2, 2);

    expect(carIndices(result.drivers)).toEqual([0, 6, 7, 8, 9, 10]);
    expect(result.windowStartIndex).toBe(1);
  });

  it('pins the player to the last row when the window is disabled', () => {
    const result = buildVisibleRows(makeField(20, 12), 5, 0, 0);

    expect(carIndices(result.drivers)).toEqual([0, 1, 2, 3, 12]);
    expect(result.windowStartIndex).toBe(-1);
  });

  it('shows the requested rows around the player', () => {
    const result = buildVisibleRows(makeField(20, 12), 8, 2, 3);

    expect(carIndices(result.drivers)).toEqual([0, 1, 10, 11, 12, 13, 14, 15]);
    expect(result.windowStartIndex).toBe(2);
  });

  it('trims the block from the back when the budget is tight', () => {
    const result = buildVisibleRows(makeField(20, 12), 4, 5, 5);

    // The leader keeps the top block; what is left goes to the cars ahead.
    expect(carIndices(result.drivers)).toEqual([0, 10, 11, 12]);
    expect(result.windowStartIndex).toBe(1);
  });

  it('keeps the player row when the budget leaves room for a single row', () => {
    const result = buildVisibleRows(makeField(20, 12), 1, 5, 5);

    expect(carIndices(result.drivers)).toEqual([12]);
    expect(result.windowStartIndex).toBe(0);
  });

  it('never pads the window with cars ahead when nobody is behind', () => {
    const result = buildVisibleRows(makeField(20, 19), 8, 2, 3);

    // Only the 2 requested cars ahead — the freed rows go back to the top block.
    expect(carIndices(result.drivers)).toEqual([0, 1, 2, 3, 4, 17, 18, 19]);
    expect(result.windowStartIndex).toBe(5);
  });

  it('drops the separator when the window is contiguous with the top block', () => {
    const result = buildVisibleRows(makeField(20, 6), 8, 5, 1);

    expect(carIndices(result.drivers)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(result.windowStartIndex).toBe(-1);
  });

  it('scrolls the top block while keeping the player window pinned', () => {
    const result = buildVisibleRows(makeField(20, 12), 5, 2, 2, 6);

    expect(carIndices(result.drivers)).toEqual([6, 10, 11, 12, 13]);
    expect(result.windowStartIndex).toBe(1);
  });

  it('absorbs the player window once the scroll reaches the player', () => {
    const result = buildVisibleRows(makeField(20, 12), 5, 2, 2, 9);

    expect(carIndices(result.drivers)).toEqual([9, 10, 11, 12, 13]);
    expect(result.windowStartIndex).toBe(-1);
  });

  it('keeps the pinned player row at the bottom while scrolling', () => {
    const result = buildVisibleRows(makeField(20, 12), 5, 0, 0, 4);

    expect(carIndices(result.drivers)).toEqual([4, 5, 6, 7, 12]);
  });

  it('stops the scroll with the last driver on the bottom row', () => {
    const result = buildVisibleRows(makeField(20, 12), 5, 2, 2, 99);

    expect(carIndices(result.drivers)).toEqual([15, 16, 17, 18, 19]);
  });

  it('ignores the scroll offset when the whole field already fits', () => {
    const result = buildVisibleRows(makeField(5, 4), 8, 2, 2, 3);

    expect(carIndices(result.drivers)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('maxScrollOffset', () => {
  it('is the driver count minus the rows on screen', () => {
    expect(maxScrollOffset(20, 5)).toBe(15);
  });

  it('is zero when every driver fits', () => {
    expect(maxScrollOffset(4, 10)).toBe(0);
  });
});

const makeGapEntry = (entry: Partial<DriverEntry>): DriverEntry =>
  ({
    bestLapTime: null,
    f2Time: 0,
    resultsPositionLap: null,
    resultsPositionTime: null,
    ...entry,
  }) as DriverEntry;

describe('getStandingsGap', () => {
  it('measures the race gap against the leader it is given', () => {
    // Both gaps come from the sim measured against the overall leader.
    const classLeader = makeGapEntry({
      resultsPositionLap: 0,
      resultsPositionTime: 12.4,
    });
    const driver = makeGapEntry({
      resultsPositionLap: 0,
      resultsPositionTime: 20.9,
    });

    expect(getStandingsGap(driver, classLeader, true, false, 0).value).toBe(
      '8.5'
    );
  });

  it('leaves the overall view untouched', () => {
    const overallLeader = makeGapEntry({
      resultsPositionLap: 0,
      resultsPositionTime: 0,
    });
    const driver = makeGapEntry({
      resultsPositionLap: 0,
      resultsPositionTime: 20.9,
    });

    expect(getStandingsGap(driver, overallLeader, true, false, 0).value).toBe(
      '20.9'
    );
  });

  it('counts laps down from the class leader, not the overall one', () => {
    const classLeader = makeGapEntry({
      resultsPositionLap: 2,
      resultsPositionTime: 0,
    });
    const driver = makeGapEntry({
      resultsPositionLap: 3,
      resultsPositionTime: 0,
    });

    expect(getStandingsGap(driver, classLeader, true, false, 0).value).toBe(
      '1 L'
    );
  });

  it('re-bases the F2 fallback on the class leader too', () => {
    const classLeader = makeGapEntry({ f2Time: 5 });
    const driver = makeGapEntry({ f2Time: 9.2 });

    expect(getStandingsGap(driver, classLeader, true, false, 0).value).toBe(
      '4.2'
    );
  });

  it('names the leader instead of leaving a dash', () => {
    const leader = makeGapEntry({});

    expect(getStandingsGap(leader, leader, true, true, 0)).toEqual({
      value: 'LDR',
      isLeader: true,
      isEmpty: false,
    });
  });
});

describe('getStandingsInterval', () => {
  it('measures the race gap against the car directly ahead', () => {
    const carAhead = makeGapEntry({
      resultsPositionLap: 0,
      resultsPositionTime: 12.4,
    });
    const driver = makeGapEntry({
      resultsPositionLap: 0,
      resultsPositionTime: 13.1,
    });

    expect(getStandingsInterval(driver, carAhead, true).value).toBe('0.7');
  });

  it('counts a lap to the car ahead as a lap', () => {
    const carAhead = makeGapEntry({
      resultsPositionLap: 0,
      resultsPositionTime: 80,
    });
    const driver = makeGapEntry({
      resultsPositionLap: 1,
      resultsPositionTime: 5,
    });

    expect(getStandingsInterval(driver, carAhead, true).value).toBe('1 L');
  });

  it('is empty, not a leader, for the car with nobody ahead', () => {
    const interval = getStandingsInterval(makeGapEntry({}), null, true);

    expect(interval.isLeader).toBe(false);
    expect(interval.isEmpty).toBe(true);
  });
});

describe('formatLapCell', () => {
  it('writes a lap time in full', () => {
    expect(formatLapCell(92.4)).toBe('1:32.400');
  });

  it('is a single dash without a time, not a dashed-out clock', () => {
    expect(formatLapCell(null)).toBe('-');
    expect(formatLapCell(0)).toBe('-');
  });
});

describe('formatPitStopTime', () => {
  it('keeps tenths under a minute', () => {
    expect(formatPitStopTime(23.46)).toBe('23.5s');
  });

  it('switches to minutes and seconds past a minute', () => {
    expect(formatPitStopTime(92.7)).toBe('1:32');
  });

  it('is a dash without a time', () => {
    expect(formatPitStopTime(null)).toBe('-');
  });
});

describe('formatLapDelta', () => {
  it('writes a slower lap without a sign, two decimals at most', () => {
    expect(formatLapDelta(1.23456)).toEqual({ value: '1.23', tone: 'slower' });
  });

  it('drops the minus of a faster lap — the colour says it', () => {
    expect(formatLapDelta(-0.5)).toEqual({ value: '0.50', tone: 'faster' });
  });

  it('calls a delta that rounds to zero even', () => {
    expect(formatLapDelta(-0.004)).toEqual({ value: '0.00', tone: 'even' });
  });

  it('is a dash until two laps exist', () => {
    expect(formatLapDelta(undefined)).toEqual({ value: '-', tone: 'even' });
  });
});

const makeBestLapEntry = (
  bestLapTime: number | null,
  qualifyTime: number | null
) => ({ bestLapTime, qualifyTime }) as DriverEntry;

describe('resolveBestLapDisplay', () => {
  it('prefers a lap set in this session', () => {
    expect(resolveBestLapDisplay(makeBestLapEntry(91.2, 90.4))).toEqual({
      time: 91.2,
      isQualifying: false,
    });
  });

  it('stands in the qualifying time until a lap is completed', () => {
    expect(resolveBestLapDisplay(makeBestLapEntry(null, 90.4))).toEqual({
      time: 90.4,
      isQualifying: true,
    });
  });

  it('is empty for a car that never set a time at all', () => {
    expect(resolveBestLapDisplay(makeBestLapEntry(null, null))).toEqual({
      time: null,
      isQualifying: false,
    });
  });
});

describe('buildLapProgress', () => {
  it('returns nothing before any car has a lap', () => {
    expect(buildLapProgress(null, '45', false)).toBeNull();
  });

  it('shows the leader lap alone when the session has no length', () => {
    expect(buildLapProgress(7, null, true)).toEqual({
      value: '7',
      isFinalLap: false,
      widthChars: 1,
    });
  });

  it('announces the final lap of a lap-limited race', () => {
    expect(buildLapProgress(45, '45', false)).toEqual({
      value: 'FINAL',
      isFinalLap: true,
      widthChars: 5,
    });
  });

  it('marks an estimated total and never calls it a final lap', () => {
    expect(buildLapProgress(20, '20', true)).toEqual({
      value: '20/~20',
      isFinalLap: false,
      widthChars: 6,
    });
  });

  it('reserves the width of the value it renders', () => {
    expect(buildLapProgress(9, '45', false)).toEqual({
      value: '9/45',
      isFinalLap: false,
      widthChars: 5,
    });
  });
});

describe('drawsClassHeaders', () => {
  it('is true only where the table renders a class header of its own', () => {
    expect(drawsClassHeaders('grouped', 2)).toBe(true);
    expect(drawsClassHeaders('cycling', 1)).toBe(true);
    expect(drawsClassHeaders('all', 2)).toBe(false);
    expect(drawsClassHeaders('grouped', 0)).toBe(false);
  });
});

describe('name column width', () => {
  const settingsWith = (nameColumnWidth: number) =>
    ({
      nameColumnWidth,
      showPosChange: false,
      showLicBadge: false,
      showIRating: false,
      showIrChange: false,
      showLapsCompleted: false,
      showBrand: false,
      showTire: false,
    }) as unknown as StandingsWidgetSettings;

  it('narrows the widget by exactly what the name column loses', () => {
    const wide = computeStandingsDesignWidth(
      settingsWith(NAME_COLUMN_DEFAULT_PX)
    );
    const narrow = computeStandingsDesignWidth(
      settingsWith(NAME_COLUMN_DEFAULT_PX - 40)
    );

    expect(wide - narrow).toBe(40);
  });

  it('clamps a width outside the slider range', () => {
    expect(computeStandingsDesignWidth(settingsWith(5))).toBe(
      computeStandingsDesignWidth(settingsWith(NAME_COLUMN_MIN_PX))
    );
    expect(computeStandingsDesignWidth(settingsWith(9999))).toBe(
      computeStandingsDesignWidth(settingsWith(NAME_COLUMN_MAX_PX))
    );
  });

  it('has no elastic column at all — the row is exactly its columns wide', () => {
    const template = buildGridTemplate(settingsWith(NAME_COLUMN_DEFAULT_PX));

    expect(template).not.toContain('fr');
  });
});

describe('columns sized by their format', () => {
  const settingsWith = (partial: Partial<StandingsWidgetSettings>) =>
    ({
      nameColumnWidth: NAME_COLUMN_DEFAULT_PX,
      showPosChange: false,
      showIrChange: false,
      showLapsCompleted: false,
      showBrand: false,
      showTire: false,
      showLicBadge: true,
      showLicenseLetter: true,
      showIRating: true,
      abbreviateIRating: true,
      ...partial,
    }) as unknown as StandingsWidgetSettings;

  it('widens the table when the iRating is spelled out', () => {
    const abbreviated = computeStandingsDesignWidth(settingsWith({}));
    const full = computeStandingsDesignWidth(
      settingsWith({ abbreviateIRating: false })
    );

    expect(full).toBeGreaterThan(abbreviated);
  });

  it('narrows the table when the license letter is dropped', () => {
    const withLetter = computeStandingsDesignWidth(settingsWith({}));
    const withoutLetter = computeStandingsDesignWidth(
      settingsWith({ showLicenseLetter: false })
    );

    expect(withoutLetter).toBeLessThan(withLetter);
  });

  // A format only pays for itself while its column is on screen.
  it('costs nothing while the column it formats is hidden', () => {
    const hidden = { showIRating: false, showLicBadge: false };

    expect(computeStandingsDesignWidth(settingsWith(hidden))).toBe(
      computeStandingsDesignWidth(
        settingsWith({
          ...hidden,
          abbreviateIRating: false,
          showLicenseLetter: false,
        })
      )
    );
  });
});
