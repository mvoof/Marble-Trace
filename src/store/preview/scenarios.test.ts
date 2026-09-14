import { describe, expect, it } from 'vitest';

import type { FlagType } from '@/types';
import { RootStore } from '@store/root-store';
import { WIDGETS } from '@store/widget-catalog';
import {
  DEFAULT_PREVIEW_SCENARIO_ID,
  PREVIEW_SCENARIOS,
  seedScenario,
} from './scenarios';

// The limiter's bit in the engine warning mask. Spelled out rather than
// imported: it is declared in the UI layer, which the preview module may not
// reach into.
const PIT_LIMITER_BIT = 0x10;

const seed = (scenarioId: string) => {
  const store = new RootStore({ skipInit: true });

  seedScenario(store, scenarioId);

  return store;
};

// The scenario seam is the highest point all four consumers go through, so the
// assertions are about what ends up in the store — never about which builder
// composed it.
describe('fuel scenarios', () => {
  it('opens the pit window and warns', () => {
    const fuel = seed('fuel-pit-window').backendComputed.fuel;

    expect(fuel?.pitWarning).toBe(true);
    expect(fuel?.pitWindowStart).not.toBeNull();
    expect(fuel?.pitWindowEnd).not.toBeNull();
  });

  it('runs the tank short of the finish', () => {
    const fuel = seed('fuel-short').backendComputed.fuel;

    expect(fuel?.shortage).toBeLessThan(0);
    expect(fuel?.lapsRemaining).toBeLessThan(fuel?.lapsToFinish ?? 0);
    expect(fuel?.fuelSavePerLap).toBeGreaterThan(0);
  });

  it('plans a refuel across more than one stop', () => {
    const fuel = seed('fuel-refuel-calc').backendComputed.fuel;

    expect(fuel?.refuelPlan?.stops).toBeGreaterThan(1);
    expect(fuel?.fuelToAddWithBuffer ?? 0).toBeGreaterThan(
      fuel?.fuelToAdd ?? 0
    );
  });

  it('leaves the widget settings alone', () => {
    const store = new RootStore({ skipInit: true });
    const before = JSON.stringify(store.liveWidgets.widgets);

    seedScenario(store, 'fuel-short');

    expect(JSON.stringify(store.liveWidgets.widgets)).toBe(before);
  });
});

// Flag display is mirrored by the seeding rather than derived: the hold and
// blink reactions never run in a store built with initialisation skipped, so
// what the widgets read is `displayFlags` / `ledDisplayFlag`, not the parse.
describe('flag scenarios', () => {
  const cases: Array<[string, FlagType]> = [
    ['yellow-flag', 'yellow'],
    ['safety-car', 'sc'],
    ['blue-flag', 'blue'],
    ['black-flag', 'black'],
    ['dq-flag', 'dq'],
    ['green-flag', 'green'],
    ['white-flag', 'white'],
    ['checkered-flag', 'checkered'],
    ['red-flag', 'red'],
    ['meatball-flag', 'meatball'],
    ['debris-flag', 'debris'],
  ];

  for (const [scenarioId, flag] of cases) {
    it(`shows ${flag} for ${scenarioId}`, () => {
      const store = seed(scenarioId);

      expect(store.flags.displayFlags).toContain(flag);
      expect(store.flags.ledDisplayFlag).toBe(flag);
    });
  }

  it('raises nothing but the flag it is named after', () => {
    const store = seed('meatball-flag');

    expect(store.flags.displayFlags).toEqual(['meatball']);
  });

  it('leaves the rest of the base snapshot alone', () => {
    const baseline = seed(DEFAULT_PREVIEW_SCENARIO_ID);
    const black = seed('black-flag');

    expect(black.backendComputed.fuel).toEqual(baseline.backendComputed.fuel);
    expect(black.player.carDynamics).toEqual(baseline.player.carDynamics);
  });
});

