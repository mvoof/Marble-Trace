import { describe, expect, it } from 'vitest';

import type { MonitorWidgetRow } from '@entities/layout/live-widgets.store';
import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';

import { addWidgetMenuSections, addWidgetTargetOf } from './add-widget-menu';

const instance = (enabled: boolean) =>
  ({ userSettings: { enabled } }) as WidgetDefaultConfig;

const row = (
  type: string,
  label: string,
  instances: WidgetDefaultConfig[] = [],
  available = true
): MonitorWidgetRow => ({ type, label, available, instances });

const SCREEN = { x: 0, y: 0, width: 1920, height: 1080 };

const CORE_TYPES = new Set(['standings', 'relative']);
const isCore = (type: string) => CORE_TYPES.has(type);

describe('the "+ Widget" menu', () => {
  const rows = [
    row('weather', 'Weather'),
    row('standings', 'Standings', [instance(true)]),
    row('fuel', 'Fuel', [instance(false)]),
    row('relative', 'Relative'),
    row('drs', 'DRS', [], false),
  ];

  it('lists the core widgets first, then the rest, each alphabetically', () => {
    const sections = addWidgetMenuSections(rows, '', isCore);

    expect(sections.core.map((entry) => entry.type)).toEqual([
      'relative',
      'standings',
    ]);
    expect(sections.all.map((entry) => entry.type)).toEqual([
      'fuel',
      'weather',
    ]);
  });

  it('marks a widget switched on on the monitor as on screen', () => {
    const sections = addWidgetMenuSections(rows, '', isCore);
    const onScreen = [...sections.core, ...sections.all]
      .filter((entry) => entry.isOnScreen)
      .map((entry) => entry.type);

    expect(onScreen).toEqual(['standings']);
  });

  it('keeps the widgets whose name holds the search, in any case', () => {
    const sections = addWidgetMenuSections(rows, ' AND ', isCore);

    expect(sections.core.map((entry) => entry.type)).toEqual(['standings']);
    expect(sections.all).toEqual([]);
    expect(sections.topEntry?.type).toBe('standings');
  });

  it('has no first match when nothing matches', () => {
    expect(addWidgetMenuSections(rows, 'zzz', isCore).topEntry).toBeUndefined();
  });
});

describe('the monitor "+ Widget" adds to', () => {
  const monitors = [
    { name: 'STREAM', kind: 'remote' as const, slug: 'stream', bounds: SCREEN },
    { name: 'LEFT', bounds: SCREEN },
    { name: 'RIGHT', bounds: SCREEN },
  ];

  it('is the monitor in focus', () => {
    expect(
      addWidgetTargetOf({
        focusedMonitorName: 'RIGHT',
        selectedWidgetMonitor: 'LEFT',
        monitors,
      })
    ).toBe('RIGHT');
  });

  it("is the selected widget's monitor when none is in focus", () => {
    expect(
      addWidgetTargetOf({
        focusedMonitorName: null,
        selectedWidgetMonitor: 'RIGHT',
        monitors,
      })
    ).toBe('RIGHT');
  });

  it('is the first display when nothing points anywhere', () => {
    expect(
      addWidgetTargetOf({
        focusedMonitorName: null,
        selectedWidgetMonitor: undefined,
        monitors,
      })
    ).toBe('LEFT');
  });
});
