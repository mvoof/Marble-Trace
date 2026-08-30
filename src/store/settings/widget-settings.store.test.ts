import { describe, it, expect, beforeEach } from 'vitest';
import { runInAction } from 'mobx';
import { RootStore } from '../root-store';
import type { CapabilitiesPayload } from '@/types/bindings';

const FULL_CAPABILITIES: CapabilitiesPayload = {
  playerDynamics: true,
  inputs: true,
  chassis: true,
  fuel: true,
  weatherCurrent: true,
  weatherForecast: true,
  standings: true,
  relative: true,
  radar: true,
  sectors: true,
};

describe('WidgetSettingsStore capabilities gating', () => {
  let rootStore: RootStore;

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
  });

  it('makes all widgets available when all capabilities are met', () => {
    runInAction(() => {
      rootStore.sim.capabilities = { ...FULL_CAPABILITIES };
    });

    const available = rootStore.widgetSettings.availableWidgetIds;
    // All default widgets should be available
    expect(available.length).toBe(rootStore.widgetSettings.allWidgets.length);
  });

  it('hides fuel widget when fuel capability is missing', () => {
    runInAction(() => {
      rootStore.sim.capabilities = {
        ...FULL_CAPABILITIES,
        fuel: false,
      };
    });

    const available = rootStore.widgetSettings.availableWidgetIds;
    expect(available).not.toContain('fuel');
    expect(available).toContain('race-dash'); // race-dash requires playerDynamics, which is true
  });

  it('hides inputs widget when inputs capability is missing', () => {
    runInAction(() => {
      rootStore.sim.capabilities = {
        ...FULL_CAPABILITIES,
        inputs: false,
      };
    });

    const available = rootStore.widgetSettings.availableWidgetIds;
    expect(available).not.toContain('input-trace');
    expect(available).toContain('race-dash');
  });

  it('filters enabledWidgetIds based on availableWidgetIds', () => {
    runInAction(() => {
      // Enable a widget that is NOT available
      rootStore.widgetSettings.setWidgetEnabled('fuel', true);
      rootStore.sim.capabilities = {
        ...FULL_CAPABILITIES,
        fuel: false, // Fuel is disabled in capabilities
      };
    });

    expect(rootStore.widgetSettings.availableWidgetIds).not.toContain('fuel');
    expect(rootStore.widgetSettings.enabledWidgetIds).not.toContain('fuel');

    runInAction(() => {
      // Now make fuel capability available
      rootStore.sim.capabilities = {
        ...FULL_CAPABILITIES,
        fuel: true,
      };
    });

    expect(rootStore.widgetSettings.availableWidgetIds).toContain('fuel');
    expect(rootStore.widgetSettings.enabledWidgetIds).toContain('fuel');
  });
});

describe('WidgetSettingsStore session layouts', () => {
  let rootStore: RootStore;

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
    // Создаем несколько фейковых лейаутов
    rootStore.widgetSettings.setLayouts([
      {
        id: 'layout-practice',
        name: 'Practice Layout',
        createdAt: Date.now(),
        monitors: [],
        widgets: [],
      },
      {
        id: 'layout-race',
        name: 'Race Layout',
        createdAt: Date.now(),
        monitors: [],
        widgets: [],
      },
    ]);
  });

  it('correctly sets and maps session layouts', () => {
    rootStore.widgetSettings.setSessionLayout('Practice', 'layout-practice');
    rootStore.widgetSettings.setSessionLayout('Race', 'layout-race');

    expect(rootStore.widgetSettings.sessionLayouts.Practice).toBe(
      'layout-practice'
    );
    expect(rootStore.widgetSettings.sessionLayouts.Race).toBe('layout-race');
    expect(rootStore.widgetSettings.sessionLayouts.Qualify).toBeNull();
  });

  it('returns correct currentSessionType based on sessionInfo', () => {
    expect(rootStore.session.currentSessionType).toBeNull();

    runInAction(() => {
      rootStore.session.updateSessionInfo({
        trackId: 1,
        trackName: 'Spa',
        currentSessionNum: 1,
        playerCarIdx: 0,
        cars: [],
        sessions: [
          {
            sessionType: 'Practice',
            sessionTypeLabel: 'Practice',
            sessionLaps: 'unlimited',
            resultsPositions: [],
          },
          {
            sessionType: 'Race',
            sessionTypeLabel: 'Race',
            sessionLaps: '10',
            resultsPositions: [],
          },
        ],
      } as any);
    });

    expect(rootStore.session.currentSessionType).toBe('Race');

    runInAction(() => {
      if (rootStore.session.sessionInfo) {
        rootStore.session.sessionInfo.currentSessionNum = 0;
      }
    });

    expect(rootStore.session.currentSessionType).toBe('Practice');
  });
});

