import { describe, expect, it, vi } from 'vitest';
import { mergeWithDefaults } from '@utils/deep-merge';
import { WIDGET_BY_ID } from '@store/widget-defaults';
import { AppSettingsStore } from '@store/settings/app-settings.store';
import { BindingsStore } from '@store/hotkeys/bindings.store';
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

describe('v1 — bindings', () => {
  // The old keys are not carried over. They meant "while this layout is active"
  // and would now mean "always"; each layout held a different copy with no right
  // answer as to which wins; and one accelerator per action does not map onto a
  // model that takes any number of keys and device buttons. Everyone starts from
  // the shipped defaults instead.
  it.each([
    ['a customised install', customised],
    ['an untouched install', untouched],
    ['an install whose active layout is gone', danglingActiveLayout],
  ])('writes no bindings for %s', (_label, fixture) => {
    expect(run(fixture)['bindings']).toBeUndefined();
  });

  // Nothing is written, so the store layers the registry defaults underneath and
  // drag, interact and hide-all keep working without the migration saying a word.
  it('leaves the defaults to the registry', () => {
    const store = new BindingsStore();

    store.applyBindings(run(customised)['bindings'] as undefined);

    expect(store.bindingsFor('app:toggle-drag-mode')).toEqual([
      { kind: 'keyboard', accelerator: 'F9' },
    ]);
  });
});

describe('v1 — layout shape', () => {
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

    for (const layout of layoutsOf(migrated)) {
      for (const widget of layout.widgets) {
        for (const key of Object.keys(widget.userSettings)) {
          expect(key.endsWith('Hotkey'), `${layout.id}/${key}`).toBe(false);
        }
      }
    }
  });

  // Two layouts, each with its own set of standings keys, one of them holding a
  // key the active layout never had. All of them go; none is promoted.
  it('drops the per-layout keys from both layouts alike', () => {
    const migrated = run(realCapture);

    expect(migrated['bindings']).toBeUndefined();
    expect(layoutsOf(migrated)).toHaveLength(2);
  });

  it('keeps the backgrounds and monitors of every layout', () => {
    const migrated = run(realCapture);

    layoutsOf(migrated).forEach((layout, index) => {
      expect(layout.backgroundImages).toEqual(
        realCapture.layouts[index]?.backgroundImages
      );
      expect(layout.monitors).toEqual(realCapture.layouts[index]?.monitors);
    });
  });
});

describe('v1 — survives the rest of the load pipeline', () => {
  // mergeWithDefaults runs after the chain and resets any field whose type no
  // longer matches its default, warning as it goes. A migration that writes the
  // wrong type would have its work silently undone; the warning is the only
  // signal, so the test listens for it.
  it('writes nothing mergeWithDefaults would reject', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const migrated = run(realCapture);

      mergeWithDefaults(
        new AppSettingsStore().appSettings as unknown as Record<
          string,
          unknown
        >,
        appOf(migrated)
      );

      for (const widget of widgetsOf(migrated)) {
        const defaults = WIDGET_BY_ID.get(widget.id)?.userSettings;

        if (!defaults) continue;

        mergeWithDefaults(
          defaults as unknown as Record<string, unknown>,
          widget.userSettings
        );
      }

      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('v1 — degenerate files', () => {
  it('survives a file with no layouts at all', () => {
    const migrated = run(noLayouts);

    expect(migrated['bindings']).toBeUndefined();
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
