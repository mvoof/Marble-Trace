import { runInAction } from 'mobx';

import { fullScreenMonitor } from '@store/settings/virtual-desktop';
import { resolveMonitorByName } from '@platform/sync/overlay-resolution';

import type { LayoutMonitor, LayoutResolution } from '@/types/widget-settings';
import type { WidgetDefaultConfig } from '@/types/widget-settings';

/**
 * The gestures that need both sides of the seam: a change to the layout
 * *records* that also has to reach the live widget map.
 *
 * They are functions rather than members of either store, for the reason
 * `setUpFirstRun` is one — a store that reached across would make the
 * dependency between records and map point both ways, and then neither can be
 * built, read or tested without the other. Here the coordination is written
 * once, in the open, and each store keeps a one-way dependency: the map
 * projects the records, the records know nothing.
 *
 * What is deliberately *not* here: anything the projection already carries. A
 * screen that moves writes to the record's own widget objects, which the map
 * projects rather than copies, so it is a plain record operation. Only a
 * rebuilt widget *list* has to be installed, because installing is what
 * normalizes it.
 */

/** What a gesture needs from the layout records. */
export interface GestureLayoutRecords {
  readonly layouts: readonly { id: string }[];
  readonly editingLayoutId: string | null;
  readonly editingLayout: { widgets: WidgetDefaultConfig[] } | undefined;
  addLayout(name: string): string;
  byId(
    id: string
  ): { monitors: LayoutMonitor[]; widgets: WidgetDefaultConfig[] } | undefined;
  setEditingLayoutId(id: string | null): void;
  anchorToMonitor(id: string, monitor: LayoutMonitor): boolean;
  detachLayout(id: string): void;
  removeMonitor(layoutId: string, monitorName: string): void;
  alignMonitorsToHardware(attached: LayoutMonitor[]): void;
}

/** What a gesture needs from the live widget map. */
export interface GestureWidgetMap {
  loadLayout(id: string, options?: { notify?: boolean }): void;
  setWidgets(widgets: WidgetDefaultConfig[]): void;
  setOverlayResolution(resolution: LayoutResolution): void;
  starterWidgets(clean?: boolean): WidgetDefaultConfig[];
}

export interface LayoutGestureStores {
  records: GestureLayoutRecords;
  widgetMap: GestureWidgetMap;
}

/**
 * A new layout, made the one being edited, seeded with starter widgets and
 * anchored to the primary monitor once the hardware answers.
 *
 * Returns once the hardware has answered, so a test can wait; the UI does not.
 */
export const createLayout = async (
  { records, widgetMap }: LayoutGestureStores,
  name: string
): Promise<string> => {
  const id = records.addLayout(name);

  records.setEditingLayoutId(id);
  widgetMap.setWidgets(widgetMap.starterWidgets(true));

  const monitor = await resolveMonitorByName(null);

  if (!monitor) return id;

  runInAction(() => {
    if (!records.anchorToMonitor(id, fullScreenMonitor(monitor))) return;

    const target = records.byId(id);

    if (target) {
      target.widgets = widgetMap.starterWidgets(true);
    }

    // The monitor resolved asynchronously; the driver may have switched
    // layouts while it did, and the screen then belongs to that one.
    if (records.editingLayoutId === id) {
      widgetMap.setOverlayResolution(monitor.resolution);
    }
  });

  return id;
};

/**
 * Drops a layout and, when it was the active one, lands on whatever layout
 * remains with that layout's own widgets.
 *
 * The fallback's widgets are loaded BEFORE the mutation token settles, or the
 * commit reaction writes the deleted layout's widgets over the fallback.
 */
export const deleteLayout = (
  { records, widgetMap }: LayoutGestureStores,
  id: string
) => {
  const wasActive = records.editingLayoutId === id;

  records.detachLayout(id);

  if (!wasActive) return;

  const fallbackId = records.layouts[0]?.id ?? null;

  if (fallbackId) {
    widgetMap.loadLayout(fallbackId);

    return;
  }

  records.setEditingLayoutId(null);
};

/**
 * Drops a monitor from a layout. The record moves the widgets that lived on it
 * to the first remaining screen; installing the rebuilt list is what puts them
 * on screen, and is why this is a gesture rather than a record operation.
 */
export const removeMonitor = (
  { records, widgetMap }: LayoutGestureStores,
  layoutId: string,
  monitorName: string
) => {
  records.removeMonitor(layoutId, monitorName);

  const layout = records.byId(layoutId);

  if (layout && layoutId === records.editingLayoutId) {
    widgetMap.setWidgets(layout.widgets);
  }
};

/**
 * Puts every layout's monitors where the OS says they actually are, then
 * installs the active layout's rebuilt widget list.
 */
export const alignMonitorsToHardware = (
  { records, widgetMap }: LayoutGestureStores,
  attached: LayoutMonitor[]
) => {
  records.alignMonitorsToHardware(attached);

  const editingLayout = records.editingLayout;

  if (editingLayout) {
    widgetMap.setWidgets(editingLayout.widgets);
  }
};
