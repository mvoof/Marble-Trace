import { describe, expect, it } from 'vitest';

import type { DriverEntry } from '@/types/bindings';
import {
  buildVisibleRows,
  getStandingsGap,
  maxScrollOffset,
} from './standings-utils';

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

const carIndices = (drivers: DriverEntry[]) =>
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
    bestLapTime: 0,
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
});
