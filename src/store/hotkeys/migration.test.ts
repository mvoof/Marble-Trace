import { describe, expect, it } from 'vitest';
import type { SavedLayout } from '@/types/widget-settings';
import { migrateBindings, stripLegacyHotkeyFields } from './migration';

const layout = (
  id: string,
  widgets: Array<{ id: string; settings: Record<string, unknown> }>
): SavedLayout =>
  ({
    id,
    name: id,
    createdAt: 0,
    monitors: [],
    backgroundImages: {},
    widgets: widgets.map((widget) => ({
      id: widget.id,
      label: widget.id,
      designWidth: 100,
      designHeight: 100,
      userSettings: widget.settings,
    })),
  }) as unknown as SavedLayout;

describe('migrateBindings', () => {
  it('lifts the app-level hotkeys out of appSettings', () => {
    const bindings = migrateBindings({
      appSettings: {
        dragHotkey: 'F9',
        interactHotkey: 'F8',
        hideAllWidgetsHotkey: 'F10',
      },
      layouts: [],
      activeLayoutId: null,
    });

    expect(bindings['app:toggle-drag-mode']).toEqual([
      { kind: 'keyboard', accelerator: 'F9' },
    ]);
    expect(bindings['app:toggle-interact-mode']).toEqual([
      { kind: 'keyboard', accelerator: 'F8' },
    ]);
    expect(bindings['app:toggle-hide-all-widgets']).toEqual([
      { kind: 'keyboard', accelerator: 'F10' },
    ]);
  });

  it('takes the widget hotkeys of the active layout', () => {
    const bindings = migrateBindings({
      appSettings: {},
      layouts: [
        layout('a', [{ id: 'standings', settings: { scrollUpHotkey: 'F1' } }]),
        layout('b', [{ id: 'standings', settings: { scrollUpHotkey: 'F2' } }]),
      ],
      activeLayoutId: 'b',
    });

    expect(bindings['standings:scroll-up']).toEqual([
      { kind: 'keyboard', accelerator: 'F2' },
    ]);
  });

  it('drops a field that is only set in a non-active layout', () => {
    const bindings = migrateBindings({
      appSettings: {},
      layouts: [
        layout('a', [{ id: 'pit-service', settings: { fuelHotkey: 'F4' } }]),
        layout('b', [{ id: 'pit-service', settings: { fuelHotkey: '' } }]),
      ],
      activeLayoutId: 'b',
    });

    expect(bindings['pit-service:fuel']).toBeUndefined();
  });

  it('ignores empty legacy values', () => {
    const bindings = migrateBindings({
      appSettings: { dragHotkey: '' },
      layouts: [],
      activeLayoutId: null,
    });

    expect(bindings['app:toggle-drag-mode']).toBeUndefined();
  });
});

describe('stripLegacyHotkeyFields', () => {
  it('removes the legacy fields from every layout, not just the active one', () => {
    const layouts = [
      layout('a', [
        {
          id: 'standings',
          settings: { scrollUpHotkey: 'F1', viewMode: 'all' },
        },
      ]),
      layout('b', [{ id: 'pit-service', settings: { fuelHotkey: 'F4' } }]),
    ];

    stripLegacyHotkeyFields(layouts);

    const standings = layouts[0].widgets[0].userSettings as unknown as Record<
      string,
      unknown
    >;
    const pitService = layouts[1].widgets[0].userSettings as unknown as Record<
      string,
      unknown
    >;

    expect(standings['scrollUpHotkey']).toBeUndefined();
    expect(standings['viewMode']).toBe('all');
    expect(pitService['fuelHotkey']).toBeUndefined();
  });
});
