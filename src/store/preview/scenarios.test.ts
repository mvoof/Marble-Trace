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
