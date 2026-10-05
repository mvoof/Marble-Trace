import { describe, expect, it, vi, beforeEach } from 'vitest';
import { runInAction } from 'mobx';

import { MainRoot } from '@store/main-root';
import { OverlayRoot } from '@store/overlay-root';
import type {
  ClientToMainMessage,
  SnapshotMessage,
} from '@/types/client-protocol';

// Main and the overlay are wired straight to each other below: what main
// emits is handed to the handler the overlay registered, and the other way.
const wire = vi.hoisted(() => ({
  toMain: null as null | ((message: ClientToMainMessage) => void),
  sent: [] as SnapshotMessage[],
}));

vi.mock('@platform/services/events.service', () => ({
  emitLayoutActivated: vi.fn(),
  emitToMain: vi.fn(async (message: ClientToMainMessage) =>
    wire.toMain?.(message)
  ),
  listenToClients: vi.fn(
    async (handler: (message: ClientToMainMessage) => void) => {
      wire.toMain = handler;

      return () => {
        wire.toMain = null;
      };
    }
  ),
  emitSnapshotToClient: vi.fn(async (message: SnapshotMessage) => {
    wire.sent.push(message);
  }),
  listenTo: vi.fn(),
}));

vi.mock('@platform/services/settings.service', () => ({
  setFuelAvgWindowSilent: vi.fn(),
  setFuelCountYellowLapsSilent: vi.fn(),
  setPitWarningLapsSilent: vi.fn(),
  setActiveEventsSilent: vi.fn(),
  setCarLengthSilent: vi.fn(),
}));

vi.mock('./overlay-labels', () => ({
  OVERLAY_LABEL_PREFIX: 'overlay-',
  monitorLabel: (name: string) => `overlay-${name}`,
  listOverlayWindowLabels: vi.fn(async () => ['overlay-LEFT', 'overlay-RIGHT']),
}));

const { overlaySnapshotFor } = await import('./client-snapshot');
const { registerClientPublishing } = await import('./client-publish');
const { applyOverlaySnapshot } = await import('./overlay-sync');

const LEFT = {
  name: 'LEFT',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};
const RIGHT = {
  name: 'RIGHT',
  bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
};

const layout = (id: string) => ({
  id,
  name: id,
  createdAt: 0,
  monitors: [LEFT, RIGHT],
  widgets: [],
});

const mainWithTwoMonitors = () => {
  const root = new MainRoot({ skipInit: true });

  root.liveWidgets.setLayouts(
    [layout('layout-race'), layout('layout-qualify')],
    'layout-race'
  );

  // Set up without undo steps, so a test can tell whether a command left one.
  root.liveWidgets.setTypeEnabledOnMonitor('fuel', 'LEFT', true, {
    recordUndo: false,
  });
  root.liveWidgets.setTypeEnabledOnMonitor('standings', 'RIGHT', true, {
    recordUndo: false,
  });

  return root;
};

const lastSnapshotTo = (clientId: string) =>
  wire.sent.filter((message) => message.clientId === clientId).at(-1);

beforeEach(() => {
  wire.toMain = null;
  wire.sent = [];
});

describe('the snapshot main builds for one overlay', () => {
  it('carries its own monitor and nothing of the others', () => {
    const root = mainWithTwoMonitors();
    const snapshot = overlaySnapshotFor(root, 'LEFT')!;

    expect(snapshot.monitor.name).toBe('LEFT');
    expect(snapshot.widgets.every((widget) => widget.monitor === 'LEFT')).toBe(
      true
    );
    // The standings are switched on on the other monitor only; what stands
    // here of them is the switched-off record every layout keeps.
    expect(
      snapshot.widgets
        .filter((widget) => widget.userSettings.enabled)
        .map((widget) => widget.type)
    ).toEqual(['fuel']);
  });

  it('describes the live layout, not the one the editor holds', () => {
    const root = mainWithTwoMonitors();

    runInAction(() => {
      root.layouts.setPinnedLiveLayoutId('layout-race');
      root.layouts.setEditingLayoutId('layout-qualify');
    });

    expect(overlaySnapshotFor(root, 'LEFT')!.layoutId).toBe('layout-race');
  });

  it('is nothing for a monitor the live layout does not have', () => {
    expect(overlaySnapshotFor(mainWithTwoMonitors(), 'GONE')).toBeNull();
  });

  it('derives off-track hiding from auto-switch and the garage layout', () => {
    const root = mainWithTwoMonitors();

    expect(overlaySnapshotFor(root, 'LEFT')!.hidesOffTrack).toBe(true);

    runInAction(() => root.layouts.setSessionLayout('Garage', 'layout-race'));

    expect(overlaySnapshotFor(root, 'LEFT')!.hidesOffTrack).toBe(false);
  });
});