// The pit lane's geometry is only ever learned by driving through the pits, so
// without it the lane bar, the pitbox marker and the box countdown draw nothing
// — on the pit line widget and on the race dash alike.
describe('pit scenarios', () => {
  it('puts a recorded lane under the base snapshot', () => {
    const store = seed(DEFAULT_PREVIEW_SCENARIO_ID);

    expect(store.pitServiceWidget.pitLaneLengthM).toBeGreaterThan(200);
    expect(store.pitServiceWidget.pitboxLanePct).toBeGreaterThan(0);
    expect(store.pitServiceWidget.pitboxLanePct).toBeLessThan(1);
  });

  it('rolls the car down the lane towards its stall', () => {
    const store = seed('pit-lane');

    expect(store.player.carStatus?.on_pit_road).toBe(true);
    expect(store.player.hasPitLaneProgress).toBe(true);
    expect(store.player.pitTargetType).toBe('pitbox');
    expect(store.player.pitTargetDistM).toBeGreaterThan(0);
  });

  it('arms the limiter only where the scenario says so', () => {
    const off = seed('pit-lane').player.carStatus?.engine_warnings ?? 0;
    const on = seed('pit-limiter').player.carStatus?.engine_warnings ?? 0;

    expect(off & PIT_LIMITER_BIT).toBe(0);
    expect(on & PIT_LIMITER_BIT).toBe(PIT_LIMITER_BIT);
  });

  it('counts down to the exit once the stall is behind the car', () => {
    const store = seed('pit-over-limit');

    expect(store.player.pitTargetType).toBe('pitExit');
    expect(store.player.pitLaneProgressPct ?? 0).toBeGreaterThan(
      store.pitServiceWidget.pitboxLanePct ?? 1
    );
  });
});

