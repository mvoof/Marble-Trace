import { describe, expect, it } from 'vitest';

import {
  axisTicks,
  battleDistanceParts,
  battleGapParts,
  buildAxisSegments,
  distanceToTopPct,
  formatBattleDistance,
  formatBattleGap,
  glowIntensity,
  battleDriverName,
  toMeters,
  plateScale,
  PLATE_SLOT_PCT,
  resolveAxisRange,
  buildPlateGroups,
  mergedCarIdxs,
  TICK_GAP_PCT,
  type BattleOpponent,
} from './close-battle-utils';
import type { CloseBattleWidgetSettings } from '@/types/widget-settings';

/** Meters, the shipped default: a car length or two. */
const MERGE_DISTANCE = 2;

const opponentAt = (carIdx: number, longitudinalDist: number): BattleOpponent =>
  ({
    carIdx,
    longitudinalDist,
    clearance: Math.abs(longitudinalDist),
    gapSeconds: 0,
    isAhead: longitudinalDist >= 0,
    isOtherClass: false,
  }) as BattleOpponent;

describe('distanceToTopPct', () => {
  it('puts the player in the middle', () => {
    expect(distanceToTopPct(0, 50)).toBe(50);
  });

  it('sends cars ahead up and cars behind down', () => {
    expect(distanceToTopPct(25, 50)).toBeLessThan(50);
    expect(distanceToTopPct(-25, 50)).toBeGreaterThan(50);
  });

  it('keeps the full range inside the widget, edges included', () => {
    expect(distanceToTopPct(400, 50)).toBeGreaterThan(0);
    expect(distanceToTopPct(-400, 50)).toBeLessThan(100);
    expect(distanceToTopPct(50, 50)).toBe(distanceToTopPct(400, 50));
  });
});

describe('buildAxisSegments', () => {
  it('leaves a hole around every tick label', () => {
    const ticks = [{ topPct: 50, label: 25 }];
    const segments = buildAxisSegments(ticks);

    expect(segments).toEqual([
      { topPct: 0, heightPct: 50 - TICK_GAP_PCT / 2 },
      { topPct: 50 + TICK_GAP_PCT / 2, heightPct: 50 - TICK_GAP_PCT / 2 },
    ]);
  });

  it('draws one unbroken line when no ticks are shown', () => {
    expect(buildAxisSegments([])).toEqual([{ topPct: 0, heightPct: 100 }]);
  });

  it('never overlaps a label of a real tick set', () => {
    const ticks = axisTicks(50, true);
    const segments = buildAxisSegments(ticks);

    for (const tick of ticks) {
      const covering = segments.find(
        (segment) =>
          segment.topPct < tick.topPct &&
          segment.topPct + segment.heightPct > tick.topPct
      );

      expect(covering).toBeUndefined();
    }
  });
});

describe('axisTicks', () => {
  it('mirrors every tick around the player', () => {
    const ticks = axisTicks(50, true);

    expect(ticks.map((tick) => tick.label)).toEqual([50, 25, 25, 50]);
    expect(ticks[0].topPct).toBe(100 - ticks[3].topPct);
  });

  it('labels an imperial axis in round feet', () => {
    // The ±150 ft rung of the imperial ladder, in the meters the axis works in.
    const range = toMeters(150, false);

    expect(axisTicks(range, false).map((tick) => tick.label)).toEqual([
      150, 100, 50, 50, 100, 150,
    ]);
  });
});

describe('formatBattleGap', () => {
  it('keeps the Relative convention: ahead negative, behind positive', () => {
    expect(formatBattleGap(-0.21)).toBe('-0.21');
    expect(formatBattleGap(1.05)).toBe('+1.05');
  });
});

describe('formatBattleDistance', () => {
  it('renders meters or feet', () => {
    expect(formatBattleDistance(45, true)).toBe('45 m');
    expect(formatBattleDistance(45, false)).toBe('148 ft');
  });
});

describe('battleGapParts', () => {
  it('splits at the point so the digits either side stay put', () => {
    expect(battleGapParts(1.05)).toEqual({ whole: '+1', fraction: '05' });
    expect(battleGapParts(-12.4)).toEqual({ whole: '-12', fraction: '40' });
  });
});

describe('battleDistanceParts', () => {
  it('keeps the unit in a slot of its own', () => {
    expect(battleDistanceParts(45, true)).toEqual({ value: '45', unit: 'm' });
    expect(battleDistanceParts(45, false)).toEqual({
      value: '148',
      unit: 'ft',
    });
  });
});

describe('battleDriverName', () => {
  it('keeps the surname in every mode', () => {
    expect(battleDriverName('Ayrton Senna', 'surname')).toEqual({
      givenName: '',
      surname: 'Senna',
    });
    expect(battleDriverName('Ayrton Senna', 'initial').givenName).toBe('A.');
    expect(battleDriverName('Ayrton Senna', 'full').givenName).toBe('Ayrton');
  });

  it('leaves a single-word name alone', () => {
    expect(battleDriverName('Senna', 'full')).toEqual({
      givenName: '',
      surname: 'Senna',
    });
  });
});

describe('plateScale', () => {
  it('never shrinks a plate past a third', () => {
    expect(plateScale(0)).toBe(1);
    expect(plateScale(50)).toBeCloseTo(2 / 3);
    expect(plateScale(500)).toBeCloseTo(2 / 3);
  });

  it('scales by meters, not by where the car sits on the axis', () => {
    // A car five metres away is the same size whatever the axis is showing.
    expect(plateScale(5)).toBeCloseTo(0.967, 3);
    expect(plateScale(25)).toBeCloseTo(0.833, 3);
  });
});

