import { describe, expect, it } from 'vitest';

import type { DriverEntry } from '@/types/bindings';
import {
  countdownUnit,
  formatCountdown,
  projectPositionsLost,
  speedFillPct,
  wearLevel,
} from './pit-service-utils';

describe('formatCountdown', () => {
  it('keeps sub-minute waits in seconds with one decimal', () => {
    expect(formatCountdown(12.44)).toBe('12.4');
    expect(countdownUnit(12.44)).toBe(' s');
  });

  it('switches to m:ss once the wait passes a minute', () => {
    expect(formatCountdown(145.45)).toBe('2:25');
    expect(countdownUnit(145.45)).toBe('');
  });

  it('pads the seconds so the readout never jumps width', () => {
    expect(formatCountdown(65)).toBe('1:05');
  });

  it('collapses missing and finished timers to a plain zero', () => {
    expect(formatCountdown(null)).toBe('0');
    expect(formatCountdown(0)).toBe('0');
  });
});

describe('speedFillPct', () => {
  const LIMIT = 20;

  it('puts the limit itself exactly on the divider', () => {
    expect(speedFillPct(LIMIT, LIMIT)).toBe(0.5);
  });

  it('scales the left half linearly up to the limit', () => {
    expect(speedFillPct(LIMIT / 2, LIMIT)).toBe(0.25);
  });

  it('spends the right half on the overspeed range', () => {
    // 10% over the limit is half of the 20% over-range.
    expect(speedFillPct(LIMIT * 1.1, LIMIT)).toBeCloseTo(0.75, 5);
  });

  it('clamps well past the limit instead of overflowing the plate', () => {
    expect(speedFillPct(LIMIT * 3, LIMIT)).toBe(1);
  });

  it('draws nothing when the track reports no pit limit', () => {
    expect(speedFillPct(15, 0)).toBe(0);
  });
});

describe('wearLevel', () => {
  it('treats missing wear as good so a blank corner reads calm', () => {
    expect(wearLevel(null)).toBe('good');
  });

  it('grades remaining tread', () => {
    expect(wearLevel(0.9)).toBe('good');
    expect(wearLevel(0.6)).toBe('worn');
    expect(wearLevel(0.3)).toBe('critical');
  });
});

describe('projectPositionsLost', () => {
  const buildEntry = (
    overrides: Partial<DriverEntry> & { carIdx: number }
  ): DriverEntry =>
    ({
      userName: 'driver',
      carClassId: 1,
      isPlayer: false,
      onPitRoad: false,
      isRetired: false,
      relativeLapDist: 0,
      position: 5,
      classPosition: 5,
      livePosition: 5,
      liveClassPosition: 5,
      estTime: 0,
      classEstLapTime: 100,
      bestLapTime: 100,
      ...overrides,
    }) as DriverEntry;

  const player = buildEntry({
    carIdx: 0,
    isPlayer: true,
    estTime: 50,
    position: 5,
    classPosition: 5,
  });

  // estTime is seconds around the lap, so a car 5 s behind sits at 45.
  const chaser = (carIdx: number, secondsBehind: number, extra = {}) =>
    buildEntry({
      carIdx,
      estTime: 50 - secondsBehind,
      relativeLapDist: -0.01,
      position: 6,
      classPosition: 6,
      ...extra,
    });

  it('counts only the cars close enough to get past', () => {
    const entries = [player, chaser(1, 5), chaser(2, 20)];

    expect(projectPositionsLost(entries, 12, false, false)).toBe(1);
  });

  it('ignores cars already serving their own stop', () => {
    const entries = [player, chaser(1, 5, { onPitRoad: true })];

    expect(projectPositionsLost(entries, 12, false, false)).toBe(0);
  });

  it('ignores cars ahead — they cannot gain on a stationary car', () => {
    const entries = [
      player,
      buildEntry({ carIdx: 1, estTime: 55, relativeLapDist: 0.01 }),
    ];

    expect(projectPositionsLost(entries, 12, false, false)).toBe(0);
  });

  it('counts only the player class when ranking by class', () => {
    const entries = [player, chaser(1, 5, { carClassId: 2 })];

    expect(projectPositionsLost(entries, 12, true, false)).toBe(0);
    expect(projectPositionsLost(entries, 12, false, false)).toBe(1);
  });

  it('loses nothing when there is no wait to serve', () => {
    expect(projectPositionsLost([player, chaser(1, 1)], 0, false, false)).toBe(
      0
    );
  });

  it('ignores lapped traffic sitting behind us on the relative', () => {
    // Close on track, but ranked ahead — a car a lap up cannot take our place.
    const entries = [player, chaser(1, 5, { position: 2, classPosition: 2 })];

    expect(projectPositionsLost(entries, 12, false, false)).toBe(0);
  });
});
