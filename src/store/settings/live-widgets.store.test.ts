import { describe, it, expect, beforeEach } from 'vitest';
import { runInAction } from 'mobx';
import { RootStore } from '../root-store';
import type { CapabilitiesPayload } from '@/types/bindings';
import { deleteLayout } from './layout-gestures';
import type { LayoutsStore } from './layouts.store';
import type { LayoutEditorStore } from './layout-editor.store';
import type { LiveWidgetsStore } from './live-widgets.store';

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

describe('LiveWidgetsStore capabilities gating', () => {
  let rootStore: RootStore;

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
  });

  it('makes all widgets available when all capabilities are met', () => {
    runInAction(() => {
      rootStore.sim.capabilities = { ...FULL_CAPABILITIES };
    });

    const available = rootStore.liveWidgets.availableWidgetIds;
    // All default widgets should be available
    expect(available.length).toBe(rootStore.liveWidgets.allWidgets.length);
  });

  it('hides fuel widget when fuel capability is missing', () => {
    runInAction(() => {
      rootStore.sim.capabilities = {
        ...FULL_CAPABILITIES,
        fuel: false,
      };
    });

    const available = rootStore.liveWidgets.availableWidgetIds;
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

    const available = rootStore.liveWidgets.availableWidgetIds;
    expect(available).not.toContain('input-trace');
    expect(available).toContain('race-dash');
  });

  it('filters enabledWidgetIds based on availableWidgetIds', () => {
    runInAction(() => {
      // Enable a widget that is NOT available
      rootStore.liveWidgets.setWidgetEnabled('fuel', true);
      rootStore.sim.capabilities = {
        ...FULL_CAPABILITIES,
        fuel: false, // Fuel is disabled in capabilities
      };
    });

    expect(rootStore.liveWidgets.availableWidgetIds).not.toContain('fuel');
    expect(rootStore.liveWidgets.enabledWidgetIds).not.toContain('fuel');

    runInAction(() => {
      // Now make fuel capability available
      rootStore.sim.capabilities = {
        ...FULL_CAPABILITIES,
        fuel: true,
      };
    });

    expect(rootStore.liveWidgets.availableWidgetIds).toContain('fuel');
    expect(rootStore.liveWidgets.enabledWidgetIds).toContain('fuel');
  });
});