describe('WidgetSettingsStore populated monitors', () => {
  let rootStore: RootStore;
  const SECOND_MONITOR_X = 1920;

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
    rootStore.widgetSettings.setLayouts(
      [
        {
          id: 'layout-multi',
          name: 'Multi',
          createdAt: Date.now(),
          monitors: [
            {
              name: 'DISPLAY1',
              bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            },
            {
              name: 'DISPLAY2',
              bounds: {
                x: SECOND_MONITOR_X,
                y: 0,
                width: 1920,
                height: 1080,
              },
            },
          ],
          widgets: [],
        },
      ],
      'layout-multi'
    );

    for (const widget of rootStore.widgetSettings.allWidgets) {
      rootStore.widgetSettings.setWidgetEnabled(widget.id, false);
    }
  });

  it('lists no monitor while every widget is disabled', () => {
    expect(rootStore.widgetSettings.populatedMonitorNames).toEqual([]);
  });

  it('lists only the monitor the enabled widget sits on', () => {
    const [widget] = rootStore.widgetSettings.allWidgets;

    rootStore.widgetSettings.setWidgetEnabled(widget.id, true);
    rootStore.widgetSettings.updatePosition(widget.id, 0, 0);

    expect(rootStore.widgetSettings.populatedMonitorNames).toEqual([
      'DISPLAY1',
    ]);

    rootStore.widgetSettings.updatePosition(widget.id, SECOND_MONITOR_X, 0);

    expect(rootStore.widgetSettings.populatedMonitorNames).toEqual([
      'DISPLAY2',
    ]);
  });
});

describe('WidgetSettingsStore overlay widget picker', () => {
  let rootStore: RootStore;
  const SECOND_MONITOR_X = 1920;

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
    rootStore.widgetSettings.setLayouts(
      [
        {
          id: 'layout-multi',
          name: 'Multi',
          createdAt: Date.now(),
          monitors: [
            {
              name: 'DISPLAY1',
              bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            },
            {
              name: 'DISPLAY2',
              bounds: {
                x: SECOND_MONITOR_X,
                y: 0,
                width: 1920,
                height: 1080,
              },
            },
          ],
          widgets: [],
        },
      ],
      'layout-multi'
    );

    for (const widget of rootStore.widgetSettings.allWidgets) {
      rootStore.widgetSettings.setWidgetEnabled(widget.id, false);
      rootStore.widgetSettings.updatePosition(widget.id, 0, 0);
    }
  });

  it('centres a newly added widget on the target monitor', () => {
    const [widget] = rootStore.widgetSettings.allWidgets;

    rootStore.widgetSettings.addWidgetToMonitor(widget.id, 'DISPLAY2');

    const added = rootStore.widgetSettings.getWidget(widget.id)!;
    const { currentWidth, currentHeight } = added.userSettings;

    expect(added.userSettings.enabled).toBe(true);
    expect(added.userSettings.x).toBe(
      Math.round(SECOND_MONITOR_X + (1920 - currentWidth) / 2)
    );
    expect(added.userSettings.y).toBe(Math.round((1080 - currentHeight) / 2));
    expect(rootStore.widgetSettings.populatedMonitorNames).toEqual([
      'DISPLAY2',
    ]);
  });

  it('cascades a second widget instead of stacking it', () => {
    const [first, second] = rootStore.widgetSettings.allWidgets;

    rootStore.widgetSettings.addWidgetToMonitor(first.id, 'DISPLAY1');
    rootStore.widgetSettings.addWidgetToMonitor(second.id, 'DISPLAY1');

    const placedFirst = rootStore.widgetSettings.getWidget(first.id)!;
    const placedSecond = rootStore.widgetSettings.getWidget(second.id)!;

    expect(placedSecond.userSettings.x).not.toBe(placedFirst.userSettings.x);
    expect(placedSecond.userSettings.zIndex).toBeGreaterThan(
      placedFirst.userSettings.zIndex ?? 0
    );
  });

  it('offers widgets drawn elsewhere with the monitor they live on', () => {
    const [widget] = rootStore.widgetSettings.allWidgets;

    rootStore.widgetSettings.addWidgetToMonitor(widget.id, 'DISPLAY2');

    const onFirst =
      rootStore.widgetSettings.pickableWidgetsForMonitor('DISPLAY1');
    const entry = onFirst.find((candidate) => candidate.id === widget.id);

    expect(entry?.currentMonitorName).toBe('DISPLAY2');

    const onSecond =
      rootStore.widgetSettings.pickableWidgetsForMonitor('DISPLAY2');

    expect(onSecond.some((candidate) => candidate.id === widget.id)).toBe(
      false
    );
  });
});

