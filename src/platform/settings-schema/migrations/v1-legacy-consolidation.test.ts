import { describe, expect, it, vi } from 'vitest';
import { mergeWithDefaults } from '@store/deep-merge';
import { WIDGET_BY_ID } from '@store/widget-catalog';
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
import brokenMonitorConfigs from '../__fixtures__/v0-broken-monitor-configs.json';

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

  // The step reads shapes no current type describes, out of a file the user may
  // have hand-edited. Throwing reaches the loader as "unreadable" and locks the
  // whole settings file — far worse than one screen coming back the wrong size.
  it('survives a half-written legacy file without throwing', () => {
    expect(() => run(brokenMonitorConfigs)).not.toThrow();
  });

  it('drops layout entries that are not objects', () => {
    expect(
      layoutsOf(run(brokenMonitorConfigs)).map((layout) => layout.id)
    ).toEqual(['half-written', 'no-resolution']);
  });

  it('keeps the widgets of a monitor whose resolution is missing', () => {
    const layout = layoutsOf(run(brokenMonitorConfigs)).find(
      (candidate) => candidate.id === 'half-written'
    );

    expect(layout?.monitors).toEqual([
      { name: 'DISPLAY1', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      { name: 'DISPLAY2', bounds: { x: 1920, y: 0, width: 0, height: 0 } },
    ]);
    expect(layout?.widgets).toEqual([
      { id: 'standings', userSettings: { x: 1960 } },
    ]);
  });

  it('falls back to a zero-sized monitor when the resolution has no numbers', () => {
    const layout = layoutsOf(run(brokenMonitorConfigs)).find(
      (candidate) => candidate.id === 'no-resolution'
    );

    expect(layout?.monitors).toEqual([
      { name: 'DISPLAY1', bounds: { x: 0, y: 0, width: 0, height: 0 } },
    ]);
    expect(layout?.widgets).toEqual([
      { id: 'fuel', userSettings: { x: 10, y: 20 } },
    ]);
  });

  it('changes nothing when run over its own output', () => {
    const once = run(customised);
    const twice = v1LegacyConsolidation.migrate(structuredClone(once));

    expect(twice).toEqual(once);
  });
});

const raceDash = (overrides: Record<string, unknown> = {}) => ({
  id: 'race-dash',
  userSettings: {
    enabled: true,
    x: 400,
    y: 100,
    currentWidth: 430,
    currentHeight: 104,
    showReferenceSpeed: true,
    brakeColor: '#ff0000',
    gasColor: '#00ff00',
    pitBoxSide: 'left',
    rpmColorLow: '#10b981',
    ...overrides,
  },
});

const findWidget = (widgets: unknown, id: string) =>
  (widgets as { id?: string; userSettings?: Record<string, unknown> }[]).find(
    (widget) => widget.id === id
  );

