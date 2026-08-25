import { describe, expect, it } from 'vitest';

import type { IncidentPoint } from '@/types/bindings';
import {
  computeIncidentZones,
  flagZoneLengthPct,
  projectFlagZoneToWindow,
  splitFlagZoneAtStartFinish,
} from './flag-zones';

/** A 5 km lap makes the 250 m / 100 m warning 5 % / 2 % of a lap. */
const TRACK_M = 5000;
const BEFORE_PCT = 0.05;
const AFTER_PCT = 0.02;

const incident = (
  lapDistPct: number,
  isActive = true,
  carIdx = 0
): IncidentPoint =>
  ({ carIdx, lapDistPct, kind: 'stopped', isActive }) as IncidentPoint;

describe('computeIncidentZones', () => {
  it('returns nothing without incidents', () => {
    expect(computeIncidentZones([], TRACK_M)).toEqual([]);
  });

  it('returns nothing until the track length is known', () => {
    expect(computeIncidentZones([incident(0.5)], 0)).toEqual([]);
  });

  it('warns before the incident and a shorter way past it', () => {
    const [zone, ...rest] = computeIncidentZones([incident(0.5)], TRACK_M);

    expect(rest).toHaveLength(0);
    expect(zone.startPct).toBeCloseTo(0.5 - BEFORE_PCT);
    expect(zone.endPct).toBeCloseTo(0.5 + AFTER_PCT);
    expect(zone.isActive).toBe(true);
  });

  it('scales the warning with the track, not with the lap fraction', () => {
    const [short] = computeIncidentZones([incident(0.5)], 2500);
    const [long] = computeIncidentZones([incident(0.5)], 10000);

    // Same 250 m of warning: a quarter of the short lap, a fortieth of the long.
    expect(0.5 - short.startPct).toBeCloseTo(0.1);
    expect(0.5 - long.startPct).toBeCloseTo(0.025);
  });

  it('merges two cars stranded at the same place', () => {
    const zones = computeIncidentZones(
      [incident(0.4, true, 1), incident(0.405, true, 2)],
      TRACK_M
    );

    expect(zones).toHaveLength(1);
    expect(zones[0].startPct).toBeCloseTo(0.4 - BEFORE_PCT);
    expect(zones[0].endPct).toBeCloseTo(0.405 + AFTER_PCT);
  });

  it('keeps incidents at opposite ends of the lap apart', () => {
    expect(
      computeIncidentZones(
        [incident(0.1, true, 1), incident(0.7, true, 2)],
        TRACK_M
      )
    ).toHaveLength(2);
  });

  it('wraps a zone whose warning crosses the start/finish line', () => {
    const [zone] = computeIncidentZones([incident(0.02)], TRACK_M);

    expect(zone.startPct).toBeCloseTo(0.97);
    expect(zone.endPct).toBeCloseTo(0.04);
  });

  it('merges two cars stranded either side of the start/finish line', () => {
    const zones = computeIncidentZones(
      [incident(0.995, true, 1), incident(0.005, false, 2)],
      TRACK_M
    );

    expect(zones).toHaveLength(1);
    expect(zones[0].startPct).toBeCloseTo(0.995 - BEFORE_PCT);
    expect(zones[0].endPct).toBeCloseTo(0.005 + AFTER_PCT);
    expect(zones[0].isActive).toBe(true);
  });

  it('marks a zone cleared once every car in it recovered', () => {
    const [zone] = computeIncidentZones([incident(0.5, false)], TRACK_M);

    expect(zone.isActive).toBe(false);
  });

  it('stays active while any car in a merged zone still is', () => {
    const zones = computeIncidentZones(
      [incident(0.4, false, 1), incident(0.405, true, 2)],
      TRACK_M
    );

    expect(zones).toHaveLength(1);
    expect(zones[0].isActive).toBe(true);
  });

  it('draws nothing rather than covering the whole lap', () => {
    // 300 m of warning on a 200 m lap would wrap onto itself.
    expect(computeIncidentZones([incident(0.5)], 200)).toEqual([]);
  });
});

describe('flagZoneLengthPct', () => {
  it('follows the wrap past the start/finish line', () => {
    expect(
      flagZoneLengthPct({ startPct: 0.95, endPct: 0.05, isActive: true })
    ).toBeCloseTo(0.1);
  });
});

describe('splitFlagZoneAtStartFinish', () => {
  it('leaves a plain zone alone', () => {
    expect(
      splitFlagZoneAtStartFinish({
        startPct: 0.2,
        endPct: 0.4,
        isActive: true,
      })
    ).toEqual([{ startPct: 0.2, endPct: 0.4 }]);
  });

  it('splits a wrapping zone in two', () => {
    expect(
      splitFlagZoneAtStartFinish({
        startPct: 0.9,
        endPct: 0.1,
        isActive: true,
      })
    ).toEqual([
      { startPct: 0.9, endPct: 1 },
      { startPct: 0, endPct: 0.1 },
    ]);
  });
});

describe('projectFlagZoneToWindow', () => {
  it('places a zone ahead of the player', () => {
    const [range, ...rest] = projectFlagZoneToWindow(
      { startPct: 0.6, endPct: 0.7, isActive: true },
      0.5
    );

    expect(rest).toHaveLength(0);
    expect(range.startDiff).toBeCloseTo(0.1);
    expect(range.endDiff).toBeCloseTo(0.2);
  });

  it('places a cleared zone behind the player', () => {
    const [range] = projectFlagZoneToWindow(
      { startPct: 0.3, endPct: 0.4, isActive: true },
      0.5
    );

    expect(range.startDiff).toBeCloseTo(-0.2);
    expect(range.endDiff).toBeCloseTo(-0.1);
  });

  it('splits a zone that runs off the far edge of the window', () => {
    const ranges = projectFlagZoneToWindow(
      { startPct: 0.95, endPct: 0.15, isActive: true },
      0.5
    );

    expect(ranges).toHaveLength(2);
    expect(ranges[0].endDiff).toBeCloseTo(0.5);
    expect(ranges[1].startDiff).toBeCloseTo(-0.5);
  });
});