describe('WidgetSettingsStore remote screen geometry', () => {
  let rootStore: RootStore;
  const REMOTE_X = 2500;

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
    rootStore.widgetSettings.setLayouts(
      [
        {
          id: 'layout-remote',
          name: 'Remote',
          createdAt: Date.now(),
          monitors: [
            {
              name: 'DISPLAY1',
              bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            },
            {
              name: 'Tablet',
              kind: 'remote',
              slug: 'tablet',
              bounds: { x: REMOTE_X, y: 0, width: 400, height: 300 },
            },
          ],
          widgets: [],
        },
      ],
      'layout-remote'
    );
  });

  const remoteBounds = () =>
    rootStore.widgetSettings.activeLayout?.monitors.find(
      (monitor) => monitor.name === 'Tablet'
    )?.bounds;

  it('slides a screen clear of the display when fitting it to a device grows it over one', () => {
    rootStore.widgetSettings.resizeRemoteScreen('Tablet', 1280, 800);

    const bounds = remoteBounds();

    expect(bounds?.width).toBe(1280);
    expect(bounds?.x).toBeGreaterThanOrEqual(1920);
  });

  it('carries the screen widgets along when the fit displaces it', () => {
    const [widget] = rootStore.widgetSettings.allWidgets;

    rootStore.widgetSettings.setWidgetEnabled(widget.id, true);
    rootStore.widgetSettings.updatePosition(widget.id, REMOTE_X + 10, 10);

    const before = widget.userSettings.x;

    rootStore.widgetSettings.resizeRemoteScreen('Tablet', 1280, 800);

    const bounds = remoteBounds();

    expect(widget.userSettings.x - before).toBe((bounds?.x ?? 0) - REMOTE_X);
  });

  it('refuses a drag that would land the screen on another one', () => {
    rootStore.widgetSettings.moveRemoteScreen('Tablet', 0, 0);

    expect(remoteBounds()?.x).toBe(REMOTE_X);
  });

  it('moves the screen widgets with a drag', () => {
    const [widget] = rootStore.widgetSettings.allWidgets;

    rootStore.widgetSettings.setWidgetEnabled(widget.id, true);
    rootStore.widgetSettings.updatePosition(widget.id, REMOTE_X + 10, 10);

    rootStore.widgetSettings.moveRemoteScreen('Tablet', REMOTE_X, 2000);

    expect(widget.userSettings.y).toBe(2010);
  });
});

