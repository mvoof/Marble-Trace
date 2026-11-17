import { describe, expect, it } from 'vitest';

import type { MonitorWidgetRow } from '@entities/layout/live-widgets.store';
import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';

import {
  isPanelSearchShown,
  panelLineCountOf,
  placedWidgetRowsOf,
  rowsMatching,
} from './placed-widget-rows';

const instance = (enabled: boolean) =>
  ({ userSettings: { enabled } }) as WidgetDefaultConfig;

const row = (
  type: string,
  label: string,
  instances: WidgetDefaultConfig[] = []
): MonitorWidgetRow => ({ type, label, available: true, instances });

const NOTHING_KEPT = () => false;

describe('the editor widget list', () => {
  const rows = [
    row('standings', 'Standings', [instance(true), instance(false)]),
    row('fuel', 'Fuel', [instance(false)]),
    row('weather', 'Weather'),
    row('relative', 'Relative', [instance(false), instance(true)]),
  ];

  it('lists only the widgets switched on on the monitor', () => {
    expect(
      placedWidgetRowsOf(rows, NOTHING_KEPT).map((entry) => entry.type)
    ).toEqual(['standings', 'relative']);
  });

  it('keeps a widget hidden from the list itself', () => {
    const isKept = (type: string) => type === 'fuel' || type === 'weather';

    expect(placedWidgetRowsOf(rows, isKept).map((entry) => entry.type)).toEqual(
      ['standings', 'fuel', 'relative']
    );
  });

  it('counts a line for each instance, copies included', () => {
    expect(panelLineCountOf(placedWidgetRowsOf(rows, NOTHING_KEPT))).toBe(4);
  });

  it('shows the search only past eight lines', () => {
    expect(isPanelSearchShown(8)).toBe(false);
    expect(isPanelSearchShown(9)).toBe(true);
  });

  it('filters by name, ignoring case and spaces around the search', () => {
    expect(rowsMatching(rows, '  STAND ').map((entry) => entry.type)).toEqual([
      'standings',
    ]);
    expect(rowsMatching(rows, '')).toEqual(rows);
  });
});
