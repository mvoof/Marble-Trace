import { describe, expect, it } from 'vitest';
import { v6PerMonitorWidgets } from './v6-per-monitor-widgets';

const LEFT = { x: 0, y: 0, width: 1920, height: 1080 };
const RIGHT = { x: 1920, y: 0, width: 2560, height: 1440 };

const widget = (
  id: string,
  userSettings: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) => ({
  id,
  label: 'Shipped label',
  description: 'Shipped description',
  designWidth: 400,
  designHeight: 300,
  ...extra,
  userSettings: {
    enabled: true,
    currentWidth: 400,
    currentHeight: 300,
    zIndex: 3,
    ...userSettings,
  },
});

interface MigratedMonitor {
  name: string;
  backgroundImage?: string;
  widgets: Array<Record<string, unknown>>;
}

const monitorsOf = (blob: Record<string, unknown>, layoutIndex = 0) =>
  (blob['layouts'] as Array<{ monitors: MigratedMonitor[] }>)[layoutIndex]
    .monitors;

const twoMonitorLayout = (widgets: unknown[]) => ({
  id: 'race',
  name: 'Race',
  createdAt: 1,
  backgroundImages: { RIGHT: 'cockpit.png' },
  monitors: [
    { name: 'LEFT', bounds: LEFT },
    { name: 'RIGHT', bounds: RIGHT },
  ],
  widgets,
});

