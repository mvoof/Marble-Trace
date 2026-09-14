import { describe, it, expect, beforeEach } from 'vitest';

import { RootStore } from '../root-store';
import { buildSettings } from '@platform/sync/persistence';

import { LayoutsStore } from './layouts.store';
import { deleteLayout } from './layout-gestures';
import { layoutGestureStores } from '../root-store-context';
import { SettingsMutationLog } from './mutation-log';
import type { LayoutMonitor, SavedLayout } from '@/types/widget-settings';

const DISPLAY: LayoutMonitor = {
  name: 'DISPLAY1',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};

const SECOND_DISPLAY: LayoutMonitor = {
  name: 'DISPLAY2',
  bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
};

const layoutNamed = (id: string, monitors: LayoutMonitor[]): SavedLayout => ({
  id,
  name: id,
  createdAt: 0,
  monitors,
  widgets: [],
});

/**
 * A store and the log its writes mark themselves in — the whole of what a
 * layout record needs. Nothing is stood in for, because the records reach
 * nothing: what has to touch the live map is a gesture, not a record write.
 */
const freshStore = () => {
  const mutations = new SettingsMutationLog();
  const store = new LayoutsStore(mutations);

  store.setLayouts([layoutNamed('layout-race', [DISPLAY])], 'layout-race');
  mutations.drain();

  return { store, mutations };
};

describe('LayoutsStore', () => {
  it('holds the layout it was given, and the one it is pointed at', () => {
    const { store } = freshStore();

    expect(store.layouts).toHaveLength(1);
    expect(store.editingLayout?.id).toBe('layout-race');
    expect(store.byId('layout-race')?.monitors).toEqual([DISPLAY]);
  });

  it('maps a session to a layout, and leaves the rest unmapped', () => {
    const { store } = freshStore();

    store.setSessionLayout('Race', 'layout-race');

    expect(store.sessionLayouts.Race).toBe('layout-race');
    expect(store.sessionLayouts.Qualify).toBeNull();
  });

  it('spans every monitor of the active layout', () => {
    const { store } = freshStore();

    store.addMonitor(SECOND_DISPLAY);

    expect(store.editingMonitorNames).toEqual(['DISPLAY1', 'DISPLAY2']);
    expect(store.desktopBounds.width).toBe(3840);
  });

  it('refuses a second monitor under a name it already has', () => {
    const { store } = freshStore();

    store.addMonitor(DISPLAY);

    expect(store.editingLayout?.monitors).toHaveLength(1);
  });
});

/**
 * The same rule the widget store's own table pins, on the other side of the
 * seam: a record write that leaves no mark never reaches disk. Every write here
 * marks the whole widget map — the records are what the widgets stand on, and
 * once one of them moves no patch describes where they are.
 */
