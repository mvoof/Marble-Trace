import { describe, it, expect } from 'vitest';

import {
  setUpFirstRun,
  type FirstRunWidgetMap,
  type PrimaryMonitorResolver,
} from './first-run';
import { LayoutsStore } from './layouts.store';
import type {
  LayoutEditorPin,
  LayoutLifecycleWidgetMap,
} from './layouts.store';
import { SettingsMutationLog } from './mutation-log';
import type {
  LayoutMonitor,
  WidgetDefaultConfig,
} from '@/types/widget-settings';

const STARTER: WidgetDefaultConfig[] = [
  {
    id: 'fuel',
    label: 'Fuel',
    designWidth: 300,
    designHeight: 200,
    userSettings: {
      enabled: true,
      x: 10,
      y: 20,
      currentWidth: 300,
      currentHeight: 200,
      opacity: 1,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
  } as WidgetDefaultConfig,
];

const PRIMARY = {
  name: 'DISPLAY1',
  resolution: { width: 2560, height: 1440 },
};

/**
 * The real record store — first-run setup is judged by what it leaves in the
 * records — with the editing session stubbed out and a widget map that records
 * what it was handed.
 */
const harness = (resolvePrimaryMonitor: PrimaryMonitorResolver) => {
  const mutations = new SettingsMutationLog();
  const pin: LayoutEditorPin = {
    pinnedLiveLayoutId: null,
    setPinnedLiveLayoutId(id) {
      pin.pinnedLiveLayoutId = id;
    },
  };
  const lifecycleMap: LayoutLifecycleWidgetMap = {
    loadLayout: () => undefined,
    setWidgets: () => undefined,
    setOverlayResolution: () => undefined,
    starterWidgets: () => STARTER,
  };
  const layoutRecords = new LayoutsStore(
    mutations,
    () => pin,
    () => lifecycleMap
  );

  const live: {
    widgets: WidgetDefaultConfig[] | null;
    resolution: { width: number; height: number } | null;
  } = { widgets: null, resolution: null };

  const widgetMap: FirstRunWidgetMap = {
    setWidgets: (widgets) => {
      live.widgets = widgets;
    },
    setOverlayResolution: (resolution) => {
      live.resolution = resolution;
    },
    starterWidgets: () => STARTER.map((widget) => ({ ...widget })),
  };

  const run = () =>
    setUpFirstRun({
      layoutRecords,
      widgetMap,
      resolvePrimaryMonitor,
    });

  return { layoutRecords, widgetMap, live, run };
};

describe('setUpFirstRun', () => {
  it('creates a default layout on the primary monitor with the starter set', async () => {
    const { layoutRecords, live, run } = harness(async () => PRIMARY);

    await run();

    expect(layoutRecords.layouts).toHaveLength(1);

    const layout = layoutRecords.layouts[0];

    expect(layout.monitors).toEqual<LayoutMonitor[]>([
      {
        name: 'DISPLAY1',
        bounds: { x: 0, y: 0, width: 2560, height: 1440 },
      },
    ]);
    expect(layoutRecords.editingLayoutId).toBe(layout.id);
    expect(live.resolution).toEqual(PRIMARY.resolution);
    expect(live.widgets?.map((widget) => widget.id)).toEqual(['fuel']);
  });

  it('sends the starter set to the record when the driver switched layouts mid-lookup', async () => {
    let switchLayouts = () => undefined as void;

    const { layoutRecords, live, run } = harness(async () => {
      switchLayouts();

      return PRIMARY;
    });

    switchLayouts = () => {
      const other = layoutRecords.addLayout('Other');

      layoutRecords.setEditingLayoutId(other);
    };

    await run();

    const first = layoutRecords.layouts[0];

    expect(layoutRecords.editingLayoutId).not.toBe(first.id);
    expect(first.widgets.map((widget) => widget.id)).toEqual(['fuel']);
    expect(live.widgets).toBeNull();
  });

  it('still creates the layout when the hardware reports no monitor', async () => {
    const { layoutRecords, live, run } = harness(async () => null);

    await expect(run()).resolves.toBeUndefined();

    expect(layoutRecords.layouts).toHaveLength(1);
    expect(layoutRecords.layouts[0].monitors).toEqual([]);
    expect(live.widgets).toBeNull();
  });

  it('changes nothing when layouts are already present', async () => {
    let asked = false;

    const { layoutRecords, live, run } = harness(async () => {
      asked = true;

      return PRIMARY;
    });

    layoutRecords.setLayouts(
      [
        {
          id: 'existing',
          name: 'Existing',
          createdAt: 0,
          monitors: [],
          widgets: [],
        },
      ],
      'existing'
    );

    await run();

    expect(asked).toBe(false);
    expect(layoutRecords.layouts).toHaveLength(1);
    expect(layoutRecords.layouts[0].id).toBe('existing');
    expect(live.widgets).toBeNull();
  });
});
