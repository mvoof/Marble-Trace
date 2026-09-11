import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { RootStore } from '@store/root-store';
import type { SavedLayout } from '@/types/widget-settings';
import { TELEMETRY_EVENT_BITS } from '@/types/telemetry-events';

vi.mock('@platform/services/events.service', () => ({
  listenTo: vi.fn(() => Promise.resolve(() => {})),
}));

const setActiveEventsSilent = vi.fn();
const setRemoteActiveEventsSilent = vi.fn();

vi.mock('@platform/services/telemetry.service', () => ({
  getConnectionStatus: vi.fn(),
  getLastSessionInfo: vi.fn(),
  setActiveEventsSilent: (mask: number) => setActiveEventsSilent(mask),
  setRemoteActiveEventsSilent: (mask: number) =>
    setRemoteActiveEventsSilent(mask),
  startTelemetryStream: vi.fn(),
  stopTelemetryStream: vi.fn(),
}));

vi.mock('@platform/services/track.service', () => ({
  deleteReferenceLap: vi.fn(),
  getCachedTrackShape: vi.fn(),
  getReferenceLap: vi.fn(),
}));

vi.mock('@platform/services/settings.service', () => ({
  setFuelAvgWindowSilent: vi.fn(),
  setPitWarningLapsSilent: vi.fn(),
}));

const MONITOR_LEFT = {
  name: 'DISPLAY1',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};

const MONITOR_RIGHT = {
  name: 'DISPLAY2',
  bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
};

const REMOTE_SCREEN = {
  name: 'REMOTE1',
  kind: 'remote',
  bounds: { x: 0, y: 1080, width: 1280, height: 720 },
};

// carDynamics is g-meter's declared appetite, proximity radar-bar's
// (see their manifest.ts).
const widgetAt = (id: string, type: string, x: number, y = 0) => ({
  id,
  type,
  userSettings: { enabled: true, x, y, currentWidth: 100, currentHeight: 100 },
});

const gMeterWidget = (id: string, x = 0, y = 0) =>
  widgetAt(id, 'g-meter', x, y);

const radarBarWidget = (id: string, x = 0, y = 0) =>
  widgetAt(id, 'radar-bar', x, y);

const layout = (
  id: string,
  widgets: ReturnType<typeof widgetAt>[],
  monitors: unknown[] = [MONITOR_LEFT]
): SavedLayout =>
  ({
    id,
    name: id,
    createdAt: 0,
    monitors,
    widgets,
  }) as unknown as SavedLayout;

const lastMaskOf = (spy: typeof setActiveEventsSilent): number => {
  expect(spy).toHaveBeenCalled();

  return spy.mock.calls[spy.mock.calls.length - 1][0] as number;
};

/**
 * An overlay window is told apart from main by its hash — see `drawsWidgets`.
 * These run in the node environment, so the window itself is the stub.
 */
const setWindowHash = (hash: string | null) => {
  if (hash === null) {
    delete (globalThis as { window?: unknown }).window;

    return;
  }

  (globalThis as { window?: unknown }).window = { location: { hash } };
};

const asOverlayWindow = () => setWindowHash('#/overlay');

const asMainWindow = () => setWindowHash(null);