describe('v1LegacyConsolidation: coach split out of race dash', () => {
  it('drops the coach keys from race dash', () => {
    const result = v1LegacyConsolidation.migrate({ widgets: [raceDash()] });
    const settings = findWidget(result['widgets'], 'race-dash')?.userSettings;

    expect(settings).not.toHaveProperty('showReferenceSpeed');
    expect(settings).not.toHaveProperty('brakeColor');
    expect(settings).not.toHaveProperty('gasColor');
    // The pit box side went with the block that used to mirror its layout.
    expect(settings).not.toHaveProperty('pitBoxSide');
    // Unrelated settings must survive untouched.
    expect(settings?.['rpmColorLow']).toBe('#10b981');
  });

  it('resizes the plate to the width this build draws', () => {
    const result = v1LegacyConsolidation.migrate({ widgets: [raceDash()] });

    expect(
      findWidget(result['widgets'], 'race-dash')?.userSettings?.['currentWidth']
    ).toBe(418);
  });

  it('keeps the scale the user resized the plate to', () => {
    const result = v1LegacyConsolidation.migrate({
      widgets: [raceDash({ currentWidth: 860, currentHeight: 208 })],
    });

    expect(
      findWidget(result['widgets'], 'race-dash')?.userSettings?.['currentWidth']
    ).toBe(836);
  });

  it('leaves a dash that never carried the coach keys at its stored width', () => {
    const result = v1LegacyConsolidation.migrate({
      widgets: [
        {
          id: 'race-dash',
          userSettings: {
            enabled: true,
            currentWidth: 334,
            currentHeight: 104,
          },
        },
      ],
    });

    expect(
      findWidget(result['widgets'], 'race-dash')?.userSettings?.['currentWidth']
    ).toBe(334);
  });

  it('seeds a coach widget carrying the accent colors when the tab was on', () => {
    const result = v1LegacyConsolidation.migrate({ widgets: [raceDash()] });
    const coach = findWidget(result['widgets'], 'coach')?.userSettings;

    expect(coach?.['enabled']).toBe(true);
    expect(coach?.['brakeColor']).toBe('#ff0000');
    expect(coach?.['gasColor']).toBe('#00ff00');
    expect(coach?.['lossColor']).toBe('#ff0000');
    expect(coach?.['gainColor']).toBe('#00ff00');
    // Parked directly under the dash it came out of.
    expect(coach?.['y']).toBe(204);
  });

  it('adds no coach widget when the tab was off', () => {
    const result = v1LegacyConsolidation.migrate({
      widgets: [raceDash({ showReferenceSpeed: false })],
    });

    expect(findWidget(result['widgets'], 'coach')).toBeUndefined();
  });

  it('adds no coach widget when race dash itself was disabled', () => {
    const result = v1LegacyConsolidation.migrate({
      widgets: [raceDash({ enabled: false })],
    });

    expect(findWidget(result['widgets'], 'coach')).toBeUndefined();
  });

  it('never adds a second coach widget', () => {
    const result = v1LegacyConsolidation.migrate({
      widgets: [raceDash(), { id: 'coach', userSettings: { enabled: false } }],
    });

    const coaches = (result['widgets'] as { id?: string }[]).filter(
      (widget) => widget.id === 'coach'
    );

    expect(coaches).toHaveLength(1);
  });

  it('converts layout copies too', () => {
    const result = v1LegacyConsolidation.migrate({
      widgets: [],
      layouts: [{ id: 'a', name: 'Race', monitors: [], widgets: [raceDash()] }],
    });

    const layout = (result['layouts'] as { widgets?: unknown }[])[0];

    expect(
      findWidget(layout?.widgets, 'race-dash')?.userSettings
    ).not.toHaveProperty('showReferenceSpeed');
    expect(findWidget(layout?.widgets, 'coach')).toBeDefined();
  });

  it('changes nothing when the split is run over its own output', () => {
    const once = v1LegacyConsolidation.migrate({ widgets: [raceDash()] });
    const twice = v1LegacyConsolidation.migrate(structuredClone(once));

    expect(twice).toEqual(once);
  });
});

describe('v1 — pit service settings added with the fuel keys', () => {
  const pitService = (userSettings: Record<string, unknown>) => ({
    id: 'pit-service',
    userSettings,
  });

  const stepOf = (widgets: unknown) =>
    (
      findWidget(widgets, 'pit-service')?.userSettings as
        | Record<string, unknown>
        | undefined
    )?.['fuelAdjustStep'];

  // mergeWithDefaults never reaches the copies stored inside a layout, and that
  // is the copy the driver actually uses.
  it('fills the step in the top-level widgets and in every layout', () => {
    const widgets = [pitService({ autoFuel: true })];

    const result = v1LegacyConsolidation.migrate({
      widgets,
      layouts: [{ id: 'a', name: 'Race', monitors: [], widgets }],
    });

    const layout = (result['layouts'] as { widgets?: unknown }[])[0];

    expect(stepOf(result['widgets'])).toBe(1);
    expect(stepOf(layout?.widgets)).toBe(1);
  });

  // Filled key by key: a file written mid-development can carry one of the two
  // and not the other, and a single guard would either skip the missing one or
  // overwrite the value the driver picked.
  it('leaves values the driver already picked alone, one key at a time', () => {
    const result = v1LegacyConsolidation.migrate({
      widgets: [pitService({ fuelAdjustStep: 10 })],
    });

    expect(findWidget(result['widgets'], 'pit-service')?.userSettings).toEqual({
      fuelAdjustStep: 10,
      commandRevealSeconds: 5,
    });
  });

  it('keeps the rest of the widget settings', () => {
    const result = v1LegacyConsolidation.migrate({
      widgets: [pitService({ autoTireWearThreshold: 80 })],
    });

    expect(findWidget(result['widgets'], 'pit-service')?.userSettings).toEqual({
      autoTireWearThreshold: 80,
      fuelAdjustStep: 1,
      commandRevealSeconds: 5,
    });
  });
});
