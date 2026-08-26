import { describe, expect, it } from 'vitest';

import type { DriverEntry } from '@/types/bindings';
import {
  countdownUnit,
  formatCountdown,
  buildSpeedRow,
  formatSpeedMargin,
  projectPositionsLost,
  SPEED_GREEN_SHARE,
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

describe('buildSpeedRow', () => {
  const LIMIT = 20;
  const FACTOR = 3.6;
  const STEADY = 0;

  it('puts the limit itself on the seam between the two tracks', () => {
    const view = buildSpeedRow(LIMIT, LIMIT, STEADY, FACTOR);

    expect(view.fill).toBeCloseTo(SPEED_GREEN_SHARE, 5);
    expect(view.overFill).toBe(0);
    expect(view.isOver).toBe(false);
  });

  it('scales the green track linearly up to the limit', () => {
    const view = buildSpeedRow(LIMIT / 2, LIMIT, STEADY, FACTOR);

    expect(view.fill).toBeCloseTo(SPEED_GREEN_SHARE / 2, 5);
  });

  it('spends the red tip on the overspeed range', () => {
    // 10% over the limit is half of the 20% over-range.
    const view = buildSpeedRow(LIMIT * 1.1, LIMIT, STEADY, FACTOR);

    expect(view.overFill).toBeCloseTo((1 - SPEED_GREEN_SHARE) / 2, 5);
    expect(view.isOver).toBe(true);
  });

  it('clamps well past the limit instead of overflowing the row', () => {
    const view = buildSpeedRow(LIMIT * 3, LIMIT, STEADY, FACTOR);

    expect(view.fill + view.overFill).toBeCloseTo(1, 5);
  });

  it('reports the margin in display units, signed by which side of the limit', () => {
    expect(buildSpeedRow(LIMIT - 1, LIMIT, STEADY, FACTOR).margin).toBeCloseTo(
      FACTOR,
      5
    );
    expect(buildSpeedRow(LIMIT + 1, LIMIT, STEADY, FACTOR).margin).toBeCloseTo(
      -FACTOR,
      5
    );
  });

  it('marks the lift band ahead of the fill while the car is still gaining', () => {
    const view = buildSpeedRow(LIMIT / 2, LIMIT, 5, FACTOR);

    expect(view.liftStart).toBeCloseTo(view.fill, 5);
    expect(view.liftWidth).toBeGreaterThan(0);
  });

  it('drops the lift band once the throttle is no longer adding speed', () => {
    const view = buildSpeedRow(LIMIT / 2, LIMIT, -2, FACTOR);

    expect(view.liftStart).toBeNull();
    expect(view.liftWidth).toBeNull();
  });

  it('draws nothing when the track reports no pit limit', () => {
    const view = buildSpeedRow(15, 0, STEADY, FACTOR);

    expect(view.fill).toBe(0);
    expect(view.margin).toBe(0);
  });
});

describe('formatSpeedMargin', () => {
  it('writes the remaining margin as a countdown to the limit', () => {
    expect(formatSpeedMargin(11.6)).toBe('-12');
  });

  it('flips the sign the moment the limit is crossed', () => {
    expect(formatSpeedMargin(-2.2)).toBe('+2');
    expect(formatSpeedMargin(0)).toBe('+0');
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