describe('derived design width', () => {
  it('rebuilds a stale design width when a layout copy is installed', () => {
    const rootStore = new RootStore({ skipInit: true });
    const store = rootStore.widgetSettings;
    const relative = store.getWidget('relative');

    expect(relative).toBeDefined();

    const shippedWidth = relative!.designWidth;

    // What a layout snapshot written by an older build looks like: the settings
    // say one width, the stored number says another. Left alone it reaches
    // `--wfs` as `currentWidth / designWidth` and the row stops matching the
    // frame around it — the widget appears to jump on the layout switch.
    store.setWidgets([
      {
        ...relative!,
        designWidth: shippedWidth + 120,
        userSettings: { ...relative!.userSettings },
      },
    ]);

    expect(store.getWidget('relative')!.designWidth).toBe(shippedWidth);
  });

  it('rescales currentWidth with it, so the repair does not resize the text', () => {
    const rootStore = new RootStore({ skipInit: true });
    const store = rootStore.widgetSettings;
    const relative = store.getWidget('relative')!;
    const shippedWidth = relative.designWidth;
    const staleWidth = shippedWidth + 120;

    store.setWidgets([
      {
        ...relative,
        designWidth: staleWidth,
        userSettings: { ...relative.userSettings, currentWidth: staleWidth },
      },
    ]);

    const repaired = store.getWidget('relative')!;

    // --wfs is currentWidth / designWidth; the pair moved together, so it did not.
    expect(repaired.designWidth).toBe(shippedWidth);
    expect(repaired.userSettings.currentWidth).toBe(shippedWidth);
  });

  it('leaves the size alone when the derived width already agrees', () => {
    const rootStore = new RootStore({ skipInit: true });
    const store = rootStore.widgetSettings;
    const relative = store.getWidget('relative')!;
    const userChosenWidth = relative.designWidth * 2;

    store.setWidgets([
      {
        ...relative,
        userSettings: {
          ...relative.userSettings,
          currentWidth: userChosenWidth,
        },
      },
    ]);

    expect(store.getWidget('relative')!.userSettings.currentWidth).toBe(
      userChosenWidth
    );
  });

  it('rebuilds it from settings synced in by an overlay window', () => {
    const rootStore = new RootStore({ skipInit: true });
    const store = rootStore.widgetSettings;

    const monitorName = 'DISPLAY1';
    const monitors = [
      { name: monitorName, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    ];

    store.setLayouts(
      [
        {
          id: 'layout-1',
          name: 'Default',
          createdAt: 0,
          monitors,
          widgets: [],
        },
      ],
      'layout-1'
    );

    const standings = store.getWidget('standings')!;
    const shippedWidth = standings.designWidth;

    // What the overlay sends back: settings for a narrower name column, and its
    // own stored width, which it had no reason to recompute.
    store.applySettingsSyncForMonitor(monitorName, [
      {
        ...standings,
        designWidth: shippedWidth,
        userSettings: {
          ...standings.userSettings,
          x: 100,
          y: 100,
          nameColumnWidth: 100,
        },
      },
    ]);

    const synced = store.getWidget('standings')!;

    expect(synced.designWidth).toBe(shippedWidth - (200 - 100));
  });

  it('follows the name column width without touching other widgets', () => {
    const rootStore = new RootStore({ skipInit: true });
    const store = rootStore.widgetSettings;
    const before = store.getWidget('standings')!.designWidth;
    const timerWidth = store.getWidget('timer')!.designWidth;

    store.updateUserSettings('standings', { nameColumnWidth: 150 });

    const standings = store.getWidget('standings')!;

    expect(before - standings.designWidth).toBe(
      200 -
        (standings.userSettings as { nameColumnWidth: number }).nameColumnWidth
    );
    expect(store.getWidget('timer')!.designWidth).toBe(timerWidth);
  });
});

describe('the active layout owns the widgets', () => {
  let rootStore: RootStore;

  const MONITOR = {
    name: 'DISPLAY1',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  };

  const layout = (id: string) => ({
    id,
    name: id,
    createdAt: Date.now(),
    monitors: [MONITOR],
    widgets: [],
  });

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
    rootStore.widgetSettings.setLayouts(
      [layout('layout-race'), layout('layout-garage')],
      'layout-race'
    );
  });

  it('writes an edit straight into the layout record, with nothing to commit', () => {
    const store = rootStore.widgetSettings;

    store.updatePosition('fuel', 640, 480);

    const stored = store.activeLayout!.widgets.find(
      (widget) => widget.id === 'fuel'
    )!.userSettings;

    expect(stored.x).toBe(640);
    expect(stored.y).toBe(480);
  });

  // The debounce used to be the only thing writing edits back into the layout,
  // so anything that switched layouts inside its 500 ms window took the old
  // layout's widgets with it and dropped the edit.
  it('keeps an edit made immediately before a layout switch', () => {
    const store = rootStore.widgetSettings;

    store.updatePosition('fuel', 640, 480);
    store.loadLayout('layout-garage');
    store.loadLayout('layout-race');

    expect(store.getWidget('fuel')!.userSettings.x).toBe(640);
  });

  it('does not leak an edit into the layout that was not active', () => {
    const store = rootStore.widgetSettings;

    store.updatePosition('fuel', 640, 480);

    const other = store.layouts
      .find((entry) => entry.id === 'layout-garage')!
      .widgets.find((widget) => widget.id === 'fuel');

    expect(other?.userSettings.x).not.toBe(640);
  });

  it('undoes an edit on the layout record itself', () => {
    const store = rootStore.widgetSettings;
    const before = store.getWidget('fuel')!.userSettings.x;

    store.pushUndo();
    store.updatePosition('fuel', 640, 480);
    store.undo();

    expect(store.getWidget('fuel')!.userSettings.x).toBe(before);
    expect(
      store.activeLayout!.widgets.find((widget) => widget.id === 'fuel')!
        .userSettings.x
    ).toBe(before);
  });

  it('falls back to the shipped defaults while no layout is active', () => {
    const store = rootStore.widgetSettings;

    store.selectLayout(null);

    expect(store.activeLayout).toBeUndefined();
    expect(store.getWidget('fuel')).toBeDefined();
  });
});
