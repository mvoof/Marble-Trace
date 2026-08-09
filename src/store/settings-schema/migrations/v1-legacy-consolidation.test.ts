import { describe, expect, it } from 'vitest';
import { v1LegacyConsolidation } from './v1-legacy-consolidation';
import type { SettingsBlob } from '../types';
import customised from '../__fixtures__/v0-customised.json';
import untouched from '../__fixtures__/v0-untouched.json';
import monitorConfigs from '../__fixtures__/v0-monitor-configs.json';
import danglingActiveLayout from '../__fixtures__/v0-dangling-active-layout.json';
import noLayouts from '../__fixtures__/v0-no-layouts.json';
import realCapture from '../__fixtures__/v0-real-capture.json';

/**
 * `v0-real-capture.json` is a genuine file written by 0.20.0, trimmed to two
 * widgets and one layout — the app block, the layout shape and every widget
 * setting in it are exactly as the release wrote them. The rest are constructed
 * from the type definitions at that tag, to reach shapes the capture happens
 * not to contain (an older layout format, hotkeys actually assigned).
 */

const run = (fixture: unknown): SettingsBlob =>
  v1LegacyConsolidation.migrate(structuredClone(fixture) as SettingsBlob);

const keyboard = (accelerator: string) => [{ kind: 'keyboard', accelerator }];

interface MigratedWidget {
  id: string;
  userSettings: Record<string, unknown>;
}

interface MigratedLayout {
  id: string;
  monitors: Array<{ name: string; bounds: { x: number; width: number } }>;
  widgets: MigratedWidget[];
  backgroundImages: Record<string, string>;
}

const layoutsOf = (blob: SettingsBlob) => blob['layouts'] as MigratedLayout[];
const widgetsOf = (blob: SettingsBlob) => blob['widgets'] as MigratedWidget[];
const appOf = (blob: SettingsBlob) => blob['app'] as Record<string, unknown>;
const bindingsOf = (blob: SettingsBlob) =>
  blob['bindings'] as Record<string, unknown>;

describe('v1 — bindings', () => {
  it('lifts app and widget hotkeys the user had set', () => {
    const bindings = bindingsOf(run(customised));

    expect(bindings['app:toggle-drag-mode']).toEqual(keyboard('F10'));
    expect(bindings['app:toggle-interact-mode']).toEqual(keyboard('F8'));
    expect(bindings['standings:cycle-view-mode']).toEqual(keyboard('F5'));
    expect(bindings['standings:scroll-up']).toEqual(keyboard('F6'));
  });

  it('ignores a hotkey the user had cleared to an empty string', () => {
    expect(
      bindingsOf(run(customised))['app:toggle-hide-all-widgets']
    ).toBeUndefined();
  });

  // Every layout carried its own copy, so switching layouts used to change the
  // bindings. Merging the copies would resurrect keys the user replaced; only
  // what the active layout showed is real.
  it('takes the active layout and drops the other layouts copies', () => {
    expect(bindingsOf(run(customised))['standings:cycle-view-mode']).toEqual(
      keyboard('F5')
    );
  });

  it('falls back to the first layout when the active one is gone', () => {
    expect(
      bindingsOf(run(danglingActiveLayout))['standings:cycle-view-mode']
    ).toEqual(keyboard('F4'));
  });

  // Overrides-only: an untouched install must come out with an empty map, so
  // every action keeps taking its default from the registry. Writing defaults
  // in here is what made the first attempt lose bindings on upgrade.
  it('writes nothing for an install that never customised a key', () => {
    expect(bindingsOf(run(untouched))).toEqual({});
  });
});

describe('v1 — layout shape', () => {
  // Load-bearing ordering: this layout has no `widgets` key at all, its widgets
  // are nested per monitor. Reading hotkeys before flattening finds nothing.
  it('lifts hotkeys out of a monitorConfigs-era layout', () => {
    const bindings = bindingsOf(run(monitorConfigs));

    expect(bindings['standings:cycle-view-mode']).toEqual(keyboard('F5'));
    expect(bindings['pit-service:fuel']).toEqual(keyboard('F7'));
  });

  it('flattens monitorConfigs into monitors laid side by side', () => {
    const [layout] = layoutsOf(run(monitorConfigs));

    expect(layout.monitors).toEqual([
      {
        name: 'DISPLAY1',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        name: 'DISPLAY2',
        bounds: { x: 1920, y: 0, width: 2560, height: 1440 },
      },
    ]);
  });

  it('offsets widget coordinates onto the flattened desktop', () => {
    const [layout] = layoutsOf(run(monitorConfigs));
    const pitService = layout.widgets.find(
      (widget) => widget.id === 'pit-service'
    );

    expect(pitService?.userSettings['x']).toBe(1940);
  });

  it('fans a single background image out to every monitor', () => {
    const [layout] = layoutsOf(run(monitorConfigs));

    expect(layout.backgroundImages).toEqual({
      DISPLAY1: 'layouts/main.png',
      DISPLAY2: 'layouts/main.png',
    });
  });

  it('leaves an already flat layout alone', () => {
    const [layout] = layoutsOf(run(customised));

    expect(layout.monitors).toEqual([
      {
        name: 'DISPLAY1',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      },
    ]);
  });
});