describe('every layout record write leaves its mark', () => {
  type RecordWrite = {
    name: string;
    setup?: (store: LayoutsStore) => void;
    run: (store: LayoutsStore) => void;
    /** False for a write that found nothing to change. */
    marks?: boolean;
  };

  const WRITES: RecordWrite[] = [
    {
      name: 'setLayouts',
      run: (store) => store.setLayouts([layoutNamed('layout-quali', [])]),
    },
    {
      name: 'setEditingLayoutId',
      run: (store) => store.setEditingLayoutId(null),
    },
    {
      name: 'setSessionLayout',
      run: (store) => store.setSessionLayout('Race', 'layout-race'),
    },
    {
      name: 'setSessionLayouts',
      run: (store) => store.setSessionLayouts({ Race: 'layout-race' }),
    },
    {
      name: 'addLayout',
      run: (store) => store.addLayout('Quali'),
    },
    {
      name: 'renameLayout',
      run: (store) => store.renameLayout('layout-race', 'Renamed'),
    },
    {
      name: 'removeLayout',
      run: (store) => store.removeLayout('layout-race'),
    },
    {
      name: 'setLayoutWidgets',
      run: (store) => store.setLayoutWidgets('layout-race', []),
    },
    {
      name: 'setMonitors',
      run: (store) => store.setMonitors('layout-race', [SECOND_DISPLAY]),
    },
    {
      name: 'addMonitor',
      run: (store) => store.addMonitor(SECOND_DISPLAY),
    },
    {
      name: 'removeMonitor',
      setup: (store) => store.addMonitor(SECOND_DISPLAY),
      run: (store) => store.removeMonitor('layout-race', 'DISPLAY2'),
    },
    {
      name: 'alignMonitorsToHardware',
      run: (store) => store.alignMonitorsToHardware([DISPLAY]),
    },
    {
      name: 'addRemoteScreen',
      run: (store) => store.addRemoteScreen('Tablet', 1280, 800),
    },
    {
      name: 'setRemoteScreenBackground',
      setup: (store) => store.addRemoteScreen('Tablet', 1280, 800),
      run: (store) => store.setRemoteScreenBackground('Tablet', 'transparent'),
    },
    {
      name: 'resizeRemoteScreen',
      setup: (store) => store.addRemoteScreen('Tablet', 1280, 800),
      run: (store) => store.resizeRemoteScreen('Tablet', 1024, 768),
    },
    {
      name: 'moveRemoteScreen',
      setup: (store) => store.addRemoteScreen('Tablet', 1280, 800),
      run: (store) => store.moveRemoteScreen('Tablet', 4000, 200),
    },
    {
      name: 'arrangeRemoteScreens',
      setup: (store) => store.addRemoteScreen('Tablet', 1280, 800),
      run: (store) => store.arrangeRemoteScreens(),
    },
    {
      name: 'setMonitorBackground',
      run: (store) => store.setMonitorBackground('DISPLAY1', 'image.png'),
    },
    {
      name: 'setActiveLayoutBackground',
      run: (store) => store.setActiveLayoutBackground('image.png'),
    },

    // A write that found nothing: no such layout, no such monitor. Marking it
    // would report an edit nobody made, and wake the save for nothing.
    {
      name: 'renameLayout — no such layout',
      run: (store) => store.renameLayout('layout-missing', 'Renamed'),
      marks: false,
    },
    {
      name: 'removeMonitor — no such monitor',
      run: (store) => store.removeMonitor('layout-race', 'DISPLAY9'),
      marks: false,
    },
  ];

  it.each(WRITES)('$name', ({ setup, run, marks = true }) => {
    const { store, mutations } = freshStore();

    setup?.(store);
    mutations.drain();

    const before = mutations.changeToken;

    run(store);

    expect(mutations.changeToken > before).toBe(marks);
    expect(mutations.drain().everyWidget).toBe(marks);
    expect(mutations.syncToken).toBe(0);
  });
});

