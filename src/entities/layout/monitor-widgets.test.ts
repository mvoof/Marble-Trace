import { describe, expect, it } from 'vitest';

import type {
  LayoutMonitor,
  WidgetDefaultConfig,
} from '@shared/contracts/widget-settings';

import {
  monitorWidgetRowsOf,
  pickableWidgetsOf,
  populatedMonitorNamesOf,
  remoteScreenWidgetsOf,
} from './monitor-widgets';

const DISPLAY: LayoutMonitor = {
  name: 'DISPLAY1',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};

const SECOND_DISPLAY: LayoutMonitor = {
  name: 'DISPLAY2',
  bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
};

const BROWSER = {
  name: 'tablet',
  kind: 'remote',
  bounds: { x: 0, y: 0, width: 1280, height: 800 },
} as LayoutMonitor;

const widget = (
  id: string,
  type: string,
  monitor: string,
  enabled = true
): WidgetDefaultConfig =>
  ({ id, type, monitor, userSettings: { enabled } }) as WidgetDefaultConfig;

const SHIPPED = [
  { id: 'standings', label: 'Standings' },
  { id: 'fuel', label: 'Fuel' },
] as WidgetDefaultConfig[];

describe('monitorWidgetRowsOf', () => {
  it('lists every shipped widget with its instances on that monitor only', () => {
    const rows = monitorWidgetRowsOf(
      SHIPPED,
      [
        widget('standings', 'standings', 'DISPLAY1'),
        widget('standings-2', 'standings', 'DISPLAY2'),
      ],
      'DISPLAY1',
      new Set(['standings'])
    );

    expect(rows.map((row) => row.type)).toEqual(['standings', 'fuel']);
    expect(rows[0].instances.map((entry) => entry.id)).toEqual(['standings']);
    expect(rows[0].available).toBe(true);
    expect(rows[1]).toMatchObject({ instances: [], available: false });
  });
});

describe('pickableWidgetsOf', () => {
  it('offers the widgets not switched on there, by label', () => {
    const rows = monitorWidgetRowsOf(
      SHIPPED,
      [widget('standings', 'standings', 'DISPLAY1', false)],
      'DISPLAY1',
      new Set(['standings', 'fuel'])
    );

    const picked = pickableWidgetsOf(rows, (type) => `about ${type}`);

    expect(picked.map((entry) => entry.label)).toEqual(['Fuel', 'Standings']);
    expect(picked[0].description).toBe('about fuel');
  });

  it('leaves out a widget already switched on there', () => {
    const rows = monitorWidgetRowsOf(
      SHIPPED,
      [widget('standings', 'standings', 'DISPLAY1')],
      'DISPLAY1',
      new Set(['standings', 'fuel'])
    );

    expect(
      pickableWidgetsOf(rows, () => undefined).map((entry) => entry.type)
    ).toEqual(['fuel']);
  });
});

describe('populatedMonitorNamesOf', () => {
  it('names the displays that have something to draw, never a browser screen', () => {
    expect(
      populatedMonitorNamesOf(
        [DISPLAY, SECOND_DISPLAY, BROWSER],
        [widget('fuel', 'fuel', 'DISPLAY2'), widget('radar', 'radar', 'tablet')]
      )
    ).toEqual(['DISPLAY2']);
  });
});

describe('remoteScreenWidgetsOf', () => {
  it('keeps the widgets standing on a browser screen', () => {
    const streamed = widget('radar', 'radar', 'tablet');

    expect(
      remoteScreenWidgetsOf(
        [DISPLAY, BROWSER],
        [widget('fuel', 'fuel', 'DISPLAY1'), streamed]
      )
    ).toEqual([streamed]);
  });

  it('is empty without a browser screen', () => {
    expect(
      remoteScreenWidgetsOf([DISPLAY], [widget('fuel', 'fuel', 'DISPLAY1')])
    ).toEqual([]);
  });
});
