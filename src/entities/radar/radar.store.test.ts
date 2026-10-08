import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runInAction } from 'mobx';
import { RendererCore } from '@app/roots/renderer-core';
import type { LiveWidgetsStore } from '@entities/layout/live-widgets.store';

// A running core whose widget settings the test writes, as main writes its own.
type WritableCore = RendererCore & { liveWidgets: LiveWidgetsStore };
import type { LateralSide, ProximityFrame } from '@shared/contracts/bindings';
import type { ProximityRadarSettings } from '@entities/widget/widget-settings';

// RendererCore construction reaches the backend through these services; there is
// no Tauri runtime under vitest.
vi.mock('@shared/api/telemetry.service', () => ({
  startTelemetryStream: vi.fn().mockResolvedValue(undefined),
  stopTelemetryStream: vi.fn().mockResolvedValue(undefined),
  getConnectionStatus: vi.fn().mockResolvedValue(false),
  getLastSessionInfo: vi.fn().mockResolvedValue(null),
  setActiveEventsSilent: vi.fn(),
}));
vi.mock('@shared/api/settings.service', () => ({
  setPitWarningLapsSilent: vi.fn(),
  setFuelAvgWindowSilent: vi.fn(),
  setFuelCountYellowLapsSilent: vi.fn(),
  setCarLengthSilent: vi.fn(),
}));
vi.mock('@shared/api/events.service', () => ({
  listenTo: vi.fn().mockResolvedValue(() => {}),
  emitToApp: vi.fn().mockResolvedValue(undefined),
  emitToWindow: vi.fn().mockResolvedValue(undefined),
  emitToOverlays: vi.fn().mockResolvedValue(undefined),
}));

const carAt = (longitudinalDist: number, lateralSide: LateralSide) => ({
  carIdx: 3,
  longitudinalDist,
  lateralSide,
  clearance: Math.abs(longitudinalDist),
  bumperDist: longitudinalDist,
});

describe('RadarWidgetStore activation', () => {
  let rootStore: WritableCore;

  const setProximity = (frame: Partial<ProximityFrame>) => {
    runInAction(() => {
      rootStore.backendComputed.updateProximity({
        nearbyCars: [],
        radarDistances: {
          frontDist: null,
          rearDist: null,
          leftDist: null,
          rightDist: null,
        },
        spotterLeft: false,
        spotterRight: false,
        ...frame,
      });
    });
  };

  const setScopeRange = (scopeRange: number) => {
    runInAction(() => {
      const settings =
        rootStore.liveWidgets.getSettings<ProximityRadarSettings>(
          'proximity-radar'
        );

      rootStore.liveWidgets.updateUserSettings('proximity-radar', {
        ...settings,
        scaleMode: 'manual',
        scopeRange,
      });
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    rootStore = new RendererCore() as WritableCore;
    rootStore.radar.init();
  });

  afterEach(() => {
    rootStore.radar.dispose();
    vi.useRealTimers();
  });

  it('shows the bar the moment the spotter calls a car, and hides it with no delay', () => {
    setProximity({ spotterRight: true });

    expect(rootStore.radar.isVisibleForWidget('radar-bar')).toBe(true);

    setProximity({ spotterRight: false });

    expect(rootStore.radar.isVisibleForWidget('radar-bar')).toBe(false);
  });

  it('leaves the bar dark for a car the spotter is not calling', () => {
    setProximity({ nearbyCars: [carAt(2, 'center')] });

    expect(rootStore.radar.isVisibleForWidget('radar-bar')).toBe(false);
  });

  it('wakes the scope for a car inside the range it draws, and not for one past it', () => {
    setScopeRange(10);
    setProximity({ nearbyCars: [carAt(-8, 'center')] });

    expect(rootStore.radar.hasCarInScope).toBe(true);

    setProximity({ nearbyCars: [carAt(-25, 'center')] });

    expect(rootStore.radar.hasCarInScope).toBe(false);
  });

  it('follows the scope setting rather than a threshold of its own', () => {
    setScopeRange(10);
    setProximity({ nearbyCars: [carAt(18, 'center')] });

    expect(rootStore.radar.hasCarInScope).toBe(false);

    setScopeRange(25);

    expect(rootStore.radar.hasCarInScope).toBe(true);
  });

  it('keeps the scope up for the fade-out delay after the last car leaves', () => {
    setScopeRange(10);
    setProximity({ nearbyCars: [carAt(5, 'center')] });

    expect(rootStore.radar.isVisibleForWidget('proximity-radar')).toBe(true);

    setProximity({ nearbyCars: [] });

    expect(rootStore.radar.isVisibleForWidget('proximity-radar')).toBe(true);

    vi.advanceTimersByTime(2_000);

    expect(rootStore.radar.isVisibleForWidget('proximity-radar')).toBe(false);
  });
});