describe('v6 — widgets stored under their monitor', () => {
  it('puts each widget under the monitor containing its centre, in its coordinates', () => {
    const migrated = v6PerMonitorWidgets.migrate({
      layouts: [
        twoMonitorLayout([
          widget('standings', { x: 24, y: 24 }),
          widget('relative', { x: 2000, y: 100, opacity: 0.8 }),
        ]),
      ],
    });

    const [left, right] = monitorsOf(migrated);

    expect(left.widgets).toEqual([
      {
        id: 'standings',
        type: 'standings',
        enabled: true,
        frame: { x: 24, y: 24, width: 400, height: 300, z: 3 },
        design: { width: 400, height: 300 },
        settings: {},
      },
    ]);
    expect(right.widgets).toEqual([
      {
        id: 'relative',
        type: 'relative',
        enabled: true,
        frame: { x: 80, y: 100, width: 400, height: 300, z: 3 },
        design: { width: 400, height: 300 },
        settings: { opacity: 0.8 },
      },
    ]);
  });

  // The edge belongs to the monitor it opens, the same half-open test v5 used.
  it('hands a widget centred exactly on an edge to the monitor on its right', () => {
    const migrated = v6PerMonitorWidgets.migrate({
      layouts: [twoMonitorLayout([widget('fuel', { x: 1720, y: 0 })])],
    });

    const [left, right] = monitorsOf(migrated);

    expect(left.widgets).toHaveLength(0);
    expect(right.widgets[0]).toMatchObject({ frame: { x: -200, y: 0 } });
  });

  it('falls back to the first monitor for a widget centred in a gap', () => {
    const migrated = v6PerMonitorWidgets.migrate({
      layouts: [twoMonitorLayout([widget('fuel', { x: 5000, y: 5000 })])],
    });

    const [left] = monitorsOf(migrated);

    expect(left.widgets[0]).toMatchObject({ frame: { x: 5000, y: 5000 } });
  });

  it('keeps copies as instances of their type, ids untouched', () => {
    const migrated = v6PerMonitorWidgets.migrate({
      layouts: [
        twoMonitorLayout([
          widget('track-map', { x: 0, y: 0 }),
          widget('track-map-2', { x: 2000, y: 0 }, { type: 'track-map' }),
        ]),
      ],
    });

    const [left, right] = monitorsOf(migrated);

    expect(left.widgets[0]).toMatchObject({
      id: 'track-map',
      type: 'track-map',
    });
    expect(right.widgets[0]).toMatchObject({
      id: 'track-map-2',
      type: 'track-map',
    });
  });

  it('moves a monitor background image onto that monitor', () => {
    const migrated = v6PerMonitorWidgets.migrate({
      layouts: [twoMonitorLayout([])],
    });

    const [left, right] = monitorsOf(migrated);
    const layout = (migrated['layouts'] as Array<Record<string, unknown>>)[0];

    expect(left.backgroundImage).toBeUndefined();
    expect(right.backgroundImage).toBe('cockpit.png');
    expect(layout).not.toHaveProperty('backgroundImages');
    expect(layout).not.toHaveProperty('widgets');
  });

  it('keeps everything a remote screen carries', () => {
    const tablet = {
      name: 'Tablet',
      kind: 'remote',
      slug: 'tablet',
      background: 'transparent',
      fittedToDevice: true,
      bounds: { x: 0, y: 1080, width: 1280, height: 800 },
    };

    const migrated = v6PerMonitorWidgets.migrate({
      layouts: [
        {
          id: 'race',
          monitors: [{ name: 'LEFT', bounds: LEFT }, tablet],
          widgets: [widget('fuel', { x: 100, y: 1180 })],
        },
      ],
    });

    const [, remote] = monitorsOf(migrated);

    expect(remote).toMatchObject(tablet);
    expect(remote.widgets[0]).toMatchObject({ frame: { x: 100, y: 100 } });
  });

  it('keeps a switched-off widget switched off', () => {
    const migrated = v6PerMonitorWidgets.migrate({
      layouts: [
        twoMonitorLayout([widget('fuel', { x: 0, y: 0, enabled: false })]),
      ],
    });

    expect(monitorsOf(migrated)[0].widgets[0]).toMatchObject({
      enabled: false,
    });
  });

  it('leaves a frame field out rather than inventing one', () => {
    const migrated = v6PerMonitorWidgets.migrate({
      layouts: [
        twoMonitorLayout([
          {
            id: 'fuel',
            userSettings: { x: 10, y: 'nope', currentWidth: 300 },
          },
        ]),
      ],
    });

    expect(monitorsOf(migrated)[0].widgets[0]).toEqual({
      id: 'fuel',
      type: 'fuel',
      enabled: false,
      frame: { x: 10, width: 300 },
      settings: {},
    });
  });

  it('drops the widgets of a layout with no monitor to put them on', () => {
    const migrated = v6PerMonitorWidgets.migrate({
      layouts: [
        { id: 'pending', monitors: [], widgets: [widget('fuel', { x: 0 })] },
      ],
    });

    expect(migrated['layouts']).toEqual([{ id: 'pending', monitors: [] }]);
  });

  it('turns the widget catalogue into templates keyed by type', () => {
    const migrated = v6PerMonitorWidgets.migrate({
      defaultWidgets: [
        widget('fuel', { x: 10, y: 20, enabled: false, opacity: 0.5 }),
      ],
    });

    expect(migrated).not.toHaveProperty('defaultWidgets');
    expect(migrated['widgetTemplates']).toEqual({
      fuel: {
        enabled: false,
        size: { width: 400, height: 300 },
        design: { width: 400, height: 300 },
        settings: { opacity: 0.5 },
      },
    });
  });

  it('adds neither key to a file that had neither', () => {
    const migrated = v6PerMonitorWidgets.migrate({ app: { language: 'en' } });

    expect(migrated).toEqual({ app: { language: 'en' } });
  });

  it('changes nothing when run over its own output', () => {
    const once = v6PerMonitorWidgets.migrate({
      defaultWidgets: [widget('fuel', { x: 10, y: 20 })],
      layouts: [
        twoMonitorLayout([
          widget('standings', { x: 24, y: 24 }),
          widget('relative', { x: 2000, y: 100 }),
        ]),
      ],
    });

    expect(v6PerMonitorWidgets.migrate(structuredClone(once))).toEqual(once);
  });

  it('leaves a layout that is not an object as found', () => {
    const migrated = v6PerMonitorWidgets.migrate({ layouts: [null, 'x'] });

    expect(migrated['layouts']).toEqual([null, 'x']);
  });
});
