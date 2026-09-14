import { describe, expect, it } from 'vitest';

import { RootStore } from '@store/root-store';
import { WIDGETS } from '@store/widget-catalog';
import {
  DEFAULT_PREVIEW_SCENARIO_ID,
  PREVIEW_SCENARIOS,
  seedScenario,
} from './scenarios';

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