describe('v1 — steering lock', () => {
  it('lifts steeringLimit into the app block', () => {
    expect(appOf(run(customised))['steeringLock']).toBe(540);
  });

  it('does not overwrite a steering lock the user already has', () => {
    expect(appOf(run(untouched))['steeringLock']).toBe(900);
  });
});

describe('v1 — stripping', () => {
  it('removes the dead app fields', () => {
    const app = appOf(run(customised));

    expect(app['dragHotkey']).toBeUndefined();
    expect(app['interactHotkey']).toBeUndefined();
    expect(app['hideAllWidgetsHotkey']).toBeUndefined();
    expect(app['bindingsMigrated']).toBeUndefined();
    expect(app['startMinimized']).toBe(true);
  });

  // mergeWithDefaults would prune the top-level copies on its own, but it never
  // reaches inside layouts — those only go away if the migration removes them.
  it('removes hotkeys and steeringLimit from every layout, not just the active one', () => {
    const migrated = run(customised);

    for (const layout of layoutsOf(migrated)) {
      for (const widget of layout.widgets) {
        expect(
          widget.userSettings['viewModeHotkey'],
          layout.id
        ).toBeUndefined();
        expect(
          widget.userSettings['scrollUpHotkey'],
          layout.id
        ).toBeUndefined();
        expect(widget.userSettings['steeringLimit'], layout.id).toBeUndefined();
      }
    }

    for (const widget of widgetsOf(migrated)) {
      expect(widget.userSettings['viewModeHotkey']).toBeUndefined();
      expect(widget.userSettings['steeringLimit']).toBeUndefined();
    }
  });

  it('keeps the settings that are not being migrated', () => {
    const [layout] = layoutsOf(run(customised));
    const standings = layout.widgets.find(
      (widget) => widget.id === 'standings'
    );

    expect(standings?.userSettings).toEqual({ x: 0, y: 0 });
  });
});

describe('v1 — a real 0.20.0 file', () => {
  it('lifts the three app keys it was actually holding', () => {
    expect(bindingsOf(run(realCapture))).toEqual({
      'app:toggle-drag-mode': keyboard('F9'),
      'app:toggle-interact-mode': keyboard('F8'),
      'app:toggle-hide-all-widgets': keyboard('F10'),
    });
  });

  // 0.20 wrote a key for every hotkey field whether or not it was assigned, so
  // an empty string is the common case and means "no key", not "bind nothing".
  it('does not invent bindings for the unassigned widget hotkeys', () => {
    for (const actionId of Object.keys(bindingsOf(run(realCapture)))) {
      expect(actionId.startsWith('standings:')).toBe(false);
    }
  });

  it('leaves the settings it is not migrating exactly as they were', () => {
    const migrated = run(realCapture);
    const [layout] = layoutsOf(migrated);
    const [originalLayout] = realCapture.layouts;

    expect(migrated['sessionLayouts']).toEqual(realCapture.sessionLayouts);
    expect(migrated['units']).toEqual(realCapture.units);
    expect(migrated['defaultWidgets']).toEqual(realCapture.defaultWidgets);
    expect(layout.monitors).toEqual(originalLayout.monitors);
  });

  it('clears the legacy fields the release left behind', () => {
    const migrated = run(realCapture);

    expect(appOf(migrated)['dragHotkey']).toBeUndefined();
    expect(appOf(migrated)['steeringLock']).toBe(900);

    for (const widget of layoutsOf(migrated)[0].widgets) {
      for (const key of Object.keys(widget.userSettings)) {
        expect(key.endsWith('Hotkey'), `${widget.id}.${key}`).toBe(false);
      }
    }
  });
});

describe('v1 — degenerate files', () => {
  it('survives a file with no layouts at all', () => {
    const migrated = run(noLayouts);

    expect(bindingsOf(migrated)).toEqual({});
    expect(layoutsOf(migrated)).toEqual([]);
    expect(widgetsOf(migrated)).toEqual([]);
  });

  it('leaves unrelated top-level keys untouched', () => {
    expect(run(noLayouts)['units']).toEqual({ system: 'metric' });
  });

  it('changes nothing when run over its own output', () => {
    const once = run(customised);
    const twice = v1LegacyConsolidation.migrate(structuredClone(once));

    expect(twice).toEqual(once);
  });
});