// The standings read their gap off `f2Time` and the relative off `estTime`, so
// a field scenario is only right if both widgets end up describing the same
// grid. The assertions are about what is in the store, never about how the
// builder composed it.
describe('field scenarios', () => {
  const LONGEST_NAME_LENGTH = 31;

  it('fills the grid with more cars than the snapshot recorded', () => {
    const baseline = seed(DEFAULT_PREVIEW_SCENARIO_ID);
    const store = seed('field-multiclass');
    const entries = store.backendComputed.driverEntries?.entries ?? [];

    expect(entries.length).toBeGreaterThan(
      baseline.backendComputed.driverEntries?.entries.length ?? 0
    );
    expect(new Set(entries.map((entry) => entry.carIdx)).size).toBe(
      entries.length
    );
  });

  it('puts every class on the grid at once', () => {
    const entries =
      seed('field-multiclass').backendComputed.driverEntries?.entries ?? [];
    const badges = new Set(entries.map((entry) => entry.carClassShortName));

    expect(badges.size).toBeGreaterThan(2);

    for (const entry of entries) {
      expect(entry.carClassColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('carries the longest names a real field holds', () => {
    const entries =
      seed('field-multiclass').backendComputed.driverEntries?.entries ?? [];
    const longest = Math.max(...entries.map((entry) => entry.userName.length));

    expect(longest).toBe(LONGEST_NAME_LENGTH);
  });

  it('packs the field inside a second', () => {
    const store = seed('field-close-pack');
    const entries = store.backendComputed.driverEntries?.entries ?? [];
    const gaps = entries
      .slice(1)
      .map((entry, index) => entry.f2Time - (entries[index]?.f2Time ?? 0));

    expect(gaps.length).toBeGreaterThan(0);

    for (const gap of gaps) {
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThan(1);
    }
  });

  it('spaces the relative from the same gap the standings show', () => {
    const store = seed('field-close-pack');
    const relative = store.backendComputed.relative;
    const entries = relative?.entries ?? [];
    const playerRow = entries.findIndex((entry) => entry.isPlayer);
    // The row directly above the player's in the strip is the car it is
    // actually racing, and that is the gap the close pack is about.
    const ahead = entries[playerRow - 1];
    const player = entries[playerRow];

    expect(player).toBeDefined();
    expect(ahead).toBeDefined();
    expect(ahead?.relativeLapDist ?? 0).toBeGreaterThan(0);
    expect(
      Math.abs((ahead?.estTime ?? 0) - (player?.estTime ?? 0))
    ).toBeLessThan(1);
  });

  it('sorts the relative by track order and the standings by position', () => {
    const store = seed('field-multiclass');
    const standings = store.backendComputed.driverEntries?.entries ?? [];
    const relative = store.backendComputed.relative?.entries ?? [];

    expect(standings.map((entry) => entry.position)).toEqual(
      standings.map((_entry, index) => index + 1)
    );

    for (const [index, entry] of relative.slice(1).entries()) {
      expect(entry.relativeLapDist).toBeLessThanOrEqual(
        relative[index]?.relativeLapDist ?? 1
      );
    }
  });

  it('shows cars on pit road and stopped in the box', () => {
    const entries =
      seed('field-pit-states').backendComputed.driverEntries?.entries ?? [];
    const states = new Set(entries.map((entry) => entry.pitState));

    expect(states).toContain('in');
    expect(states).toContain('stall');
    expect(states).toContain('exit');

    for (const entry of entries) {
      if (entry.pitState !== 'none') {
        expect(entry.onPitRoad).toBe(true);
      }
    }
  });

  it('keeps the typical field ordinary beside the worst case', () => {
    const worst =
      seed('field-multiclass').backendComputed.driverEntries?.entries ?? [];
    const typical =
      seed('field-typical').backendComputed.driverEntries?.entries ?? [];

    expect(typical.length).toBeLessThan(worst.length);
    expect(new Set(typical.map((entry) => entry.carClassShortName)).size).toBe(
      1
    );
    expect(
      Math.max(...typical.map((entry) => entry.userName.length))
    ).toBeLessThan(LONGEST_NAME_LENGTH);
  });

  // A big grid spans more than a lap, so the relative strip does fold its tail
  // back alongside the leaders — that is what a relative looks like in traffic.
  // What must never happen is a fold with nothing marking it: a row drawn on
  // the player's bumper while the standings report it two minutes down.
  it('marks every car it folds back into the strip as a lap down', () => {
    for (const scenarioId of ['field-multiclass', 'field-pit-states']) {
      const store = seed(scenarioId);
      const relative = store.backendComputed.relative?.entries ?? [];

      expect(relative.length).toBeGreaterThan(0);

      for (const [index, entry] of relative.slice(1).entries()) {
        const previous = relative[index];

        if (!previous || entry.position > previous.position) {
          continue;
        }

        expect(
          entry.lap,
          `${scenarioId} folds position ${entry.position} back on the same lap`
        ).not.toBe(previous.lap);
      }
    }
  });

  it('runs the leader further than the car it has lapped', () => {
    const entries =
      seed('field-multiclass').backendComputed.driverEntries?.entries ?? [];
    const leader = entries[0];
    const last = entries[entries.length - 1];

    expect(leader?.lap ?? 0).toBeGreaterThan(last?.lap ?? 0);

    for (const [index, entry] of entries.slice(1).entries()) {
      expect(entry.lap).toBeLessThanOrEqual(entries[index]?.lap ?? 0);
    }
  });

  it('gives every row a name of its own', () => {
    const entries =
      seed('field-multiclass').backendComputed.driverEntries?.entries ?? [];
    const names = new Set(entries.map((entry) => entry.userName));

    expect(names.size).toBe(entries.length);
  });

  it('leaves nobody in the pits but the rows it badges', () => {
    const entries =
      seed('field-pit-states').backendComputed.driverEntries?.entries ?? [];
    const pitted = entries.filter((entry) => entry.onPitRoad);

    expect(pitted).toHaveLength(3);

    for (const entry of pitted) {
      expect(entry.pitState).not.toBe('none');
    }
  });

  it('keeps the player on a field it had to shrink', () => {
    const frame = seed('field-typical').backendComputed.driverEntries;
    const players = (frame?.entries ?? []).filter((entry) => entry.isPlayer);

    expect(players).toHaveLength(1);
    expect(players[0]?.carIdx).toBe(frame?.playerCarIdx);
  });

  it('leaves the player on the grid it rebuilt', () => {
    const frame = seed('field-multiclass').backendComputed.driverEntries;
    const players = (frame?.entries ?? []).filter((entry) => entry.isPlayer);

    expect(players).toHaveLength(1);
    expect(players[0]?.carIdx).toBe(frame?.playerCarIdx);
  });
});

// The picker re-seeds the same preview store, so going back to the baseline has
// to undo whatever the previous pick forced — the seed puts back the frames it
// sets, and clears the ones no baseline frame covers.
describe('returning to the baseline', () => {
  it('clears a scenario that was picked before it', () => {
    const store = new RootStore({ skipInit: true });

    seedScenario(store, 'pit-limiter');
    seedScenario(store, 'driving-coach-brake');
    seedScenario(store, 'meatball-flag');
    seedScenario(store, DEFAULT_PREVIEW_SCENARIO_ID);

    expect(store.player.hasPitLaneProgress).toBe(false);
    expect(store.referenceLap.data).toBeNull();
    expect(store.drivingCoachWidget.displayedAdvisory).toBe('neutral');
    // The snapshot's own flag, not the meatball that was picked over it.
    expect(store.flags.displayFlags).toEqual(
      seed(DEFAULT_PREVIEW_SCENARIO_ID).flags.displayFlags
    );
  });

  it('matches a store that never left it', () => {
    const visited = new RootStore({ skipInit: true });

    seedScenario(visited, 'red-flag');
    seedScenario(visited, DEFAULT_PREVIEW_SCENARIO_ID);

    const untouched = seed(DEFAULT_PREVIEW_SCENARIO_ID);

    expect(visited.player.carStatus).toEqual(untouched.player.carStatus);
    expect(visited.backendComputed.proximity).toEqual(
      untouched.backendComputed.proximity
    );
  });
});

describe('an unknown scenario', () => {
  it('falls back to the baseline rather than showing nothing', () => {
    const fallback = seed('no-such-scenario').backendComputed.fuel;
    const baseline = seed(DEFAULT_PREVIEW_SCENARIO_ID).backendComputed.fuel;

    expect(fallback).toEqual(baseline);
  });
});

// Pairs the registry and the manifests in both directions, the way the widget
// catalog and widget registry tests already pair two globs.
describe('scenario declarations', () => {
  const declared = new Map<string, string>();

  for (const manifest of WIDGETS) {
    for (const scenarioId of manifest.previewScenarios ?? []) {
      declared.set(scenarioId, manifest.id);
    }
  }

  it('declares only scenarios the registry ships', () => {
    const shipped = new Set(PREVIEW_SCENARIOS.map((scenario) => scenario.id));

    for (const [scenarioId, widgetId] of declared) {
      expect(shipped, `${widgetId} declares ${scenarioId}`).toContain(
        scenarioId
      );
    }
  });

  it('ships only scenarios some widget declares', () => {
    for (const scenario of PREVIEW_SCENARIOS) {
      if (scenario.id === DEFAULT_PREVIEW_SCENARIO_ID) {
        continue;
      }

      expect(
        declared.has(scenario.id),
        `no widget declares ${scenario.id}`
      ).toBe(true);
    }
  });

  it('never declares the same scenario twice in one manifest', () => {
    for (const manifest of WIDGETS) {
      const scenarios = manifest.previewScenarios ?? [];

      expect(new Set(scenarios).size, manifest.id).toBe(scenarios.length);
    }
  });
});
