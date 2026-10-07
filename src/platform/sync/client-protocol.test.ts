import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { runInAction } from 'mobx';

import { MainRoot } from '@store/roots/main-root';
import { OverlayRoot } from '@store/roots/overlay-root';
import type {
  ClientToMainMessage,
  CommandMessage,
  ClientSnapshot,
  SnapshotMessage,
} from '@shared/contracts/client-protocol';

// Main and the overlays are wired straight to each other below: a command an
// overlay sends reaches main's handler at once, and every snapshot main sends
// is kept, to be delivered when a test says so — so one can be held back and
// arrive late, as it would across the event loop.
const wire = vi.hoisted(() => ({
  toMain: null as null | ((message: ClientToMainMessage) => void),
  sent: [] as SnapshotMessage[],
  commands: [] as CommandMessage[],
}));

vi.mock('@shared/api/events.service', () => ({
  emitLayoutActivated: vi.fn(),
  emitToMain: vi.fn(async (message: ClientToMainMessage) => {
    if (message.kind === 'command') {
      wire.commands.push(message);
    }

    wire.toMain?.(message);
  }),
  listenToClients: vi.fn(
    async (handler: (message: ClientToMainMessage) => void) => {
      wire.toMain = handler;

      return () => {
        wire.toMain = null;
      };
    }
  ),
  // Serialized as the event transport would: a held snapshot must not follow
  // main's records as they change afterwards.
  emitSnapshotToClient: vi.fn(async (message: SnapshotMessage) => {
    wire.sent.push(JSON.parse(JSON.stringify(message)) as SnapshotMessage);
  }),
  listenTo: vi.fn(),
}));

