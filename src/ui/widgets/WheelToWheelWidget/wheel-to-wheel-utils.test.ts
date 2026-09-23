import { describe, expect, it } from 'vitest';

import type { DriverEntry } from '@/types/bindings';
import {
  formatBattleGap,
  litSpeedSegments,
  pickRivals,
  SPEED_SEGMENT_COUNT,
  type PickRivalsOptions,
  type WheelToWheelOpponent,
} from './wheel-to-wheel-utils';

const LAP_TIME_S = 100;
const NO_EXCLUSIONS: ReadonlySet<number> = new Set();

/** A car `gapSeconds` ahead of the player (negative: behind), on lap 5. */
const carAt = (
  carIdx: number,
  gapSeconds: number,
  overrides: Partial<DriverEntry> = {}
): DriverEntry =>
  ({
    carIdx,
    carClassId: 1,
    isPlayer: false,
    onPitRoad: false,
    trackSurface: 'OnTrack',
    lap: 5,
    lapDistPct: 0.5 + gapSeconds / LAP_TIME_S,
    relativeLapDist: gapSeconds / LAP_TIME_S,
    estTime: 50 + gapSeconds,
    classEstLapTime: LAP_TIME_S,
    bestLapTime: LAP_TIME_S,
    speed: 0,
    ...overrides,
  }) as DriverEntry;

const player = carAt(0, 0, { isPlayer: true });

const options = (overrides: Partial<PickRivalsOptions> = {}) => ({
  thresholdSeconds: 1,
  heldAheadIdx: null,
  heldBehindIdx: null,
  excludedCarIdxs: NO_EXCLUSIONS,
  countsLaps: true,
  ...overrides,
});

const idxOf = (rival: WheelToWheelOpponent | null) =>
  rival?.entry.carIdx ?? null;

describe('pickRivals', () => {
  it('takes the nearest car inside the threshold on each side', () => {
    const entries = [player, carAt(1, 0.8), carAt(2, 0.3), carAt(3, -0.5)];
    const rivals = pickRivals(entries, player, options());

    expect(idxOf(rivals.ahead)).toBe(2);
    expect(idxOf(rivals.behind)).toBe(3);
  });

  it('leaves a side empty when nobody there is inside the threshold', () => {
    const rivals = pickRivals(
      [player, carAt(1, 0.4), carAt(2, -3)],
      player,
      options()
    );

    expect(idxOf(rivals.ahead)).toBe(1);
    expect(rivals.behind).toBeNull();
  });

  it('ignores other classes and pit road', () => {
    const entries = [
      player,
      carAt(1, 0.2, { carClassId: 2 }),
      carAt(2, -0.2, { onPitRoad: true }),
    ];

    expect(pickRivals(entries, player, options())).toEqual({
      ahead: null,
      behind: null,
    });
  });

  it('drops lapped cars only while laps count', () => {
    const entries = [player, carAt(1, 0.2, { lap: 6 })];

    expect(pickRivals(entries, player, options()).ahead).toBeNull();
    expect(
      idxOf(pickRivals(entries, player, options({ countsLaps: false })).ahead)
    ).toBe(1);
  });

  it('keeps the held rival until it passes the widened threshold', () => {
    const entries = [player, carAt(1, 1.2), carAt(2, 0.2)];

    expect(
      idxOf(pickRivals(entries, player, options({ heldAheadIdx: 1 })).ahead)
    ).toBe(1);
  });

  it('lets the held rival go past 1.3 × the threshold', () => {
    const entries = [player, carAt(1, 1.5), carAt(2, 0.2)];

    expect(
      idxOf(pickRivals(entries, player, options({ heldAheadIdx: 1 })).ahead)
    ).toBe(2);
  });

  it('skips excluded cars such as the pace car', () => {
    const rivals = pickRivals(
      [player, carAt(9, 0.1)],
      player,
      options({ excludedCarIdxs: new Set([9]) })
    );

    expect(rivals.ahead).toBeNull();
  });
});

describe('litSpeedSegments', () => {
  it('lights both bars alike in an even fight', () => {
    expect(litSpeedSegments(70, 70)).toBe(litSpeedSegments(70, 70));
    expect(litSpeedSegments(70, 70)).toBeLessThan(SPEED_SEGMENT_COUNT);
  });

  it('gives the faster car the longer bar', () => {
    expect(litSpeedSegments(72, 70)!).toBeGreaterThan(
      litSpeedSegments(70, 72)!
    );
  });

  it('stays inside the bar however big the difference', () => {
    expect(litSpeedSegments(90, 40)).toBe(SPEED_SEGMENT_COUNT);
    expect(litSpeedSegments(40, 90)).toBe(1);
  });

  it('draws nothing while either speed is unknown', () => {
    expect(litSpeedSegments(0, 70)).toBeNull();
  });
});

describe('formatBattleGap', () => {
  it('always carries a sign and three decimals', () => {
    expect(formatBattleGap(0.132)).toBe('+0.132');
    expect(formatBattleGap(-1.2)).toBe('-1.200');
    expect(formatBattleGap(0)).toBe('+0.000');
  });
});
