import { describe, it, expect, beforeEach } from 'vitest';
import { runInAction } from 'mobx';
import { MainRoot } from '@app/roots/main-root';
import type { CapabilitiesPayload } from '@shared/contracts/bindings';
import { deleteLayout } from '@features/layout-editor/layout-gestures';
import type { LayoutsStore } from './layouts.store';
import type { LayoutEditorStore } from '@features/layout-editor/layout-editor.store';
import type { LiveWidgetsStore } from './live-widgets.store';
import type { StandingsViewMode } from '@shared/contracts/widget-choices';

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
  let rootStore: MainRoot;

  beforeEach(() => {
    rootStore = new MainRoot({ skipInit: true });
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
  let rootStore: MainRoot;

  beforeEach(() => {
    rootStore = new MainRoot({ skipInit: true });
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
  let rootStore: MainRoot;
  const SECOND_MONITOR_X = 1920;

  beforeEach(() => {
    rootStore = new MainRoot({ skipInit: true });
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

    const addedId = rootStore.liveWidgets.setTypeEnabledOnMonitor(
      widget.type,
      'DISPLAY2',
      true
    )!;

    const added = rootStore.liveWidgets.getWidget(addedId)!;
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

    const firstId = rootStore.liveWidgets.setTypeEnabledOnMonitor(
      first.type,
      'DISPLAY2',
      true
    )!;
    const secondId = rootStore.liveWidgets.setTypeEnabledOnMonitor(
      second.type,
      'DISPLAY2',
      true
    )!;

    const placedFirst = rootStore.liveWidgets.getWidget(firstId)!;
    const placedSecond = rootStore.liveWidgets.getWidget(secondId)!;

    expect(placedSecond.userSettings.x).not.toBe(placedFirst.userSettings.x);
    expect(placedSecond.userSettings.zIndex).toBeGreaterThan(
      placedFirst.userSettings.zIndex ?? 0
    );
  });

  // Each screen has its own set: a widget switched on on one screen is still
  // there to pick on the other, and picking it there makes a second instance.
  it('offers a widget on every screen it is not switched on on', () => {
    const [widget] = rootStore.liveWidgets.allWidgets;

    rootStore.liveWidgets.setTypeEnabledOnMonitor(
      widget.type,
      'DISPLAY2',
      true
    );

    const onFirst = rootStore.liveWidgets.pickableWidgetsForMonitor('DISPLAY1');
    const onSecond =
      rootStore.liveWidgets.pickableWidgetsForMonitor('DISPLAY2');

    expect(onFirst.some((candidate) => candidate.type === widget.type)).toBe(
      true
    );
    expect(onSecond.some((candidate) => candidate.type === widget.type)).toBe(
      false
    );
  });
});

describe('derived design width', () => {
  it('rebuilds a stale design width when a layout copy is installed', () => {
    const rootStore = new MainRoot({ skipInit: true });
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
    const rootStore = new MainRoot({ skipInit: true });
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
    const rootStore = new MainRoot({ skipInit: true });
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
    const rootStore = new MainRoot({ skipInit: true });
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

    // An overlay's popup narrowing the name column, as a command: only the
    // field it changed, the width is main's to recompute.
    store.applyClientCommand(() =>
      store.updateUserSettings('standings', { nameColumnWidth: 100 })
    );

    const synced = store.getWidget('standings')!;

    expect(synced.designWidth).toBe(shippedWidth - (200 - 100));
  });

  it('follows the name column width without touching other widgets', () => {
    const rootStore = new MainRoot({ skipInit: true });
    const store = rootStore.liveWidgets;
    const before = store.getWidget('standings')!.designWidth;
    const timerWidth = store.getWidget('timer')!.designWidth;

    store.updateUserSettings('standings', { nameColumnWidth: 150 });

    const standings = store.getWidget('standings')!;

    expect(before - standings.designWidth).toBe(
      200 - (standings.userSettings.nameColumnWidth as number)
    );
    expect(store.getWidget('timer')!.designWidth).toBe(timerWidth);
  });
});

describe('the active layout owns the widgets', () => {
  let rootStore: MainRoot;

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
    rootStore = new MainRoot({ skipInit: true });
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
    const rootStore = new MainRoot({ skipInit: true });
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

describe('several copies of one widget in a layout', () => {
  let rootStore: MainRoot;

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
    rootStore = new MainRoot({ skipInit: true });
    rootStore.liveWidgets.setLayouts(
      [layout('layout-race'), layout('layout-garage')],
      'layout-race'
    );
    rootStore.liveWidgets.setWidgetEnabled('standings', true);
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

  it('puts a copy on the monitor of the widget it was copied from', () => {
    const store = rootStore.liveWidgets;

    store.moveWidgetToMonitor('standings', 'Stream');

    const copyId = store.duplicateWidget('standings')!;

    expect(store.getWidget(copyId)!.monitor).toBe('Stream');
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

  // The first instance on a monitor is the widget on that screen — its switch
  // takes it off. Only a further instance on the same monitor is a copy.
  it('deletes a copy but not the first instance on its monitor', () => {
    const store = rootStore.liveWidgets;

    const copyId = store.duplicateWidget('standings')!;

    store.removeWidgetCopy('standings');
    expect(store.getWidget('standings')).toBeDefined();

    store.removeWidgetCopy(copyId);
    expect(store.getWidget(copyId)).toBeUndefined();
  });

  it('numbers instances per monitor, not across the layout', () => {
    const store = rootStore.liveWidgets;

    const copyId = store.duplicateWidget('standings')!;
    const streamId = store.setTypeEnabledOnMonitor(
      'standings',
      'Stream',
      true
    )!;

    expect(store.copyOrdinalOf(copyId)).toEqual({ ordinal: 2, total: 2 });
    expect(store.copyOrdinalOf(streamId)).toEqual({ ordinal: 1, total: 1 });
    expect(store.canRemoveWidget(streamId)).toBe(false);
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
  it('adopts a synced list without inventing defaults', () => {
    const store = rootStore.liveWidgets;

    store.updateUserSettings('standings', { x: 1500 });

    const standings = {
      ...store.getWidget('standings')!,
      userSettings: { ...store.getWidget('standings')!.userSettings },
    };

    store.syncWidgetSet([standings]);

    expect(store.allWidgets).toHaveLength(1);
    expect(store.getWidget('standings')!.userSettings.x).toBe(1500);
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
 * A settings write moves `changeToken` besides the write itself, and that is
 * why it reaches disk and the other windows at all. It is spelled out by hand
 * at every call site — so a write that forgets it fails in the worst way: the
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
    /** Whether the write moves `changeToken` — what saves it and publishes it. */
    changes: boolean;
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
      expected: { changes: true },
    },
    {
      name: 'updateSize',
      run: (store) => store.updateSize('fuel', 300, 200),
      expected: { changes: true },
    },
    {
      name: 'updateUserSettings',
      run: (store) => store.updateUserSettings('fuel', { x: 12 }),
      expected: { changes: true },
    },
    {
      name: 'setWidgetEnabled',
      run: (store) => store.setWidgetEnabled('timer', false),
      expected: { changes: true },
    },
    {
      name: 'bringToFront',
      run: (store) => store.bringToFront('fuel'),
      expected: { changes: true },
    },
    {
      name: 'sendToBack',
      run: (store) => store.sendToBack('fuel'),
      expected: { changes: true },
    },
    {
      name: 'setTypeEnabledOnMonitor, switching an instance back on',
      setup: (store) =>
        store.setTypeEnabledOnMonitor('fuel', DISPLAY.name, false),
      run: (store) => store.setTypeEnabledOnMonitor('fuel', DISPLAY.name, true),
      expected: { changes: true },
    },
    {
      name: 'resetSettings',
      run: (store) => store.resetSettings('fuel'),
      expected: { changes: true },
    },
    {
      name: 'moveWidgetToMonitor',
      setup: (_store, layouts) => layouts.addRemoteScreen('Tablet', 1280, 800),
      run: (store) => store.moveWidgetToMonitor('fuel', 'Tablet'),
      expected: { changes: true },
    },

    // Writes that install a map wholesale — only a full list describes them.
    {
      name: 'setWidgets',
      run: (store) => store.setWidgets(store.allWidgets),
      expected: { changes: true },
    },
    {
      name: 'duplicateWidget',
      run: (store) => store.duplicateWidget('fuel'),
      expected: { changes: true },
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
      expected: { changes: true },
    },
    {
      name: 'undo',
      setup: (store) => store.setWidgetEnabled('timer', false),
      run: (store) => store.undo(),
      expected: { changes: true },
    },
    {
      name: 'redo',
      setup: (store) => {
        store.setWidgetEnabled('timer', false);
        store.undo();
      },
      run: (store) => store.redo(),
      expected: { changes: true },
    },

    // Layout records.
    {
      name: 'setSessionLayout',
      run: (_store, layouts) => layouts.setSessionLayout('Race', 'layout-race'),
      expected: { changes: true },
    },
    {
      name: 'setSessionLayouts',
      run: (_store, layouts) =>
        layouts.setSessionLayouts({ Race: 'layout-race' }),
      expected: { changes: true },
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
      expected: { changes: true },
    },
    {
      name: 'selectLayout',
      run: (store) => store.selectLayout('layout-race'),
      expected: { changes: true },
    },
    {
      name: 'switchLayout',
      setup: (store, layouts) =>
        store.setLayouts([...layouts.layouts, SECOND_LAYOUT]),
      run: (_store, _layouts, editor) => editor.switchLayout(SECOND_LAYOUT.id),
      expected: { changes: true },
    },
    {
      name: 'activateLayout',
      setup: (store, layouts, editor) => {
        store.setLayouts([...layouts.layouts, SECOND_LAYOUT]);
        editor.switchLayout(SECOND_LAYOUT.id);
      },
      run: (_store, _layouts, editor) => editor.activateLayout(),
      expected: { changes: true },
    },
    {
      name: 'updateLayout',
      run: (store) => store.updateLayout('layout-race'),
      expected: { changes: true },
    },
    {
      name: 'renameLayout',
      run: (_store, layouts) => layouts.renameLayout('layout-race', 'Renamed'),
      expected: { changes: true },
    },
    {
      name: 'deleteLayout',
      setup: (store, layouts) =>
        store.setLayouts([...layouts.layouts, SECOND_LAYOUT]),
      run: (store, layouts) =>
        deleteLayout({ records: layouts, widgetMap: store }, SECOND_LAYOUT.id),
      expected: { changes: true },
    },

    // Writes that arrived from the other window: saved, never echoed back.
    {
      name: 'syncWidgetSet',
      setup: (store) => store.updateUserSettings('fuel', { x: 33 }),
      run: (store) => store.syncWidgetSet(clonedWidgets(store)),
      expected: { changes: true },
    },
    {
      name: 'applySettingsSync',
      setup: (store) => store.updateUserSettings('fuel', { x: 33 }),
      run: (store) => store.applySettingsSync(clonedWidgets(store)),
      expected: { changes: true },
    },

    // An overlay installing main's snapshot: main's state arriving, so it is
    // neither saved nor reported back — whether the layout changed or not.
    {
      name: 'applyClientScreen (same layout)',
      run: (store, layouts) =>
        store.applyClientScreen({
          layoutId: layouts.editingLayoutId!,
          layoutName: 'Race',
          monitor: DISPLAY,
          widgets: clonedWidgets(store),
        }),
      expected: { changes: true },
    },
    {
      name: 'applyClientScreen (another layout)',
      run: (store) =>
        store.applyClientScreen({
          layoutId: 'layout-from-main',
          layoutName: 'Qualifying',
          monitor: DISPLAY,
          widgets: clonedWidgets(store),
        }),
      expected: { changes: true },
    },

    // Writes that mark nothing at all.
    {
      name: 'setOverlayResolution',
      run: (store) => store.setOverlayResolution({ width: 1280, height: 720 }),
      expected: { changes: false },
    },
    {
      name: 'setAttachedMonitors',
      run: (store) => store.setAttachedMonitors([DISPLAY]),
      expected: { changes: false },
    },
    {
      name: 'setOwnMonitorName',
      run: (store) => store.setOwnMonitorName(DISPLAY.name),
      expected: { changes: false },
    },
  ];

  it.each(WRITES)('$name', ({ setup, run, expected }) => {
    const rootStore = new MainRoot({ skipInit: true });
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

    const changeBefore = rootStore.settingsMutations.changeToken;

    run(store, rootStore.layouts, rootStore.layoutEditor);

    expect(rootStore.settingsMutations.changeToken > changeBefore).toBe(
      expected.changes
    );
  });
});

describe('the widgets a remote screen draws', () => {
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

  const layoutWithScreens = (id: string) => ({
    id,
    name: id,
    createdAt: Date.now(),
    monitors: [MONITOR, STREAM_SCREEN],
    widgets: [],
  });

  it('is empty while every widget sits on a display', () => {
    const rootStore = new MainRoot({ skipInit: true });
    const store = rootStore.liveWidgets;

    store.setLayouts([layoutWithScreens('layout-race')], 'layout-race');

    expect(store.liveRemoteScreenWidgets).toHaveLength(0);
  });

  it('carries only the widgets that belong to the remote screen', () => {
    const rootStore = new MainRoot({ skipInit: true });
    const store = rootStore.liveWidgets;

    store.setLayouts([layoutWithScreens('layout-race')], 'layout-race');
    store.moveWidgetToMonitor('standings', 'Stream');

    expect(store.liveRemoteScreenWidgets.map((widget) => widget.id)).toEqual([
      'standings',
    ]);
  });

  it('is empty when the layout has no remote screen at all', () => {
    const rootStore = new MainRoot({ skipInit: true });
    const store = rootStore.liveWidgets;

    store.setLayouts(
      [
        {
          id: 'layout-race',
          name: 'layout-race',
          createdAt: Date.now(),
          monitors: [MONITOR],
          widgets: [],
        },
      ],
      'layout-race'
    );
    store.updateUserSettings('standings', { x: 2000, y: 100 });

    expect(store.liveRemoteScreenWidgets).toHaveLength(0);
  });
});

/**
 * Each monitor owns its own widget set. A widget belongs to the monitor its
 * `monitor` field names — never to whichever one its position falls on — and
 * only an explicit move hands it to another one.
 */
describe('widgets belong to their monitor', () => {
  const LEFT = {
    name: 'LEFT',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  };

  const RIGHT = {
    name: 'RIGHT',
    bounds: { x: 1920, y: 0, width: 2560, height: 1440 },
  };

  const STREAM = {
    name: 'STREAM',
    kind: 'remote' as const,
    slug: 'stream',
    bounds: { x: 0, y: 1440, width: 1920, height: 1080 },
  };

  const setUp = () => {
    const rootStore = new MainRoot({ skipInit: true });

    rootStore.liveWidgets.setLayouts(
      [
        {
          id: 'race',
          name: 'race',
          createdAt: 1,
          monitors: [STREAM, LEFT, RIGHT],
          widgets: [],
        },
      ],
      'race'
    );

    return rootStore.liveWidgets;
  };

  // The first display, not the first monitor: a browser screen listed ahead
  // of it is never where a widget with nowhere else to stand goes.
  it('gives every widget the layout lacks a switched-off instance on the first display', () => {
    const store = setUp();

    expect(
      store.allWidgets.every(
        (widget) =>
          widget.monitor === 'LEFT' && widget.userSettings.enabled === false
      )
    ).toBe(true);
  });

  // The whole point of storing the owner: dragging can no longer hand a widget
  // to the neighbouring screen.
  it('keeps a dragged widget inside its own monitor', () => {
    const store = setUp();
    const { currentWidth, currentHeight } =
      store.getWidget('standings')!.userSettings;

    store.updatePosition('standings', 3000, 5000);

    const widget = store.getWidget('standings')!;

    expect(widget.monitor).toBe('LEFT');
    expect(widget.userSettings.x).toBe(LEFT.bounds.width - currentWidth);
    expect(widget.userSettings.y).toBe(LEFT.bounds.height - currentHeight);
  });

  // An auto-height widget draws as tall as its content, and its stored
  // height is only the manifest's — clamping by it stopped the widget short
  // of the bottom edge.
  it('lets an auto-height widget reach the bottom of its monitor', () => {
    const store = setUp();

    expect(store.getWidget('fuel')!.autoHeight).toBe(true);

    store.updatePosition('fuel', 0, LEFT.bounds.height - 40);

    expect(store.getWidget('fuel')!.userSettings.y).toBe(
      LEFT.bounds.height - 40
    );

    store.updatePosition('fuel', 0, LEFT.bounds.height + 500);

    // Never out of sight entirely: a strip along its top stays on screen.
    expect(store.getWidget('fuel')!.userSettings.y).toBe(
      LEFT.bounds.height - 24
    );
  });

  it('moves a widget to another monitor with every setting it has', () => {
    const store = setUp();

    store.updateUserSettings('standings', { fontScale: 1.7 });
    store.updatePosition('standings', 96, 54);
    store.moveWidgetToMonitor('standings', 'RIGHT');

    const widget = store.getWidget('standings')!;

    expect(widget.monitor).toBe('RIGHT');
    expect(widget.userSettings.fontScale).toBe(1.7);
    // The same relative place: 5% in from the left, 5% down.
    expect(widget.userSettings.x).toBe(RIGHT.bounds.x + 128);
    expect(widget.userSettings.y).toBe(72);
  });

  it('undoes a move to another monitor', () => {
    const store = setUp();

    store.moveWidgetToMonitor('standings', 'RIGHT');
    store.undo();

    expect(store.getWidget('standings')!.monitor).toBe('LEFT');
  });

  it('lets the switched-on instance under the hotkeys speak for its widget', () => {
    const store = setUp();

    const rightId = store.setTypeEnabledOnMonitor('fuel', 'RIGHT', true)!;

    // Only the instance on the other monitor is on: it is the one on screen.
    expect(store.primaryInstanceOf('fuel')!.id).toBe(rightId);

    store.setWidgetEnabled('fuel', true);
    store.setHotkeysActOn(rightId, false);

    // Both on: the one the hotkeys act on wins.
    expect(store.primaryInstanceOf('fuel')!.id).toBe('fuel');
  });

  it('puts every instance under the hotkeys by default, a browser screen too', () => {
    const store = setUp();
    const rightId = store.setTypeEnabledOnMonitor('standings', 'RIGHT', true)!;
    const streamId = store.setTypeEnabledOnMonitor(
      'standings',
      'STREAM',
      true
    )!;

    expect(
      store
        .hotkeyInstancesOf('standings')
        .map((widget) => widget.id)
        .sort()
    ).toEqual(['standings', rightId, streamId].sort());
  });

  it('lets a display speak for the widget ahead of a browser screen', () => {
    const store = setUp();
    const streamId = store.setTypeEnabledOnMonitor('fuel', 'STREAM', true)!;

    store.setWidgetEnabled('fuel', true);

    expect(store.primaryInstanceOf('fuel')!.id).toBe('fuel');

    store.setWidgetEnabled('fuel', false);

    expect(store.primaryInstanceOf('fuel')!.id).toBe(streamId);
  });

  // The visibility hotkey moves the marked instances together: a table on two
  // displays and on the stream hides on all three; an unmarked one stays.
  it('hides and shows every marked instance together, the stream included', () => {
    const store = setUp();

    store.setWidgetEnabled('standings', true);

    const rightId = store.setTypeEnabledOnMonitor('standings', 'RIGHT', true)!;
    const streamId = store.setTypeEnabledOnMonitor(
      'standings',
      'STREAM',
      true
    )!;
    const isOn = (id: string) => store.getWidget(id)!.userSettings.enabled;

    store.toggleVisibilityByHotkey('standings');

    expect([isOn('standings'), isOn(rightId), isOn(streamId)]).toEqual([
      false,
      false,
      false,
    ]);

    store.toggleVisibilityByHotkey('standings');

    expect([isOn('standings'), isOn(rightId), isOn(streamId)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('leaves an unmarked instance alone', () => {
    const store = setUp();

    store.setWidgetEnabled('standings', true);

    const rightId = store.setTypeEnabledOnMonitor('standings', 'RIGHT', true)!;

    store.setHotkeysActOn(rightId, false);
    store.toggleVisibilityByHotkey('standings');

    expect(store.getWidget('standings')!.userSettings.enabled).toBe(false);
    expect(store.getWidget(rightId)!.userSettings.enabled).toBe(true);
  });

  it('carries the view the driver switched to onto the stream', () => {
    const store = setUp();
    const viewOf = (id: string) =>
      store.getSettings<{ viewMode: StandingsViewMode }>(id).viewMode;

    store.setWidgetEnabled('standings', true);

    const streamId = store.setTypeEnabledOnMonitor(
      'standings',
      'STREAM',
      true
    )!;

    store.updateUserSettings('standings', { viewMode: 'all' });
    store.updateUserSettings(streamId, { viewMode: 'cycling' });

    store.cycleStandingsViewMode();

    // Advanced from the driver's screen, and the stream brought in line.
    expect([viewOf('standings'), viewOf(streamId)]).toEqual([
      'grouped',
      'grouped',
    ]);
  });

  it('cycles the view of marked instances only', () => {
    const store = setUp();
    const streamId = store.setTypeEnabledOnMonitor(
      'standings',
      'STREAM',
      true
    )!;

    store.setHotkeysActOn(streamId, false);

    const before = store.getSettings<{ viewMode: StandingsViewMode }>(
      'standings'
    ).viewMode;

    store.cycleStandingsViewMode();

    expect(
      store.getSettings<{ viewMode: StandingsViewMode }>('standings').viewMode
    ).not.toBe(before);
    expect(
      store.getSettings<{ viewMode: StandingsViewMode }>(streamId).viewMode
    ).toBe(before);
  });

  it('stores the hotkey mark only while it departs from the default', () => {
    const store = setUp();

    store.setHotkeysActOn('standings', false);

    expect(store.getWidget('standings')!.hotkeys).toBe(false);

    store.setHotkeysActOn('standings', true);

    expect(store.getWidget('standings')).not.toHaveProperty('hotkeys');
  });

  // A widget store reads by type. Once no instance is special, the record
  // whose id happens to equal the type may be gone — the store must still find
  // the user's settings rather than fall back to the shipped ones.
  it('gives a widget store the settings of the instance that speaks for it', () => {
    const store = setUp();

    // The record named after the type stays switched off on the first
    // monitor; the widget actually on screen is an instance on the other.
    const rightId = store.setTypeEnabledOnMonitor('standings', 'RIGHT', true)!;

    store.updateUserSettings(rightId, { fontScale: 1.9 });

    expect(store.getWidget('standings')!.userSettings.enabled).toBe(false);
    expect(store.settingsOfType('standings').fontScale).toBe(1.9);
  });

  it('lists every widget on a monitor that has none of its own yet', () => {
    const store = setUp();
    const rows = store.monitorWidgetRows('RIGHT');

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.instances.length === 0)).toBe(true);
  });

  it('switches a widget on on the monitor asked, leaving the other alone', () => {
    const store = setUp();

    const createdId = store.setTypeEnabledOnMonitor('fuel', 'RIGHT', true)!;
    const created = store.getWidget(createdId)!;

    expect(createdId).not.toBe('fuel');
    expect(created.monitor).toBe('RIGHT');
    expect(created.userSettings.enabled).toBe(true);
    expect(created.userSettings.x).toBeGreaterThanOrEqual(RIGHT.bounds.x);
    expect(store.getWidget('fuel')!.userSettings.enabled).toBe(false);
  });

  it('switches back on the instance a monitor already has, settings and all', () => {
    const store = setUp();

    const id = store.setTypeEnabledOnMonitor('fuel', 'RIGHT', true)!;

    store.updateUserSettings(id, { fontScale: 1.4 });
    store.setTypeEnabledOnMonitor('fuel', 'RIGHT', false);

    expect(store.getWidget(id)!.userSettings.enabled).toBe(false);
    expect(store.setTypeEnabledOnMonitor('fuel', 'RIGHT', true)).toBe(id);
    expect(store.getWidget(id)!.userSettings.fontScale).toBe(1.4);
    expect(store.widgetsOfType('fuel')).toHaveLength(2);
  });

  it('starts a new instance from the template the Widgets page edits', () => {
    const rootStore = new MainRoot({ skipInit: true });
    const store = rootStore.liveWidgets;

    store.setLayouts(
      [
        {
          id: 'race',
          name: 'race',
          createdAt: 1,
          monitors: [LEFT, RIGHT],
          widgets: [],
        },
      ],
      'race'
    );
    rootStore.widgetDefaults.updateUserSettings('fuel', { opacity: 0.33 });

    const id = store.setTypeEnabledOnMonitor('fuel', 'RIGHT', true)!;

    expect(store.getWidget(id)!.userSettings.opacity).toBe(0.33);
  });

  it('switches off every instance on that monitor and none elsewhere', () => {
    const store = setUp();

    store.setTypeEnabledOnMonitor('fuel', 'LEFT', true);

    const rightId = store.setTypeEnabledOnMonitor('fuel', 'RIGHT', true)!;
    const copyId = store.duplicateWidget(rightId)!;

    store.setTypeEnabledOnMonitor('fuel', 'RIGHT', false);

    expect(store.getWidget(rightId)!.userSettings.enabled).toBe(false);
    expect(store.getWidget(copyId)!.userSettings.enabled).toBe(false);
    expect(store.getWidget('fuel')!.userSettings.enabled).toBe(true);
  });

  it('copies another instance’s settings but not its place, size or switch', () => {
    const store = setUp();

    store.setWidgetEnabled('fuel', true);

    const rightId = store.setTypeEnabledOnMonitor('fuel', 'RIGHT', true)!;
    const before = { ...store.getWidget(rightId)!.userSettings };

    store.updateUserSettings('fuel', { fontScale: 1.6, opacity: 0.4 });
    store.setWidgetEnabled('fuel', false);
    store.copySettingsFrom(rightId, 'fuel');

    const copied = store.getWidget(rightId)!.userSettings;

    expect(copied).toMatchObject({ fontScale: 1.6, opacity: 0.4 });
    expect(copied).toMatchObject({
      x: before.x,
      y: before.y,
      currentWidth: before.currentWidth,
      enabled: true,
    });
  });

  it('offers every other instance of the widget as a settings source', () => {
    const store = setUp();
    const rightId = store.setTypeEnabledOnMonitor('fuel', 'RIGHT', true)!;

    expect(
      store.settingsSourcesFor(rightId).map((widget) => widget.id)
    ).toEqual(['fuel']);
  });

  it('resets an instance to the shipped settings and undoes it', () => {
    const store = setUp();
    const shippedScale = store.getWidget('fuel')!.userSettings.fontScale;

    store.updateUserSettings('fuel', { fontScale: 1.8, x: 300 });
    store.resetSettings('fuel');

    expect(store.getWidget('fuel')!.userSettings.fontScale).toBe(shippedScale);
    expect(store.getWidget('fuel')!.userSettings.x).toBe(300);

    store.undo();

    expect(store.getWidget('fuel')!.userSettings.fontScale).toBe(1.8);
  });

  it('keeps every widget on its monitor across a reinstall', () => {
    const store = setUp();

    store.moveWidgetToMonitor('standings', 'RIGHT');
    store.setWidgets(store.allWidgets);

    expect(store.getWidget('standings')!.monitor).toBe('RIGHT');
  });

  it('carries a monitor change to the other window', () => {
    const main = setUp();
    const overlay = setUp();

    main.moveWidgetToMonitor('standings', 'RIGHT');
    overlay.applySettingsSync(main.allWidgets);

    expect(overlay.getWidget('standings')!.monitor).toBe('RIGHT');
  });
});
