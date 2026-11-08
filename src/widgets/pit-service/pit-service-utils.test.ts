import { describe, expect, it } from 'vitest';

import type { DriverEntry } from '@shared/contracts/driver-entry';
import {
  countdownUnit,
  formatCountdown,
  projectPositionsLost,
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
      position: 5,
      classPosition: 5,
      livePosition: 5,
      liveClassPosition: 5,
      lap: 10,
      lapDistPct: 0,
      classEstLapTime: 100,
      bestLapTime: 100,
      ...overrides,
    }) as DriverEntry;

  const player = buildEntry({
    carIdx: 0,
    isPlayer: true,
    lap: 10,
    lapDistPct: 0.5,
    position: 5,
    classPosition: 5,
  });

  // A 100 s lap, so a car 5 s behind is 0.05 of a lap back.
  const LAP_S = 100;

  const chaser = (carIdx: number, secondsBehind: number, extra = {}) => {
    const progress = 10.5 - secondsBehind / LAP_S;
    const lap = Math.floor(progress);

    return buildEntry({
      carIdx,
      lap,
      lapDistPct: progress - lap,
      position: 6,
      classPosition: 6,
      ...extra,
    });
  };

  it('counts only the cars close enough to get past', () => {
    const entries = [player, chaser(1, 5), chaser(2, 20)];

    expect(projectPositionsLost(entries, 12, false, false)).toBe(1);
  });

  it('ignores cars already serving their own stop', () => {
    const entries = [player, chaser(1, 5, { onPitRoad: true })];

    expect(projectPositionsLost(entries, 12, false, false)).toBe(0);
  });

  it('ignores cars ahead — they cannot gain on a stationary car', () => {
    const entries = [player, chaser(1, -5)];

    expect(projectPositionsLost(entries, 12, false, false)).toBe(0);
  });

  it('ignores a car a lap down sitting right behind on track', () => {
    // 5 s behind on the road, a lap and 5 s behind in the race.
    const entries = [player, chaser(1, LAP_S + 5)];

    expect(projectPositionsLost(entries, 12, false, false)).toBe(0);
  });

  it('counts a car more than half a lap back when the stop costs that much', () => {
    const entries = [player, chaser(1, 60)];

    expect(projectPositionsLost(entries, 70, false, false)).toBe(1);
  });

  it('ignores cars out of the world', () => {
    const entries = [player, chaser(1, 5, { lap: 0, lapDistPct: -1 })];

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

  it('ignores a car ranked ahead sitting behind us on track', () => {
    // Close on track, but ranked ahead — a car a lap up cannot take our place.
    const entries = [player, chaser(1, 5, { position: 2, classPosition: 2 })];

    expect(projectPositionsLost(entries, 12, false, false)).toBe(0);
  });
});
