import { describe, expect, it } from 'vitest';

import {
  dropStoredWidgetSettings,
  mapEveryStoredWidget,
  removeStoredWidgets,
  renameStoredWidgetSetting,
} from './blob';
import type { SettingsBlob } from './types';

const v6Blob = (): SettingsBlob => ({
  schemaVersion: 6,
  widgetTemplates: {
    fuel: { enabled: true, size: {}, settings: { oldName: 5 } },
    timer: { enabled: false, size: {}, settings: {} },
  },
  layouts: [
    {
      id: 'a',
      monitors: [
        {
          name: 'LEFT',
          widgets: [
            { id: 'fuel', type: 'fuel', settings: { oldName: 3 } },
            { id: 'timer', type: 'timer', settings: {} },
          ],
        },
        {
          name: 'RIGHT',
          widgets: [{ id: 'fuel-2', type: 'fuel', settings: { oldName: 9 } }],
        },
      ],
    },
  ],
});

interface StoredShape {
  layouts: Array<{
    monitors: Array<{
      widgets: Array<{ type: string; settings: Record<string, unknown> }>;
    }>;
  }>;
  widgetTemplates: Record<string, { settings: Record<string, unknown> }>;
}

const fuelSettings = (blob: SettingsBlob) => {
  const shape = blob as unknown as StoredShape;

  return [
    shape.widgetTemplates['fuel']?.settings,
    ...shape.layouts.flatMap((layout) =>
      layout.monitors.flatMap((monitor) =>
        monitor.widgets
          .filter((widget) => widget.type === 'fuel')
          .map((widget) => widget.settings)
      )
    ),
  ];
};

describe('v6 blob helpers', () => {
  it('renames a setting in every instance on every monitor and the template', () => {
    const renamed = renameStoredWidgetSetting(
      v6Blob(),
      'fuel',
      'oldName',
      'newName'
    );

    expect(fuelSettings(renamed)).toEqual([
      { newName: 5 },
      { newName: 3 },
      { newName: 9 },
    ]);
  });

  // An absent key means "on the shipped default" — inventing one would pin a
  // value the user never chose.
  it('leaves an instance without the key alone', () => {
    const renamed = renameStoredWidgetSetting(
      v6Blob(),
      'timer',
      'oldName',
      'newName'
    );

    expect(
      (renamed as unknown as StoredShape).widgetTemplates['timer']?.settings
    ).toEqual({});
  });

  it('drops settings everywhere a type stands', () => {
    const dropped = dropStoredWidgetSettings(v6Blob(), 'fuel', ['oldName']);

    expect(fuelSettings(dropped)).toEqual([{}, {}, {}]);
  });

  it('removes every instance and the template of a type', () => {
    const removed = removeStoredWidgets(v6Blob(), [
      'fuel',
    ]) as unknown as StoredShape;

    expect(Object.keys(removed.widgetTemplates)).toEqual(['timer']);
    expect(
      removed.layouts[0]?.monitors.map((monitor) => monitor.widgets.length)
    ).toEqual([1, 0]);
  });

  it('leaves a file without layouts without layouts', () => {
    const mapped = mapEveryStoredWidget({ app: {} }, (widgets) => widgets);

    expect(mapped).toEqual({ app: {} });
  });

  it('does not mutate the blob it was given', () => {
    const blob = v6Blob();
    const before = JSON.stringify(blob);

    renameStoredWidgetSetting(blob, 'fuel', 'oldName', 'newName');

    expect(JSON.stringify(blob)).toBe(before);
  });
});