// The mapping itself is a layout record and is pinned in `layouts.store.test.ts`;
// what is left here is which session the sim is actually in.
describe('the session a layout would be picked for', () => {
  let rootStore: RootStore;

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
    // Создаем несколько фейковых лейаутов
    rootStore.liveWidgets.setLayouts([
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

describe('LiveWidgetsStore overlay widget picker', () => {
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
      rootStore.liveWidgets.updatePosition(widget.id, 0, 0);
    }
  });

  it('centres a newly added widget on the target monitor', () => {
    const [widget] = rootStore.liveWidgets.allWidgets;

    rootStore.liveWidgets.addWidgetToMonitor(widget.id, 'DISPLAY2');

    const added = rootStore.liveWidgets.getWidget(widget.id)!;
    const { currentWidth, currentHeight } = added.userSettings;

    expect(added.userSettings.enabled).toBe(true);
    expect(added.userSettings.x).toBe(
      Math.round(SECOND_MONITOR_X + (1920 - currentWidth) / 2)
    );
    expect(added.userSettings.y).toBe(Math.round((1080 - currentHeight) / 2));
    expect(rootStore.liveWidgets.populatedMonitorNames).toEqual(['DISPLAY2']);
  });

  it('cascades a second widget instead of stacking it', () => {
    const [first, second] = rootStore.liveWidgets.allWidgets;

    rootStore.liveWidgets.addWidgetToMonitor(first.id, 'DISPLAY1');
    rootStore.liveWidgets.addWidgetToMonitor(second.id, 'DISPLAY1');

    const placedFirst = rootStore.liveWidgets.getWidget(first.id)!;
    const placedSecond = rootStore.liveWidgets.getWidget(second.id)!;

    expect(placedSecond.userSettings.x).not.toBe(placedFirst.userSettings.x);
    expect(placedSecond.userSettings.zIndex).toBeGreaterThan(
      placedFirst.userSettings.zIndex ?? 0
    );
  });

  it('offers widgets drawn elsewhere with the monitor they live on', () => {
    const [widget] = rootStore.liveWidgets.allWidgets;

    rootStore.liveWidgets.addWidgetToMonitor(widget.id, 'DISPLAY2');

    const onFirst = rootStore.liveWidgets.pickableWidgetsForMonitor('DISPLAY1');
    const entry = onFirst.find((candidate) => candidate.id === widget.id);

    expect(entry?.currentMonitorName).toBe('DISPLAY2');

    const onSecond =
      rootStore.liveWidgets.pickableWidgetsForMonitor('DISPLAY2');

    expect(onSecond.some((candidate) => candidate.id === widget.id)).toBe(
      false
    );
  });
});

describe('derived design width', () => {
  it('rebuilds a stale design width when a layout copy is installed', () => {
    const rootStore = new RootStore({ skipInit: true });
    const store = rootStore.liveWidgets;
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
    const store = rootStore.liveWidgets;
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
    const store = rootStore.liveWidgets;
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
    const store = rootStore.liveWidgets;

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
    const store = rootStore.liveWidgets;
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
    rootStore.liveWidgets.setLayouts(
      [layout('layout-race'), layout('layout-garage')],
      'layout-race'
    );
  });

  it('writes an edit straight into the layout record, with nothing to commit', () => {
    const store = rootStore.liveWidgets;

    store.updatePosition('fuel', 640, 480);

    const stored = rootStore.layouts.editingLayout!.widgets.find(
      (widget) => widget.id === 'fuel'
    )!.userSettings;

    expect(stored.x).toBe(640);
    expect(stored.y).toBe(480);
  });

  // The debounce used to be the only thing writing edits back into the layout,
  // so anything that switched layouts inside its 500 ms window took the old
  // layout's widgets with it and dropped the edit.
  it('keeps an edit made immediately before a layout switch', () => {
    const store = rootStore.liveWidgets;

    store.updatePosition('fuel', 640, 480);
    store.loadLayout('layout-garage');
    store.loadLayout('layout-race');

    expect(store.getWidget('fuel')!.userSettings.x).toBe(640);
  });

  it('does not leak an edit into the layout that was not active', () => {
    const store = rootStore.liveWidgets;

    store.updatePosition('fuel', 640, 480);

    const other = rootStore.layouts.layouts
      .find((entry) => entry.id === 'layout-garage')!
      .widgets.find((widget) => widget.id === 'fuel');

    expect(other?.userSettings.x).not.toBe(640);
  });

  it('undoes an edit on the layout record itself', () => {
    const store = rootStore.liveWidgets;
    const before = store.getWidget('fuel')!.userSettings.x;

    store.pushUndo();
    store.updatePosition('fuel', 640, 480);
    store.undo();

    expect(store.getWidget('fuel')!.userSettings.x).toBe(before);
    expect(
      rootStore.layouts.editingLayout!.widgets.find(
        (widget) => widget.id === 'fuel'
      )!.userSettings.x
    ).toBe(before);
  });

  it('falls back to the shipped defaults while no layout is active', () => {
    const store = rootStore.liveWidgets;

    store.selectLayout(null);

    expect(rootStore.layouts.editingLayout).toBeUndefined();
    expect(store.getWidget('fuel')).toBeDefined();
  });
});

describe('a layout with no monitors is not written to', () => {
  // Removing a layout's last screen leaves its widgets in the record. Loading
  // it falls back to a blank starter set, and that set must not be mistaken for
  // an edit and saved over the arrangement the driver still has.
  it('keeps the saved widgets when the layout is loaded without a screen', () => {
    const rootStore = new RootStore({ skipInit: true });
    const store = rootStore.liveWidgets;

    store.setLayouts(
      [
        {
          id: 'layout-screenless',
          name: 'Screenless',
          createdAt: Date.now(),
          monitors: [],
          widgets: [
            {
              id: 'fuel',
              designWidth: 300,
              designHeight: 200,
              userSettings: { x: 111, y: 222 },
            } as unknown as (typeof store.allWidgets)[number],
          ],
        },
      ],
      'layout-screenless'
    );

    store.loadLayout('layout-screenless');

    const saved = rootStore.layouts.layouts[0].widgets.find(
      (widget) => widget.id === 'fuel'
    )!.userSettings;

    expect(saved.x).toBe(111);
    expect(saved.y).toBe(222);
  });
});

describe('the overlay reports only what it edited', () => {
  const MONITOR = {
    name: 'DISPLAY1',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  };

  let rootStore: RootStore;

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
    rootStore.liveWidgets.setLayouts(
      [
        {
          id: 'layout-race',
          name: 'Race',
          createdAt: Date.now(),
          monitors: [MONITOR],
          widgets: [],
        },
      ],
      'layout-race'
    );
    rootStore.liveWidgets.drainTouchedWidgets();
  });

  it('drains a patch of the edited widgets, not the whole layout', () => {
    const store = rootStore.liveWidgets;

    store.updatePosition('fuel', 640, 480);
    store.updateSize('fuel', 300, 200);
    store.setWidgetEnabled('timer', false);

    const drained = store.drainTouchedWidgets();

    expect(drained.everyWidget).toBe(false);
    expect(drained.widgets.map((widget) => widget.id).sort()).toEqual([
      'fuel',
      'timer',
    ]);
  });

  it('drains nothing when nothing was edited', () => {
    const store = rootStore.liveWidgets;

    store.updatePosition('fuel', 10, 20);
    store.drainTouchedWidgets();

    expect(store.drainTouchedWidgets().widgets).toEqual([]);
  });

  it('reports the whole map when a layout is installed wholesale', () => {
    const store = rootStore.liveWidgets;

    store.loadLayout('layout-race');

    const drained = store.drainTouchedWidgets();

    expect(drained.everyWidget).toBe(true);
    expect(drained.widgets.length).toBe(store.allWidgets.length);
  });
});

