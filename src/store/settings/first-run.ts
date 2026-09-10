import { runInAction } from 'mobx';

import { fullScreenMonitor } from '@store/settings/virtual-desktop';

import type {
  LayoutMonitor,
  LayoutResolution,
  SavedLayout,
  WidgetDefaultConfig,
} from '@/types/widget-settings';

/**
 * The hardware, as first-run setup sees it: one question, asked once. The app
 * passes the real monitor lookup, a test passes whatever it wants the machine
 * to have answered — including nothing at all.
 */
export type PrimaryMonitorResolver = () => Promise<{
  name: string;
  resolution: LayoutResolution;
} | null>;

/** What first-run setup needs from the layout records. */
export interface FirstRunLayoutRecords {
  readonly editingLayoutId: string | null;
  createDefaultLayout(): string | null;
  byId(id: string): SavedLayout | undefined;
  setMonitors(id: string, monitors: LayoutMonitor[]): void;
}

/** What first-run setup needs from the live widget map. */
export interface FirstRunWidgetMap {
  setWidgets(widgets: WidgetDefaultConfig[]): void;
  setOverlayResolution(resolution: LayoutResolution): void;
  starterWidgets(clean?: boolean): WidgetDefaultConfig[];
}

export interface FirstRunDependencies {
  layoutRecords: FirstRunLayoutRecords;
  widgetMap: FirstRunWidgetMap;
  resolvePrimaryMonitor: PrimaryMonitorResolver;
}

/**
 * Guarantees there is always an active layout. On first run it creates a
 * "Default" layout anchored to the primary monitor — a layout with no monitor
 * gets no overlay window and no area to place widgets on — and seeds it with
 * the starter widget set. Launching with layouts already present does nothing.
 *
 * Returns once the hardware has answered, so a caller that cares can wait; the
 * app does not, and voids it.
 */
export const setUpFirstRun = async ({
  layoutRecords,
  widgetMap,
  resolvePrimaryMonitor,
}: FirstRunDependencies): Promise<void> => {
  const id = layoutRecords.createDefaultLayout();

  if (!id) return;

  const monitor = await resolvePrimaryMonitor();

  if (!monitor) return;

  runInAction(() => {
    const target = layoutRecords.byId(id);

    if (!target || target.monitors.length > 0) return;

    widgetMap.setOverlayResolution(monitor.resolution);

    layoutRecords.setMonitors(id, [fullScreenMonitor(monitor)]);

    // The monitor resolved asynchronously; the driver may have selected a
    // different layout while it did. Its widgets are not this layout's to
    // overwrite, so the starter set goes to the record directly.
    if (layoutRecords.editingLayoutId === id) {
      widgetMap.setWidgets(widgetMap.starterWidgets());
    } else {
      target.widgets = widgetMap.starterWidgets();
    }
  });
};
