import { observable, runInAction } from 'mobx';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimPerfFrame } from '@/types/bindings';
import type { RootStore } from '@store/root-store';
import { FpsDiagnosticsStore } from './fps-diagnostics.store';

// The banner is a real Tauri window; the state machine under test is the point.
vi.mock('@platform/services/diagnostics-hud.service', () => ({
  DIAGNOSTICS_HUD_STATE_EVENT: 'diagnostics-hud-state',
  openDiagnosticsHud: vi.fn().mockResolvedValue(undefined),
  closeDiagnosticsHud: vi.fn().mockResolvedValue(undefined),
  emitDiagnosticsHudState: vi.fn().mockResolvedValue(undefined),
}));

const WIDGET_IDS = ['fuel', 'standings'];

/** Mirrors the constants in the store; a run is 4 rounds of settle + sample. */
const ROUNDS = 4;
const STEP_SECONDS = 5 + 12;
const COUNTDOWN_SECONDS = 8;

interface FakeRoot {
  root: RootStore;
  enabled: Map<string, boolean>;
  hideAll: () => boolean;
  pushCounter: (frame: SimPerfFrame) => void;
}

const makeRoot = (): FakeRoot => {
  const enabled = new Map(WIDGET_IDS.map((id) => [id, true]));
  const appSettings = { hideAllWidgets: false, language: 'en' };

  // The store observes `root.simPerf.simPerf` through a MobX reaction, so the
  // fake has to be observable exactly as the real data store is — a plain
  // object here would leave the reaction silent and every run would stall.
  const simPerf = observable.object<{ simPerf: SimPerfFrame | null }>(
    { simPerf: null },
    { simPerf: observable.ref }
  );

  const root = {
    widgetSettings: {
      get enabledWidgetIds() {
        return WIDGET_IDS.filter((id) => enabled.get(id));
      },
      setWidgetEnabled: (id: string, value: boolean) => {
        enabled.set(id, value);
      },
    },
    appSettings: {
      appSettings,
      setHideAllWidgets: (value: boolean) => {
        appSettings.hideAllWidgets = value;
      },
    },
    simPerf,
  } as unknown as RootStore;

  return {
    root,
    enabled,
    hideAll: () => appSettings.hideAllWidgets,
    pushCounter: (frame) => {
      runInAction(() => {
        simPerf.simPerf = frame;
      });
    },
  };
};

describe('FpsDiagnosticsStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses to start with no widgets enabled', () => {
    const fake = makeRoot();

    for (const id of WIDGET_IDS) {
      fake.enabled.set(id, false);
    }

    const store = new FpsDiagnosticsStore(fake.root);

    store.start();

    expect(store.phase).toBe('failed');
    expect(store.error).toBe('noWidgets');
  });

  it('plans three steps by default and one more per widget when detailed', () => {
    const store = new FpsDiagnosticsStore(makeRoot().root);

    expect(store.plannedSteps).toHaveLength(3);

    store.setDetailed(true);

    expect(store.plannedSteps).toHaveLength(3 + WIDGET_IDS.length);
  });

  it('counts down before touching the configuration', () => {
    const fake = makeRoot();
    const store = new FpsDiagnosticsStore(fake.root);

    store.start();

    expect(store.phase).toBe('countdown');
    expect(fake.enabled.get('fuel')).toBe(true);

    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    expect(store.phase).toBe('settling');
    // First step is the no-overlay baseline.
    expect(fake.enabled.get('fuel')).toBe(false);
  });

  it('restores the original configuration when cancelled mid-run', () => {
    const fake = makeRoot();
    const store = new FpsDiagnosticsStore(fake.root);

    store.start();
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    expect(fake.enabled.get('standings')).toBe(false);

    store.cancel();

    expect(store.phase).toBe('idle');
    expect(fake.enabled.get('fuel')).toBe(true);
    expect(fake.enabled.get('standings')).toBe(true);
    expect(fake.hideAll()).toBe(false);
  });

  it('walks every step in each round and produces one result row per step', () => {
    const fake = makeRoot();
    const store = new FpsDiagnosticsStore(fake.root);

    store.start();

    const totalSeconds =
      COUNTDOWN_SECONDS + store.plannedSteps.length * ROUNDS * STEP_SECONDS;

    for (let second = 0; second < totalSeconds; second += 1) {
      fake.pushCounter({ frame_rate: 60, gpu_usage: 0.5, cpu_usage_fg: 0.4 });
      vi.advanceTimersByTime(1000);
    }

    expect(store.phase).toBe('done');
    expect(store.results).toHaveLength(3);

    for (const result of store.results) {
      expect(result.frameRate?.median).toBe(60);
      // Fractions are converted to percent for display.
      expect(result.gpuUsage?.median).toBeCloseTo(50);
      expect(result.cpuUsage?.median).toBeCloseTo(40);
    }

    expect(fake.enabled.get('fuel')).toBe(true);
    expect(fake.hideAll()).toBe(false);
  });

  it('fails and restores when the sim never reports a counter', () => {
    const fake = makeRoot();
    const store = new FpsDiagnosticsStore(fake.root);

    store.start();
    vi.advanceTimersByTime((COUNTDOWN_SECONDS + STEP_SECONDS * 3) * 1000);

    expect(store.phase).toBe('failed');
    expect(store.error).toBe('noTelemetry');
    expect(fake.enabled.get('fuel')).toBe(true);
  });
});
