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
        monitorConfigs: {},
        activeMonitorName: null,
      },
      {
        id: 'layout-race',
        name: 'Race Layout',
        createdAt: Date.now(),
        monitorConfigs: {},
        activeMonitorName: null,
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