// Deleting the layout on screen is the one gesture where the order of two
// writes is load-bearing: the fallback's widgets have to be in the live map
// before the mutation token moves, or the commit reaction persists the widgets
// of the layout that was just deleted over the one the driver landed on.
describe('deleting the layout that is on screen', () => {
  const MONITOR = {
    name: 'DISPLAY1',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  };

  const RACE_FUEL_X = 100;
  const GARAGE_FUEL_X = 900;

  let rootStore: RootStore;

  const layoutRecord = (id: string) => ({
    id,
    name: id,
    createdAt: Date.now(),
    monitors: [MONITOR],
    widgets: [],
  });

  // A detached copy, so a comparison never holds the store's own object and
  // cannot be rewritten under the assertion by a later mutation.
  const fuelPositionOf = (layoutId: string): { x: number; y: number } => {
    const record = rootStore.layouts.layouts.find(
      (layout) => layout.id === layoutId
    );
    const fuel = record?.widgets.find((widget) => widget.id === 'fuel');

    return { x: fuel!.userSettings.x, y: fuel!.userSettings.y };
  };

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });

    const store = rootStore.liveWidgets;

    store.setLayouts(
      [layoutRecord('layout-race'), layoutRecord('layout-garage')],
      'layout-race'
    );

    // Each layout gets its own arrangement, so "the fallback's widgets" and
    // "the deleted layout's widgets" are distinguishable afterwards.
    store.loadLayout('layout-garage');
    store.updatePosition('fuel', GARAGE_FUEL_X, GARAGE_FUEL_X);
    store.loadLayout('layout-race');
    store.updatePosition('fuel', RACE_FUEL_X, RACE_FUEL_X);
    store.drainTouchedWidgets();
  });

  it("leaves the fallback layout's own widgets on screen", () => {
    const store = rootStore.liveWidgets;

    deleteLayout(layoutGestureStores(rootStore), 'layout-race');

    expect(rootStore.layouts.editingLayoutId).toBe('layout-garage');
    expect(store.getWidget('fuel')!.userSettings.x).toBe(GARAGE_FUEL_X);
  });

  it('marks the whole widget map rather than a patch', () => {
    const store = rootStore.liveWidgets;

    deleteLayout(layoutGestureStores(rootStore), 'layout-race');

    const drained = store.drainTouchedWidgets();

    expect(drained.everyWidget).toBe(true);
    expect(drained.widgets.length).toBe(store.allWidgets.length);
  });

  it("persists the fallback's widgets, not the deleted layout's", () => {
    deleteLayout(layoutGestureStores(rootStore), 'layout-race');

    const persisted = buildSettings(rootStore);

    expect(persisted.layouts.map((layout) => layout.id)).toEqual([
      'layout-garage',
    ]);

    const fuel = persisted.layouts[0].widgets.find(
      (widget) => widget.id === 'fuel'
    )!;

    expect(fuel.userSettings.x).toBe(GARAGE_FUEL_X);
    expect(fuel.userSettings.y).toBe(GARAGE_FUEL_X);
  });

  it('leaves nothing being edited when the last layout goes', () => {
    deleteLayout(layoutGestureStores(rootStore), 'layout-garage');

    expect(() =>
      deleteLayout(layoutGestureStores(rootStore), 'layout-race')
    ).not.toThrow();
    expect(rootStore.layouts.layouts).toEqual([]);
    expect(rootStore.layouts.editingLayoutId).toBeNull();
  });

  it('leaves the live map untouched when another layout is deleted', () => {
    const store = rootStore.liveWidgets;
    const before = fuelPositionOf('layout-race');

    deleteLayout(layoutGestureStores(rootStore), 'layout-garage');

    expect(rootStore.layouts.editingLayoutId).toBe('layout-race');
    expect(store.getWidget('fuel')!.userSettings.x).toBe(RACE_FUEL_X);
    expect(fuelPositionOf('layout-race')).toEqual(before);
  });

  it('clears a pin that the editor left on the deleted layout', () => {
    // The editor opens on the live layout and is then pointed at another one,
    // which pins 'layout-race' as the one the overlay keeps showing.
    rootStore.layoutEditor.setOpen(true);
    rootStore.layoutEditor.switchLayout('layout-garage');

    expect(rootStore.layouts.pinnedLiveLayoutId).toBe('layout-race');

    deleteLayout(layoutGestureStores(rootStore), 'layout-race');

    expect(rootStore.layouts.pinnedLiveLayoutId).toBeNull();
    expect(rootStore.layouts.liveLayoutId).toBe('layout-garage');
  });
});

describe('the screens of a layout that have something to draw', () => {
  let rootStore: RootStore;
  const SECOND_MONITOR_X = 1920;

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
    rootStore.liveWidgets.setLayouts(
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

    for (const widget of rootStore.liveWidgets.allWidgets) {
      rootStore.liveWidgets.setWidgetEnabled(widget.id, false);
    }
  });

  it('lists no monitor while every widget is disabled', () => {
    expect(rootStore.liveWidgets.populatedMonitorNames).toEqual([]);
  });

  it('lists only the monitor the enabled widget sits on', () => {
    const [widget] = rootStore.liveWidgets.allWidgets;

    rootStore.liveWidgets.setWidgetEnabled(widget.id, true);
    rootStore.liveWidgets.updatePosition(widget.id, 0, 0);

    expect(rootStore.liveWidgets.populatedMonitorNames).toEqual(['DISPLAY1']);

    rootStore.liveWidgets.updatePosition(widget.id, SECOND_MONITOR_X, 0);

    expect(rootStore.liveWidgets.populatedMonitorNames).toEqual(['DISPLAY2']);
  });
});

