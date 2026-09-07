import { describe, it, expect } from 'vitest';

import { LayoutsStore } from './layouts.store';
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
 * layout record needs. No RootStore, no widget map: the records are what
 * widgets stand on, and they answer for themselves.
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