describe('several copies of one widget in a layout', () => {
  let rootStore: RootStore;

  const MONITOR = {
    name: 'DISPLAY1',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  };

  const STREAM_SCREEN = {
    name: 'Stream',
    bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
    kind: 'remote' as const,
    slug: 'stream',
  };

  const layout = (id: string) => ({
    id,
    name: id,
    createdAt: Date.now(),
    monitors: [MONITOR, STREAM_SCREEN],
    widgets: [],
  });

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
    rootStore.liveWidgets.setLayouts(
      [layout('layout-race'), layout('layout-garage')],
      'layout-race'
    );
  });

  it('gives a copy its own id and points it back at the original', () => {
    const store = rootStore.liveWidgets;

    const copyId = store.duplicateWidget('standings')!;
    const copy = store.getWidget(copyId)!;

    expect(copyId).not.toBe('standings');
    expect(copy.type).toBe('standings');
    expect(store.widgetsOfType('standings')).toHaveLength(2);
  });

  it('leaves the original alone when the copy is edited', () => {
    const store = rootStore.liveWidgets;

    const copyId = store.duplicateWidget('standings')!;

    store.updateUserSettings(copyId, { fontScale: 2 });

    expect(store.getWidget(copyId)!.userSettings.fontScale).toBe(2);
    expect(store.getWidget('standings')!.userSettings.fontScale).not.toBe(2);
  });

  it('hides a copy without hiding the widget it was copied from', () => {
    const store = rootStore.liveWidgets;

    const copyId = store.duplicateWidget('standings')!;

    store.setWidgetEnabled(copyId, false);

    expect(store.getWidget(copyId)!.userSettings.enabled).toBe(false);
    expect(store.getWidget('standings')!.userSettings.enabled).toBe(true);
  });

  // The whole point of the split: the original's id doubles as its type, so a
  // settings file written before copies existed needs no migration.
  it('keeps a file that predates copies readable as the original', () => {
    const store = rootStore.liveWidgets;

    store.setWidgets([
      {
        ...store.getWidget('standings')!,
        userSettings: { ...store.getWidget('standings')!.userSettings, x: 42 },
      },
    ]);

    const restored = store.getWidget('standings')!;

    expect(restored.type).toBeUndefined();
    expect(restored.userSettings.x).toBe(42);
  });

  it('survives the round trip through a layout switch', () => {
    const store = rootStore.liveWidgets;

    const copyId = store.duplicateWidget('standings')!;

    store.updateUserSettings(copyId, { x: 2200 });
    store.selectLayout('layout-garage');
    store.selectLayout('layout-race');

    expect(store.getWidget(copyId)?.userSettings.x).toBe(2200);
    expect(store.widgetsOfType('standings')).toHaveLength(2);
  });

  it('never merges two copies onto one record when the layout is installed', () => {
    const store = rootStore.liveWidgets;

    store.duplicateWidget('standings');
    store.duplicateWidget('standings');

    // Reinstalling the layout's own list is what a layout switch does, and it
    // used to be where a second copy quietly disappeared.
    store.setWidgets(
      rootStore.layouts.editingLayout!.widgets.map((widget) => ({ ...widget }))
    );

    expect(store.widgetsOfType('standings')).toHaveLength(3);
  });

  it('deletes a copy but refuses to delete the original', () => {
    const store = rootStore.liveWidgets;

    const copyId = store.duplicateWidget('standings')!;

    store.removeWidgetCopy('standings');
    expect(store.getWidget('standings')).toBeDefined();

    store.removeWidgetCopy(copyId);
    expect(store.getWidget(copyId)).toBeUndefined();
  });

  // What an overlay window and a remote screen do with the list main sends
  // them. Before copies existed the set never changed, so a per-field patch was
  // enough; now an arrival and a deletion both have to land.
  it('installs a copy a synced list carries and drops one it has lost', () => {
    const store = rootStore.liveWidgets;

    const incoming = store.allWidgets.map((widget) => ({
      ...widget,
      userSettings: { ...widget.userSettings },
    }));

    const copy = {
      ...incoming[0],
      id: 'standings-2',
      type: 'standings',
      userSettings: { ...incoming[0].userSettings, x: 1234 },
    };

    store.syncWidgetSet([...incoming, copy]);

    expect(store.getWidget('standings-2')?.userSettings.x).toBe(1234);

    store.syncWidgetSet(incoming);

    expect(store.getWidget('standings-2')).toBeUndefined();
  });

  // The reset this cost once: a receiver that filled a widget the list left out
  // with its shipped default answered back with a default-placed widget, and
  // the window that had sent the list took that answer for an edit.
  it('adopts a synced list without inventing defaults or reporting an edit', () => {
    const store = rootStore.liveWidgets;

    store.updateUserSettings('standings', { x: 1500 });

    const before = rootStore.settingsMutations.changeToken;
    const standings = {
      ...store.getWidget('standings')!,
      userSettings: { ...store.getWidget('standings')!.userSettings },
    };

    store.syncWidgetSet([standings]);

    expect(store.allWidgets).toHaveLength(1);
    expect(store.getWidget('standings')!.userSettings.x).toBe(1500);
    expect(rootStore.settingsMutations.changeToken).toBe(before);
  });

  // The crash a copy caused in the editor: a store handed an id it holds no
  // record for used to answer with nothing at all, and every widget reads its
  // settings without checking.
  it('answers with the defaults of the type behind a copy id it has no record of', () => {
    const store = rootStore.liveWidgets;

    expect(store.getSettings('standings-7')).toBeDefined();
  });

  it('counts the widget as in the layout while any copy of it is', () => {
    const store = rootStore.liveWidgets;

    const copyId = store.duplicateWidget('standings')!;

    store.setWidgetEnabled('standings', false);

    expect(store.isWidgetOnScreen('standings')).toBe(true);

    store.setWidgetEnabled(copyId, false);

    expect(store.isWidgetOnScreen('standings')).toBe(false);
  });
});