describe('remote screen geometry', () => {
  let rootStore: RootStore;
  const REMOTE_X = 2500;

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
    rootStore.liveWidgets.setLayouts(
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
    rootStore.layouts.editingLayout?.monitors.find(
      (monitor) => monitor.name === 'Tablet'
    )?.bounds;

  it('slides a screen clear of the display when fitting it to a device grows it over one', () => {
    rootStore.layouts.resizeRemoteScreen('Tablet', 1280, 800);

    const bounds = remoteBounds();

    expect(bounds?.width).toBe(1280);
    expect(bounds?.x).toBeGreaterThanOrEqual(1920);
  });

  it('carries the screen widgets along when the fit displaces it', () => {
    const [widget] = rootStore.liveWidgets.allWidgets;

    rootStore.liveWidgets.setWidgetEnabled(widget.id, true);
    rootStore.liveWidgets.updatePosition(widget.id, REMOTE_X + 10, 10);

    const before = widget.userSettings.x;

    rootStore.layouts.resizeRemoteScreen('Tablet', 1280, 800);

    const bounds = remoteBounds();

    expect(widget.userSettings.x - before).toBe((bounds?.x ?? 0) - REMOTE_X);
  });

  it('refuses a drag that would land the screen on another one', () => {
    rootStore.layouts.moveRemoteScreen('Tablet', 0, 0);

    expect(remoteBounds()?.x).toBe(REMOTE_X);
  });

  it('moves the screen widgets with a drag', () => {
    const [widget] = rootStore.liveWidgets.allWidgets;

    rootStore.liveWidgets.setWidgetEnabled(widget.id, true);
    rootStore.liveWidgets.updatePosition(widget.id, REMOTE_X + 10, 10);

    rootStore.layouts.moveRemoteScreen('Tablet', REMOTE_X, 2000);

    expect(widget.userSettings.y).toBe(2010);
  });
});

describe('a screen added to a layout', () => {
  let rootStore: RootStore;

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
    rootStore.liveWidgets.setLayouts(
      [
        {
          id: 'layout-race',
          name: 'Race',
          createdAt: 0,
          monitors: [
            {
              name: 'DISPLAY1',
              bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            },
          ],
          widgets: [],
        },
      ],
      'layout-race'
    );
  });

  const screenNamed = (name: string) =>
    rootStore.layouts.editingLayout!.monitors.find(
      (monitor) => monitor.name === name
    )!;

  // The only thing that separates a browser source from a tablet: what the page
  // paints behind the widgets. Everything else about the screen is the same.
  it('carries the background it was created with', () => {
    rootStore.layouts.addRemoteScreen('Stream', 1920, 1080, 'transparent');

    expect(screenNamed('Stream').background).toBe('transparent');
  });

  it('leaves the ground to the default until it is set', () => {
    rootStore.layouts.addRemoteScreen('Tablet', 1280, 800);

    expect(screenNamed('Tablet').background).toBeUndefined();
    expect(screenNamed('Tablet').fittedToDevice).toBeFalsy();

    rootStore.layouts.setRemoteScreenBackground('Tablet', 'transparent');

    expect(screenNamed('Tablet').background).toBe('transparent');
  });

  it('aggregates all remote screens across all layouts with context metadata', () => {
    const layout1Id = rootStore.layouts.addLayout('Race Layout');
    rootStore.layouts.setEditingLayoutId(layout1Id);
    rootStore.layouts.addRemoteScreen('Dash', 1280, 800);

    const layout2Id = rootStore.layouts.addLayout('Quali Layout');
    rootStore.layouts.setEditingLayoutId(layout2Id);
    rootStore.layouts.addRemoteScreen('LapScreen', 1920, 1080);

    rootStore.layouts.setSessionLayout('Race', layout1Id);
    rootStore.layouts.setSessionLayout('Qualify', layout2Id);
    rootStore.layouts.setPinnedLiveLayoutId(layout1Id);

    const all = rootStore.layouts.allRemoteScreens;
    expect(all).toHaveLength(2);

    const dash = all.find((d) => d.screen.name === 'Dash');
    expect(dash).toBeDefined();
    expect(dash?.layoutId).toBe(layout1Id);
    expect(dash?.layoutName).toBe('Race Layout');
    expect(dash?.isLive).toBe(true);
    expect(dash?.sessionContexts).toEqual(['Race']);

    const lap = all.find((d) => d.screen.name === 'LapScreen');
    expect(lap).toBeDefined();
    expect(lap?.layoutId).toBe(layout2Id);
    expect(lap?.layoutName).toBe('Quali Layout');
    expect(lap?.isLive).toBe(false);
    expect(lap?.sessionContexts).toEqual(['Qualify']);

    // Test modifying screen on a non-editing layout
    rootStore.layouts.setEditingLayoutId(layout1Id);
    rootStore.layouts.setRemoteScreenBackground(
      'LapScreen',
      '#ff0000',
      layout2Id
    );
    expect(
      rootStore.layouts
        .byId(layout2Id)
        ?.monitors.find((m) => m.name === 'LapScreen')?.background
    ).toBe('#ff0000');

    rootStore.layouts.resizeRemoteScreen('LapScreen', 800, 600, layout2Id);
    expect(
      rootStore.layouts
        .byId(layout2Id)
        ?.monitors.find((m) => m.name === 'LapScreen')?.bounds.width
    ).toBe(800);
  });
});