describe('an overlay installing its snapshot', () => {
  const overlayOn = (monitorName: string) => {
    const overlay = new OverlayRoot({ skipInit: true });

    overlay.liveWidgets.setOwnMonitorName(monitorName);

    return overlay;
  };

  it('draws the widgets of its monitor and takes the app values', () => {
    const main = mainWithTwoMonitors();
    const overlay = overlayOn('LEFT');

    runInAction(() => {
      main.appSettings.appSettings.carLength = 5.2;
      main.units.setSystem('imperial');
    });

    applyOverlaySnapshot(overlay, overlaySnapshotFor(main, 'LEFT')!);

    expect(
      overlay.liveWidgets.ownMonitorWidgets.map((widget) => widget.type)
    ).toEqual(['fuel']);
    expect(overlay.appSettings.appSettings.carLength).toBe(5.2);
    expect(overlay.units.unitSystem).toBe('imperial');
    expect(overlay.layouts.monitorByName('LEFT')?.bounds).toEqual(LEFT.bounds);
  });

  it('patches the widgets it holds when the layout stays the same', () => {
    const main = mainWithTwoMonitors();
    const overlay = overlayOn('LEFT');

    applyOverlaySnapshot(overlay, overlaySnapshotFor(main, 'LEFT')!);

    const before = overlay.liveWidgets.getWidget('fuel');

    main.liveWidgets.updatePosition('fuel', 300, 200);
    applyOverlaySnapshot(overlay, overlaySnapshotFor(main, 'LEFT')!);

    expect(overlay.liveWidgets.getWidget('fuel')).toBe(before);
    expect(overlay.liveWidgets.getWidget('fuel')!.userSettings.x).toBe(300);
  });

  it('reports nothing back to main for what main sent', () => {
    const main = mainWithTwoMonitors();
    const overlay = overlayOn('LEFT');

    applyOverlaySnapshot(overlay, overlaySnapshotFor(main, 'LEFT')!);

    expect(overlay.liveWidgets.drainTouchedWidgets().widgets).toEqual([]);
    expect(overlay.settingsMutations.changeToken).toBe(0);
  });

  it('follows a layout switch', () => {
    const main = mainWithTwoMonitors();
    const overlay = overlayOn('LEFT');

    applyOverlaySnapshot(overlay, overlaySnapshotFor(main, 'LEFT')!);
    main.liveWidgets.loadLayout('layout-qualify');
    applyOverlaySnapshot(overlay, overlaySnapshotFor(main, 'LEFT')!);

    expect(overlay.layouts.liveLayoutId).toBe('layout-qualify');
    expect(overlay.liveWidgets.syncedLayoutId).toBe('layout-qualify');
    expect(overlay.liveWidgets.ownMonitorWidgets).toEqual([]);
  });
});

describe('main answering its clients', () => {
  it('answers hello with that overlay’s snapshot alone', async () => {
    const main = mainWithTwoMonitors();
    const publishing = await registerClientPublishing(main);

    wire.toMain!({ kind: 'hello', clientId: 'overlay-RIGHT' });

    expect(wire.sent).toHaveLength(1);
    expect(wire.sent[0].clientId).toBe('overlay-RIGHT');
    expect(wire.sent[0].snapshot.monitor.name).toBe('RIGHT');

    publishing.dispose();
  });

  it('resyncs an overlay that reloads', async () => {
    const main = mainWithTwoMonitors();
    const publishing = await registerClientPublishing(main);
    const overlay = new OverlayRoot({ skipInit: true });

    overlay.liveWidgets.setOwnMonitorName('LEFT');
    main.liveWidgets.updatePosition('fuel', 420, 240);
    wire.toMain!({ kind: 'hello', clientId: 'overlay-LEFT' });
    applyOverlaySnapshot(overlay, lastSnapshotTo('overlay-LEFT')!.snapshot);

    expect(overlay.liveWidgets.getWidget('fuel')!.userSettings.x).toBe(420);

    publishing.dispose();
  });

  it('adds a widget from the F9 picker on the overlay’s monitor, without an undo step', async () => {
    const main = mainWithTwoMonitors();
    const publishing = await registerClientPublishing(main);

    wire.toMain!({
      kind: 'command',
      clientId: 'overlay-LEFT',
      commandNo: 1,
      layoutId: 'layout-race',
      command: { kind: 'enableTypeOnMonitor', type: 'delta', monitor: 'LEFT' },
    });

    const added = main.liveWidgets
      .widgetsOfType('delta')
      .find((widget) => widget.monitor === 'LEFT');

    expect(added?.userSettings.enabled).toBe(true);
    expect(main.liveWidgets.history.canUndo).toBe(false);

    publishing.dispose();
  });

  it('refuses a command for a layout that is no longer on screen', async () => {
    const main = mainWithTwoMonitors();
    const publishing = await registerClientPublishing(main);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    wire.toMain!({
      kind: 'command',
      clientId: 'overlay-LEFT',
      commandNo: 1,
      layoutId: 'layout-qualify',
      command: { kind: 'enableTypeOnMonitor', type: 'delta', monitor: 'LEFT' },
    });

    expect(
      main.liveWidgets
        .widgetsOfType('delta')
        .some((widget) => widget.userSettings.enabled)
    ).toBe(false);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
    publishing.dispose();
  });

  it('refuses a widget for a monitor that is not the sender’s', async () => {
    const main = mainWithTwoMonitors();
    const publishing = await registerClientPublishing(main);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    wire.toMain!({
      kind: 'command',
      clientId: 'overlay-LEFT',
      commandNo: 1,
      layoutId: 'layout-race',
      command: { kind: 'enableTypeOnMonitor', type: 'delta', monitor: 'RIGHT' },
    });

    expect(
      main.liveWidgets
        .widgetsOfType('delta')
        .some((widget) => widget.userSettings.enabled)
    ).toBe(false);

    warn.mockRestore();
    publishing.dispose();
  });
});
