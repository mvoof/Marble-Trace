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
