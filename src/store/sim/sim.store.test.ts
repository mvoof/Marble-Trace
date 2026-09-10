import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { RootStore } from '@store/root-store';
import type { SavedLayout } from '@/types/widget-settings';

vi.mock('@platform/services/events.service', () => ({
  listenTo: vi.fn(() => Promise.resolve(() => {})),
}));

const setActiveEventsSilent = vi.fn();

vi.mock('@platform/services/telemetry.service', () => ({
  getConnectionStatus: vi.fn(),
  getLastSessionInfo: vi.fn(),
  setActiveEventsSilent: (mask: number) => setActiveEventsSilent(mask),
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

const MONITOR = {
  name: 'DISPLAY1',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};

// carDynamics is g-meter's declared appetite (manifest.ts).
const gMeterWidget = (id: string) => ({
  id,
  type: 'g-meter',
  userSettings: { enabled: true },
});

const layout = (
  id: string,
  widgets: ReturnType<typeof gMeterWidget>[]
): SavedLayout =>
  ({
    id,
    name: id,
    createdAt: 0,
    monitors: [MONITOR],
    widgets,
  }) as unknown as SavedLayout;

describe('SimStore active-events mask', () => {
  let root: RootStore;

  beforeEach(() => {
    setActiveEventsSilent.mockClear();
    root = new RootStore({ skipInit: true });
    root.sim.init();
  });

  afterEach(() => {
    root.dispose();
  });

  // Reproduces: layout editor open on layout A (no widgets), live layout B
  // (on the overlay, e.g. after a session auto-switch) has a widget that
  // needs carDynamics. The mask must follow the LIVE layout, not the one
  // under the editor's cursor — otherwise the overlay is starved of the
  // gated field and every widget reading it shows "no data" until the
  // editor closes.
  it('recomputes the telemetry mask when the live layout changes while the editor is open on a different layout', () => {
    root.liveWidgets.setLayouts(
      [layout('layout-a', []), layout('layout-b', [gMeterWidget('g-meter')])],
      'layout-a'
    );

    root.layoutEditor.setOpen(true);
    setActiveEventsSilent.mockClear();

    // Live layout switches to B without touching what the editor (still on A)
    // is showing — this is exactly what session auto-switch does mid-edit.
    root.layouts.setPinnedLiveLayoutId('layout-b');

    expect(setActiveEventsSilent).toHaveBeenCalled();
    const lastMask =
      setActiveEventsSilent.mock.calls[
        setActiveEventsSilent.mock.calls.length - 1
      ][0];

    expect(lastMask).not.toBe(0);
  });
});