vi.mock('@shared/api/settings.service', () => ({
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

/** How long the overlay holds a drag before sending it, and a popup edit. */
const GEOMETRY_SEND_MS = 75;
const SETTINGS_MERGE_MS = 50;

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
  const { liveWidgets } = root;

  liveWidgets.setLayouts(
    [layout('layout-race'), layout('layout-qualify')],
    'layout-race'
  );

  // Set up as a client would, so the editor's history starts empty and a test
  // can tell whether a command left a step in it.
  liveWidgets.applyClientCommand(() => {
    liveWidgets.setTypeEnabledOnMonitor('fuel', 'LEFT', true);
    liveWidgets.setTypeEnabledOnMonitor('standings', 'RIGHT', true);
  });

  return root;
};

const asMessage = (snapshot: ClientSnapshot): SnapshotMessage => ({
  kind: 'snapshot',
  clientId: 'overlay-LEFT',
  lastHandledCommandNo: 0,
  rejected: [],
  snapshot,
});

const overlayOn = (monitorName: string) => {
  const overlay = new OverlayRoot({ skipInit: true });

  overlay.liveWidgets.setOwnMonitorName(monitorName);
  overlay.settingsClient.connect(`overlay-${monitorName}`);

  return overlay;
};

const lastSnapshotTo = (clientId: string) =>
  wire.sent.filter((message) => message.clientId === clientId).at(-1);

const deliverLatest = (overlay: OverlayRoot) =>
  applyOverlaySnapshot(overlay, lastSnapshotTo('overlay-LEFT')!);

/** Main connected to one overlay on the left monitor, after its hello. */
const connected = async () => {
  const main = mainWithTwoMonitors();
  const publishing = await registerClientPublishing(main);
  const overlay = overlayOn('LEFT');

  wire.toMain!({ kind: 'hello', clientId: 'overlay-LEFT' });
  deliverLatest(overlay);

  /** Main publishes now; the snapshot is returned, not yet delivered. */
  const publishHeld = async () => {
    await publishing.publishAll();

    return lastSnapshotTo('overlay-LEFT')!;
  };

  return { main, overlay, publishing, publishHeld };
};

const xOf = (root: MainRoot | OverlayRoot, widgetId: string) =>
  root.liveWidgets.getWidget(widgetId)!.userSettings.x;

beforeEach(() => {
  vi.useFakeTimers();
  wire.toMain = null;
  wire.sent = [];
  wire.commands = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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
  it('draws the widgets of its monitor and takes the app values', () => {
    const main = mainWithTwoMonitors();
    const overlay = overlayOn('LEFT');

    runInAction(() => {
      main.appSettings.appSettings.carLength = 5.2;
      main.units.setSystem('imperial');
    });

    applyOverlaySnapshot(overlay, asMessage(overlaySnapshotFor(main, 'LEFT')!));

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

    applyOverlaySnapshot(overlay, asMessage(overlaySnapshotFor(main, 'LEFT')!));

    const before = overlay.liveWidgets.getWidget('fuel');

    main.liveWidgets.updatePosition('fuel', 300, 200);
    applyOverlaySnapshot(overlay, asMessage(overlaySnapshotFor(main, 'LEFT')!));

    expect(overlay.liveWidgets.getWidget('fuel')).toBe(before);
    expect(xOf(overlay, 'fuel')).toBe(300);
  });

  it('follows a layout switch', () => {
    const main = mainWithTwoMonitors();
    const overlay = overlayOn('LEFT');

    applyOverlaySnapshot(overlay, asMessage(overlaySnapshotFor(main, 'LEFT')!));
    main.liveWidgets.loadLayout('layout-qualify');
    applyOverlaySnapshot(overlay, asMessage(overlaySnapshotFor(main, 'LEFT')!));

    expect(overlay.layouts.liveLayoutId).toBe('layout-qualify');
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

  it('resyncs an overlay that reloads, counting its commands from 1 again', async () => {
    const { main, overlay, publishing } = await connected();

    overlay.settingsClient.setEnabled('fuel', false);

    // The window reloads: a fresh root says hello.
    const reloaded = overlayOn('LEFT');

    main.liveWidgets.updatePosition('fuel', 420, 240);
    wire.toMain!({ kind: 'hello', clientId: 'overlay-LEFT' });

    expect(lastSnapshotTo('overlay-LEFT')!.lastHandledCommandNo).toBe(0);

    deliverLatest(reloaded);

    expect(xOf(reloaded, 'fuel')).toBe(420);

    publishing.dispose();
  });

  it('adds a widget from the F9 picker on the overlay’s monitor, without an undo step', async () => {
    const { main, overlay, publishing } = await connected();

    overlay.settingsClient.enableTypeOnMonitor('delta', 'LEFT');

    const added = main.liveWidgets
      .widgetsOfType('delta')
      .find((widget) => widget.monitor === 'LEFT');

    expect(added?.userSettings.enabled).toBe(true);
    expect(main.liveWidgets.history.canUndo).toBe(false);

    publishing.dispose();
  });

  it('refuses a widget for a monitor that is not the sender’s, and says so', async () => {
    const { main, overlay, publishing, publishHeld } = await connected();

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    overlay.settingsClient.enableTypeOnMonitor('delta', 'RIGHT');

    expect(
      main.liveWidgets
        .widgetsOfType('delta')
        .some((widget) => widget.userSettings.enabled)
    ).toBe(false);
    expect(await publishHeld()).toMatchObject({
      lastHandledCommandNo: 1,
      rejected: [{ commandNo: 1 }],
    });

    publishing.dispose();
  });

  it('writes an overlay’s command into the live layout while the editor holds another', async () => {
    const { main, overlay, publishing } = await connected();

    runInAction(() => {
      main.layouts.setPinnedLiveLayoutId('layout-race');
      main.layouts.setEditingLayoutId('layout-qualify');
    });

    overlay.settingsClient.setEnabled('fuel', false);

    const raceFuel = main.layouts
      .byId('layout-race')!
      .widgets.find((widget) => widget.id === 'fuel')!;

    expect(raceFuel.userSettings.enabled).toBe(false);

    publishing.dispose();
  });
});

describe('an overlay’s commands', () => {
  it('keeps the dragged position when a stale snapshot lands after the release', async () => {
    const { main, overlay, publishing, publishHeld } = await connected();

    overlay.settingsClient.moveWidget('fuel', 100, 100);
    vi.advanceTimersByTime(GEOMETRY_SEND_MS);

    // Main has handled the first step, and the snapshot saying so is still on
    // its way when the drag goes on and ends.
    const stale = await publishHeld();

    overlay.settingsClient.moveWidget('fuel', 300, 100);
    overlay.settingsClient.endGeometry('fuel');

    applyOverlaySnapshot(overlay, stale);

    expect(
      stale.snapshot.widgets.find((widget) => widget.id === 'fuel')!
        .userSettings.x
    ).toBe(100);
    expect(xOf(overlay, 'fuel')).toBe(300);

    applyOverlaySnapshot(overlay, await publishHeld());

    expect(xOf(main, 'fuel')).toBe(300);
    expect(xOf(overlay, 'fuel')).toBe(300);

    // Acknowledged: the override is gone, and main's next value shows.
    main.liveWidgets.updatePosition('fuel', 50, 100);
    applyOverlaySnapshot(overlay, await publishHeld());

    expect(xOf(overlay, 'fuel')).toBe(50);

    publishing.dispose();
  });

  it('sends a drag every few frames while it lasts and once more on release', async () => {
    const { overlay, publishing } = await connected();

    overlay.settingsClient.moveWidget('fuel', 100, 100);
    overlay.settingsClient.moveWidget('fuel', 110, 100);
    vi.advanceTimersByTime(GEOMETRY_SEND_MS);
    overlay.settingsClient.moveWidget('fuel', 120, 100);
    overlay.settingsClient.endGeometry('fuel');

    expect(wire.commands.map((message) => message.command)).toMatchObject([
      { kind: 'setGeometry', x: 110, final: false },
      { kind: 'setGeometry', x: 120, final: true },
    ]);

    publishing.dispose();
  });

  it('restores main’s value when a command is refused', async () => {
    const { main, overlay, publishing, publishHeld } = await connected();
    const before = xOf(main, 'fuel');

    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // The layout flips away and back before the overlay hears of it: the snap
    // names a layout that was not on screen when it arrived.
    main.liveWidgets.loadLayout('layout-qualify');
    overlay.settingsClient.snapWidget('fuel', 600, 100);
    main.liveWidgets.loadLayout('layout-race');

    expect(xOf(overlay, 'fuel')).toBe(600);

    applyOverlaySnapshot(overlay, await publishHeld());

    expect(xOf(main, 'fuel')).toBe(before);
    expect(xOf(overlay, 'fuel')).toBe(before);

    publishing.dispose();
  });

  it('merges popup edits into one patch of the fields that changed', async () => {
    const { main, overlay, publishing } = await connected();

    overlay.settingsClient.patchSettings('fuel', {
      ...overlay.liveWidgets.getSettings('fuel'),
      fontScale: 1.4,
    });
    overlay.settingsClient.patchSettings('fuel', {
      ...overlay.liveWidgets.getSettings('fuel'),
      opacity: 0.5,
    });

    expect(wire.commands).toHaveLength(0);

    vi.advanceTimersByTime(SETTINGS_MERGE_MS);

    expect(wire.commands.map((message) => message.command)).toEqual([
      {
        kind: 'patchSettings',
        widgetId: 'fuel',
        partial: { fontScale: 1.4, opacity: 0.5 },
      },
    ]);
    expect(main.liveWidgets.getSettings('fuel').fontScale).toBe(1.4);
    expect(main.liveWidgets.history.canUndo).toBe(false);

    publishing.dispose();
  });
});