describe('glowIntensity', () => {
  it('builds from nothing at the range to full in the bumper', () => {
    expect(glowIntensity(30, 30)).toBe(0);
    expect(glowIntensity(15, 30)).toBeCloseTo(0.5);
    expect(glowIntensity(0, 30)).toBe(1);
  });

  it('is off when the range is zero', () => {
    expect(glowIntensity(1, 0)).toBe(0);
  });
});

describe('buildPlateGroups', () => {
  it('leaves a lone plate on its true position', () => {
    const groups = buildPlateGroups(
      [opponentAt(1, -8)],
      50,
      true,
      MERGE_DISTANCE
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].topPct).toBeCloseTo(distanceToTopPct(-8, 50));
    expect(groups[0].merged).toEqual([]);
  });

  it('merges cars that land in the same spot into one plate', () => {
    const groups = buildPlateGroups(
      [opponentAt(1, 40), opponentAt(2, 41)],
      50,
      true,
      MERGE_DISTANCE
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].leader.carIdx).toBe(1);
    expect(groups[0].merged.map((one) => one.carIdx)).toEqual([2]);
  });

  it('pushes them apart instead when merging is off', () => {
    const groups = buildPlateGroups(
      [opponentAt(1, 40), opponentAt(2, 41)],
      50,
      false,
      MERGE_DISTANCE
    );

    expect(groups).toHaveLength(2);
    expect(
      Math.abs(groups[0].topPct - groups[1].topPct)
    ).toBeGreaterThanOrEqual(PLATE_SLOT_PCT);
  });

  it('keeps every plate inside the widget', () => {
    const groups = buildPlateGroups(
      [opponentAt(1, 500), opponentAt(2, -500)],
      50,
      false,
      MERGE_DISTANCE
    );

    for (const group of groups) {
      expect(group.topPct).toBeGreaterThanOrEqual(PLATE_SLOT_PCT / 2);
      expect(group.topPct).toBeLessThanOrEqual(100 - PLATE_SLOT_PCT / 2);
    }
  });
});

describe('resolveAxisRange', () => {
  const gap = (gapThreshold: number) =>
    ({ trigger: 'gap', gapThreshold }) as CloseBattleWidgetSettings;
  const distance = (distanceThreshold: number) =>
    ({ trigger: 'distance', distanceThreshold }) as CloseBattleWidgetSettings;

  it('derives the range from a distance threshold, whatever is on screen', () => {
    expect(resolveAxisRange(distance(50), true)).toBe(50);
  });

  it('never collapses the axis on a tiny distance threshold', () => {
    expect(resolveAxisRange(distance(1), true)).toBe(5);
  });

  it('derives a fixed range from a gap threshold', () => {
    // Two seconds at the reference speed is 100 m — the ±100 m rung.
    expect(resolveAxisRange(gap(2), true)).toBe(100);
  });

  it('keeps the same range whoever is on the axis', () => {
    expect(resolveAxisRange(gap(1), true)).toBe(resolveAxisRange(gap(1), true));
    expect(resolveAxisRange(gap(1), true)).toBe(50);
  });

  it('climbs the imperial ladder when the unit system is feet', () => {
    expect(resolveAxisRange(distance(20), false)).toBeCloseTo(
      toMeters(75, false),
      3
    );
  });

  it('never goes past the widest step', () => {
    expect(resolveAxisRange(gap(30), true)).toBe(200);
  });
});

describe('merge hysteresis', () => {
  it('keeps a merged pair together while they drift just past the threshold', () => {
    const together = buildPlateGroups(
      [opponentAt(1, 40), opponentAt(2, 41)],
      50,
      true,
      MERGE_DISTANCE
    );

    const held = mergedCarIdxs(together);

    expect(held.has(2)).toBe(true);

    // Far enough apart to be two plates on a first sighting...
    const drifted = [opponentAt(1, 40), opponentAt(2, 43)];

    expect(buildPlateGroups(drifted, 50, true, MERGE_DISTANCE)).toHaveLength(2);

    // ...but they were merged a tick ago, so they stay one plate.
    expect(
      buildPlateGroups(drifted, 50, true, MERGE_DISTANCE, held)
    ).toHaveLength(1);
  });

  it('splits once they are clearly apart', () => {
    const held = new Set([2]);

    const groups = buildPlateGroups(
      [opponentAt(1, 40), opponentAt(2, -40)],
      50,
      true,
      MERGE_DISTANCE,
      held
    );

    expect(groups).toHaveLength(2);
  });

  it('gives a group a key that survives its cars moving', () => {
    const first = buildPlateGroups(
      [opponentAt(4, 40), opponentAt(2, 41)],
      50,
      true,
      MERGE_DISTANCE
    );

    const second = buildPlateGroups(
      [opponentAt(4, 41), opponentAt(2, 41)],
      50,
      true,
      MERGE_DISTANCE
    );

    expect(first[0].key).toBe(second[0].key);
  });
});

describe('merge distance', () => {
  it('leaves cars apart on the track as separate plates, however close the axis draws them', () => {
    // Six metres apart on a ±200 m axis: the plates would overlap, but the cars
    // are not side by side, so they stay two plates and get pushed apart.
    const groups = buildPlateGroups(
      [opponentAt(1, 100), opponentAt(2, 106)],
      200,
      true,
      MERGE_DISTANCE
    );

    expect(groups).toHaveLength(2);
  });

  it('follows the setting rather than the plate size', () => {
    const cars = [opponentAt(1, 100), opponentAt(2, 106)];

    expect(buildPlateGroups(cars, 200, true, 8)).toHaveLength(1);
  });
});
