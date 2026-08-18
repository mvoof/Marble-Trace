import { describe, expect, it } from 'vitest';

import {
  asArray,
  asObject,
  dropWidgetSettings,
  mapEveryWidget,
  patchWidgetSettings,
  renameWidgetSetting,
} from './blob';
import type { SettingsBlob } from './types';

const blobWithWidgetEverywhere = (): SettingsBlob => ({
  schemaVersion: 1,
  app: { language: 'ru' },
  widgets: [
    { id: 'fuel', userSettings: { enabled: true, oldName: 7 } },
    { id: 'timer', userSettings: { enabled: false } },
  ],
  layouts: [
    {
      id: 'a',
      widgets: [{ id: 'fuel', userSettings: { enabled: true, oldName: 3 } }],
    },
    {
      id: 'b',
      widgets: [{ id: 'fuel', userSettings: { enabled: false, oldName: 9 } }],
    },
  ],
});

const fuelSettingsEverywhere = (blob: SettingsBlob) => {
  const top = (blob['widgets'] as { id: string; userSettings: unknown }[]).find(
    (widget) => widget.id === 'fuel'
  )?.userSettings;

  const inLayouts = (
    blob['layouts'] as { widgets: { id: string; userSettings: unknown }[] }[]
  ).map(
    (layout) =>
      layout.widgets.find((widget) => widget.id === 'fuel')?.userSettings
  );

  return [top, ...inLayouts];
};

describe('asObject / asArray', () => {
  it('accepts only a plain object', () => {
    expect(asObject({ a: 1 })).toEqual({ a: 1 });
    expect(asObject([1])).toBeUndefined();
    expect(asObject(null)).toBeUndefined();
    expect(asObject('x')).toBeUndefined();
  });

  it('turns anything that is not an array into an empty one', () => {
    expect(asArray([1, 2])).toEqual([1, 2]);
    expect(asArray(undefined)).toEqual([]);
    expect(asArray({ length: 2 })).toEqual([]);
  });
});

describe('mapEveryWidget', () => {
  // The reason this module exists: mergeWithDefaults never descends into
  // layouts, so a migration that misses them leaves the old shape behind.
  it('reaches the layout copies, not just the top-level list', () => {
    const result = mapEveryWidget(blobWithWidgetEverywhere(), (widgets) =>
      widgets.map((widget) => ({ ...widget, visited: true }))
    );

    const everyWidget = [
      ...(result['widgets'] as { visited?: boolean }[]),
      ...(result['layouts'] as { widgets: { visited?: boolean }[] }[]).flatMap(
        (layout) => layout.widgets
      ),
    ];

    expect(everyWidget).toHaveLength(4);

    for (const widget of everyWidget) {
      expect(widget.visited).toBe(true);
    }
  });

  it('leaves everything else in the file alone', () => {
    const result = mapEveryWidget(
      blobWithWidgetEverywhere(),
      (widgets) => widgets
    );

    expect(result['app']).toEqual({ language: 'ru' });
    expect(result['schemaVersion']).toBe(1);
  });

  it('does not mutate the blob it was given', () => {
    const original = blobWithWidgetEverywhere();
    const snapshot = JSON.stringify(original);

    mapEveryWidget(original, (widgets) =>
      widgets.map((widget) => ({ ...widget, id: 'rewritten' }))
    );

    expect(JSON.stringify(original)).toBe(snapshot);
  });

  // A key the file never had stays absent: an empty array here would read as
  // "the user deleted every layout" to the defaulting that runs afterwards.
  it('leaves absent widgets and layouts absent', () => {
    const result = mapEveryWidget({ app: {} }, (widgets) => widgets);

    expect('widgets' in result).toBe(false);
    expect('layouts' in result).toBe(false);
  });

  it('leaves a layout without widgets untouched', () => {
    const result = mapEveryWidget({ layouts: [{ id: 'one' }] }, () => [
      { id: 'invented' },
    ]);

    expect(result['layouts']).toEqual([{ id: 'one' }]);
  });

  // Deciding what a corrupt layout should have been is not a migration's job.
  it('passes a non-object layout through untouched', () => {
    const result = mapEveryWidget(
      { layouts: ['nonsense', null] },
      (widgets) => widgets
    );

    expect(result['layouts']).toEqual(['nonsense', null]);
  });
});

describe('patchWidgetSettings', () => {
  it('patches every copy of the widget and no other widget', () => {
    const result = patchWidgetSettings(
      blobWithWidgetEverywhere(),
      'fuel',
      (settings) => ({ ...settings, added: 1 })
    );

    for (const settings of fuelSettingsEverywhere(result)) {
      expect(settings).toMatchObject({ added: 1 });
    }

    const timer = (
      result['widgets'] as { id: string; userSettings: unknown }[]
    ).find((widget) => widget.id === 'timer');

    expect(timer?.userSettings).toEqual({ enabled: false });
  });

  it('does not invent a widget the file never had', () => {
    const result = patchWidgetSettings(
      blobWithWidgetEverywhere(),
      'never-shipped',
      (settings) => ({ ...settings, added: 1 })
    );

    expect(result['widgets']).toHaveLength(2);
  });

  it('gives the patch a copy, so mutating it cannot reach the original', () => {
    const original = blobWithWidgetEverywhere();

    patchWidgetSettings(original, 'fuel', (settings) => {
      delete settings['enabled'];

      return settings;
    });

    expect(fuelSettingsEverywhere(original)[0]).toMatchObject({
      enabled: true,
    });
  });
});

describe('renameWidgetSetting', () => {
  it('moves the value everywhere, keeping each copy its own', () => {
    const result = renameWidgetSetting(
      blobWithWidgetEverywhere(),
      'fuel',
      'oldName',
      'newName'
    );

    expect(fuelSettingsEverywhere(result)).toEqual([
      { enabled: true, newName: 7 },
      { enabled: true, newName: 3 },
      { enabled: false, newName: 9 },
    ]);
  });

  // Writing `newName: undefined` would survive into the merge and beat the
  // shipped default, which is exactly the value the user should get.
  it('leaves a widget without the old key untouched', () => {
    const result = renameWidgetSetting(
      { widgets: [{ id: 'fuel', userSettings: { enabled: true } }] },
      'fuel',
      'oldName',
      'newName'
    );

    expect(
      (result['widgets'] as { userSettings: object }[])[0].userSettings
    ).toEqual({ enabled: true });
  });
});

describe('dropWidgetSettings', () => {
  it('removes the keys from every copy', () => {
    const result = dropWidgetSettings(blobWithWidgetEverywhere(), 'fuel', [
      'oldName',
    ]);

    expect(fuelSettingsEverywhere(result)).toEqual([
      { enabled: true },
      { enabled: true },
      { enabled: false },
    ]);
  });

  it('ignores a key that is not there', () => {
    const result = dropWidgetSettings(blobWithWidgetEverywhere(), 'fuel', [
      'nothing-like-this',
    ]);

    expect(fuelSettingsEverywhere(result)[0]).toEqual({
      enabled: true,
      oldName: 7,
    });
  });
});