describe('SimStore active-events mask', () => {
  let root: RootStore;

  beforeEach(() => {
    setActiveEventsSilent.mockClear();
    setRemoteActiveEventsSilent.mockClear();
  });

  afterEach(() => {
    root.dispose();
    asMainWindow();
  });

  describe('in an overlay window', () => {
    beforeEach(() => {
      asOverlayWindow();
      root = new RootStore({ skipInit: true });
    });

    it('registers only the widgets on its own monitor', () => {
      // The editing layout is a different one, so the live layout keeps exactly
      // the two widgets placed here — installing the catalogue's defaults into
      // the layout being edited is `setWidgets`' business, not this test's.
      root.liveWidgets.setLayouts(
        [
          layout('layout-edited', []),
          layout(
            'layout-live',
            [gMeterWidget('g-meter', 10), radarBarWidget('radar-bar', 1930)],
            [MONITOR_LEFT, MONITOR_RIGHT]
          ),
        ],
        'layout-edited'
      );
      root.layouts.setPinnedLiveLayoutId('layout-live');
      root.liveWidgets.setOwnMonitorName(MONITOR_LEFT.name);
      root.sim.init();

      expect(lastMaskOf(setActiveEventsSilent)).toBe(
        TELEMETRY_EVENT_BITS.carDynamics
      );

      root.liveWidgets.setOwnMonitorName(MONITOR_RIGHT.name);

      expect(lastMaskOf(setActiveEventsSilent)).toBe(
        TELEMETRY_EVENT_BITS.proximity
      );
    });

    // Reproduces: layout editor open on layout A (no widgets), live layout B
    // (on the overlay, e.g. after a session auto-switch) has a widget that
    // needs carDynamics. The mask must follow the LIVE layout, not the one
    // under the editor's cursor — otherwise the overlay is starved of the
    // gated field and every widget reading it shows "no data" until the
    // editor closes.
    it('follows the live layout while the editor holds another one open', () => {
      root.liveWidgets.setLayouts(
        [layout('layout-a', []), layout('layout-b', [gMeterWidget('g-meter')])],
        'layout-a'
      );
      root.liveWidgets.setOwnMonitorName(MONITOR_LEFT.name);
      root.sim.init();

      root.layoutEditor.setOpen(true);
      setActiveEventsSilent.mockClear();

      // Live layout switches to B without touching what the editor (still on A)
      // is showing — this is exactly what session auto-switch does mid-edit.
      root.layouts.setPinnedLiveLayoutId('layout-b');

      expect(lastMaskOf(setActiveEventsSilent)).toBe(
        TELEMETRY_EVENT_BITS.carDynamics
      );
    });

    it('asks for nothing while every widget is hidden', () => {
      root.liveWidgets.setLayouts(
        [layout('layout-a', [gMeterWidget('g-meter')])],
        'layout-a'
      );
      root.liveWidgets.setOwnMonitorName(MONITOR_LEFT.name);
      root.sim.init();

      root.appSettings.setHideAllWidgets(true);

      expect(lastMaskOf(setActiveEventsSilent)).toBe(0);
    });

    it('leaves the remote screens to main', () => {
      root.liveWidgets.setLayouts(
        [layout('layout-a', [gMeterWidget('g-meter')])],
        'layout-a'
      );
      root.liveWidgets.setOwnMonitorName(MONITOR_LEFT.name);
      root.sim.init();

      expect(setRemoteActiveEventsSilent).not.toHaveBeenCalled();
    });
  });

  describe('in the main window', () => {
    beforeEach(() => {
      asMainWindow();
      root = new RootStore({ skipInit: true });
    });

    it('computes no mask of its own — the editor contributes nothing', () => {
      root.liveWidgets.setLayouts(
        [
          layout('layout-a', []),
          layout('layout-b', [radarBarWidget('radar-bar')]),
        ],
        'layout-a'
      );
      root.sim.init();

      // The editor opens on a layout whose widgets demand `proximity` while the
      // live layout demands none: main must still register nothing at all.
      root.layoutEditor.setOpen(true);
      root.layouts.setEditingLayoutId('layout-b');

      expect(setActiveEventsSilent).not.toHaveBeenCalled();
    });

    it('registers the remote screens, which have no window of their own', () => {
      root.liveWidgets.setLayouts(
        [
          layout(
            'layout-a',
            [
              gMeterWidget('g-meter', 10),
              radarBarWidget('radar-bar', 10, 1090),
            ],
            [MONITOR_LEFT, REMOTE_SCREEN]
          ),
        ],
        'layout-a'
      );
      root.sim.init();

      expect(lastMaskOf(setRemoteActiveEventsSilent)).toBe(
        TELEMETRY_EVENT_BITS.proximity
      );
    });
  });
});