/**
 * Every write, and the mark it leaves.
 *
 * Two things happen on a settings write besides the write itself: a token moves
 * (`changeToken` for a local edit, `syncToken` for one that arrived from the
 * other window and must not be echoed back), and the widgets that changed are
 * recorded so the overlay can be sent a patch instead of the whole layout.
 * Both are why a write reaches disk at all, and both are spelled out by hand at
 * every call site — so a write that forgets them fails in the worst way: the
 * edit is on screen and is never saved.
 *
 * This table pins what each write marks today, so the rule can be moved without
 * anyone having to remember which of the thirty-odd writes was the exception.
 */
describe('every settings write leaves its mark', () => {
  const DISPLAY = {
    name: 'DISPLAY1',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  };

  const SECOND_LAYOUT = {
    id: 'layout-quali',
    name: 'Quali',
    createdAt: 0,
    monitors: [DISPLAY],
    widgets: [],
  };

  // What the other window sends back: the same widgets, as detached records.
  // Handing the store its own live objects would compare equal to itself and
  // hide whether the applier marked anything.
  const clonedWidgets = (store: LiveWidgetsStore) =>
    store.allWidgets.map((widget) => ({
      ...widget,
      userSettings: { ...widget.userSettings },
    }));

  type WriteMark = {
    /** Which counter the write is expected to move. */
    token: 'change' | 'sync' | 'none';
    /** 'every' = the whole map is sent; a list = a patch of those widgets. */
    touched: 'every' | 'none' | string[];
  };

  type WriteCase = {
    name: string;
    /** Runs before the measurement, so the case measures one write only. */
    setup?: (
      store: LiveWidgetsStore,
      layouts: LayoutsStore,
      editor: LayoutEditorStore
    ) => void;
    /**
     * Layout records are written through `layouts`, the editing session through
     * `editor`, the live widget map through `store` — which of the three a
     * write goes through is itself part of what this table pins.
     */
    run: (
      store: LiveWidgetsStore,
      layouts: LayoutsStore,
      editor: LayoutEditorStore
    ) => void;
    expected: WriteMark;
  };

  const WRITES: WriteCase[] = [
    // Widget edits — a patch of the widgets named.
    {
      name: 'updatePosition',
      run: (store) => store.updatePosition('fuel', 640, 480),
      expected: { token: 'change', touched: ['fuel'] },
    },
    {
      name: 'updateSize',
      run: (store) => store.updateSize('fuel', 300, 200),
      expected: { token: 'change', touched: ['fuel'] },
    },
    {
      name: 'updateUserSettings',
      run: (store) => store.updateUserSettings('fuel', { x: 12 }),
      expected: { token: 'change', touched: ['fuel'] },
    },
    {
      name: 'setWidgetEnabled',
      run: (store) => store.setWidgetEnabled('timer', false),
      expected: { token: 'change', touched: ['timer'] },
    },
    {
      name: 'bringToFront',
      run: (store) => store.bringToFront('fuel'),
      expected: { token: 'change', touched: ['fuel'] },
    },
    {
      name: 'sendToBack',
      run: (store) => store.sendToBack('fuel'),
      expected: { token: 'change', touched: ['fuel'] },
    },
    {
      name: 'addWidgetToMonitor',
      run: (store) => store.addWidgetToMonitor('fuel', DISPLAY.name),
      expected: { token: 'change', touched: ['fuel'] },
    },
    {
      name: 'moveWidgetToMonitor',
      setup: (_store, layouts) => layouts.addRemoteScreen('Tablet', 1280, 800),
      run: (store) => store.moveWidgetToMonitor('fuel', 'Tablet'),
      expected: { token: 'change', touched: ['fuel'] },
    },

    // Writes that install a map wholesale — only a full list describes them.
    {
      name: 'setWidgets',
      run: (store) => store.setWidgets(store.allWidgets),
      expected: { token: 'change', touched: 'every' },
    },
    {
      name: 'duplicateWidget',
      run: (store) => store.duplicateWidget('fuel'),
      expected: { token: 'change', touched: 'every' },
    },
    {
      name: 'removeWidgetCopy',
      setup: (store) => store.duplicateWidget('fuel'),
      run: (store) => {
        const copy = store
          .widgetsOfType('fuel')
          .find((widget) => widget.id !== 'fuel')!;

        store.removeWidgetCopy(copy.id);
      },
      expected: { token: 'change', touched: 'every' },
    },
    {
      name: 'undo',
      setup: (store) => store.setWidgetEnabled('timer', false),
      run: (store) => store.undo(),
      expected: { token: 'change', touched: 'every' },
    },
    {
      name: 'redo',
      setup: (store) => {
        store.setWidgetEnabled('timer', false);
        store.undo();
      },
      run: (store) => store.redo(),
      expected: { token: 'change', touched: 'every' },
    },

    // Layout records.
    {
      name: 'setSessionLayout',
      run: (_store, layouts) => layouts.setSessionLayout('Race', 'layout-race'),
      expected: { token: 'change', touched: 'every' },
    },
    {
      name: 'setSessionLayouts',
      run: (_store, layouts) =>
        layouts.setSessionLayouts({ Race: 'layout-race' }),
      expected: { token: 'change', touched: 'every' },
    },
    // `createLayout` is deliberately absent: it marks synchronously and then
    // asks the OS for a monitor and marks a second time when the answer lands.
    // Neither the second mark nor the monitor call can be measured here without
    // stubbing Tauri, and a table case that pins only the first half would read
    // as if that were the whole write. First-run setup left this store entirely
    // — see `first-run.test.ts`.
    {
      name: 'loadLayout',
      run: (store) => store.loadLayout('layout-race'),
      expected: { token: 'change', touched: 'every' },
    },
    {
      name: 'selectLayout',
      run: (store) => store.selectLayout('layout-race'),
      expected: { token: 'change', touched: 'every' },
    },
    {
      name: 'switchLayout',
      setup: (store, layouts) =>
        store.setLayouts([...layouts.layouts, SECOND_LAYOUT]),
      run: (_store, _layouts, editor) => editor.switchLayout(SECOND_LAYOUT.id),
      expected: { token: 'change', touched: 'every' },
    },
    {
      name: 'activateLayout',
      setup: (store, layouts, editor) => {
        store.setLayouts([...layouts.layouts, SECOND_LAYOUT]);
        editor.switchLayout(SECOND_LAYOUT.id);
      },
      run: (_store, _layouts, editor) => editor.activateLayout(),
      expected: { token: 'change', touched: 'every' },
    },
    {
      name: 'updateLayout',
      run: (store) => store.updateLayout('layout-race'),
      expected: { token: 'change', touched: 'every' },
    },
    {
      name: 'renameLayout',
      run: (_store, layouts) => layouts.renameLayout('layout-race', 'Renamed'),
      expected: { token: 'change', touched: 'every' },
    },
    {
      name: 'deleteLayout',
      setup: (store, layouts) =>
        store.setLayouts([...layouts.layouts, SECOND_LAYOUT]),
      run: (store, layouts) =>
        deleteLayout({ records: layouts, widgetMap: store }, SECOND_LAYOUT.id),
      expected: { token: 'change', touched: 'every' },
    },

    // Writes that arrived from the other window: saved, never echoed back.
    {
      name: 'syncWidgetSet',
      setup: (store) => store.updateUserSettings('fuel', { x: 33 }),
      run: (store) => store.syncWidgetSet(clonedWidgets(store)),
      expected: { token: 'sync', touched: 'none' },
    },
    {
      name: 'applySettingsSync',
      setup: (store) => store.updateUserSettings('fuel', { x: 33 }),
      run: (store) => store.applySettingsSync(clonedWidgets(store)),
      expected: { token: 'sync', touched: 'none' },
    },
    {
      name: 'applySettingsSyncForMonitor',
      setup: (store) => store.updateUserSettings('fuel', { x: 33 }),
      run: (store) =>
        store.applySettingsSyncForMonitor(DISPLAY.name, clonedWidgets(store)),
      expected: { token: 'sync', touched: 'none' },
    },

    // Writes that mark nothing at all. Pinned deliberately: the monitor
    // arrangement the overlay adopts is written into the active layout record
    // and left unmarked, so nothing saves it on its own — the main window's own
    // write is what carries it to disk.
    {
      name: 'applyMonitorsSync',
      run: (store) => store.applyMonitorsSync([DISPLAY]),
      expected: { token: 'none', touched: 'none' },
    },
    {
      name: 'setOverlayResolution',
      run: (store) => store.setOverlayResolution({ width: 1280, height: 720 }),
      expected: { token: 'none', touched: 'none' },
    },
    {
      name: 'setAttachedMonitors',
      run: (store) => store.setAttachedMonitors([DISPLAY]),
      expected: { token: 'none', touched: 'none' },
    },
    {
      name: 'setOwnMonitorName',
      run: (store) => store.setOwnMonitorName(DISPLAY.name),
      expected: { token: 'none', touched: 'none' },
    },
  ];

  it.each(WRITES)('$name', ({ setup, run, expected }) => {
    const rootStore = new RootStore({ skipInit: true });
    const store = rootStore.liveWidgets;

    store.setLayouts(
      [
        {
          id: 'layout-race',
          name: 'Race',
          createdAt: 0,
          monitors: [DISPLAY],
          widgets: [],
        },
      ],
      'layout-race'
    );

    setup?.(store, rootStore.layouts, rootStore.layoutEditor);

    // Everything above is arrangement, not the write under test.
    store.drainTouchedWidgets();

    const changeBefore = rootStore.settingsMutations.changeToken;
    const syncBefore = rootStore.settingsMutations.syncToken;

    run(store, rootStore.layouts, rootStore.layoutEditor);

    const drained = store.drainTouchedWidgets();

    expect({
      change: rootStore.settingsMutations.changeToken > changeBefore,
      sync: rootStore.settingsMutations.syncToken > syncBefore,
    }).toEqual({
      change: expected.token === 'change',
      sync: expected.token === 'sync',
    });

    if (expected.touched === 'every') {
      expect(drained.everyWidget).toBe(true);

      return;
    }

    expect(drained.everyWidget).toBe(false);

    if (expected.touched === 'none') {
      expect(drained.widgets).toEqual([]);

      return;
    }

    expect(drained.widgets.map((widget) => widget.id).sort()).toEqual(
      [...expected.touched].sort()
    );
  });
});
