import type { PickableWidget } from '@entities/widget/widget-placement';
import type {
  LayoutMonitor,
  WidgetDefaultConfig,
} from '@shared/contracts/widget-settings';
import { isDisplayMonitor } from '@shared/lib/remote-screen';

import { monitorForWidget, widgetsOnMonitor } from './virtual-desktop';

/** One widget on one monitor's list in the editor. */
export interface MonitorWidgetRow {
  type: string;
  label: string;
  /** Whether the connected sim can feed it at all. */
  available: boolean;
  /** Its instances on this monitor, in layout order. Empty: never switched on here. */
  instances: WidgetDefaultConfig[];
}

/**
 * One monitor's own widget list, as the editor shows it: every widget the
 * build ships, each with its instances on this monitor — none, when it has
 * never been switched on here. A monitor added a minute ago lists every
 * widget, all off.
 */
export const monitorWidgetRowsOf = (
  shippedWidgets: readonly WidgetDefaultConfig[],
  layoutWidgets: WidgetDefaultConfig[],
  monitorName: string,
  availableTypes: ReadonlySet<string>
): MonitorWidgetRow[] => {
  const onMonitor = widgetsOnMonitor(layoutWidgets, monitorName);

  return shippedWidgets.map((shipped) => ({
    type: shipped.id,
    label: shipped.label,
    available: availableTypes.has(shipped.id),
    instances: onMonitor.filter((widget) => widget.type === shipped.id),
  }));
};

/**
 * Widgets the F9 picker can put on a screen: every widget not already
 * switched on there, by label.
 */
export const pickableWidgetsOf = (
  rows: MonitorWidgetRow[],
  descriptionOf: (type: string) => string | undefined
): PickableWidget[] =>
  rows
    .filter(
      (row) => !row.instances.some((widget) => widget.userSettings.enabled)
    )
    .map((row) => ({
      id: row.type,
      type: row.type,
      label: row.label,
      description: descriptionOf(row.type),
      available: row.available,
    }))
    .sort((first, second) => first.label.localeCompare(second.label));

/**
 * Display monitors that actually have something to draw. A full-screen
 * transparent always-on-top window costs DWM composition over the game and a
 * copy of every telemetry bundle, so empty screens get none.
 */
export const populatedMonitorNamesOf = (
  monitors: LayoutMonitor[],
  shownWidgets: WidgetDefaultConfig[]
): string[] =>
  monitors
    .filter(
      (monitor) =>
        isDisplayMonitor(monitor) &&
        widgetsOnMonitor(shownWidgets, monitor.name).length > 0
    )
    .map((monitor) => monitor.name);

/** The widgets that stand on a remote screen of these monitors. */
export const remoteScreenWidgetsOf = (
  monitors: LayoutMonitor[],
  widgets: WidgetDefaultConfig[]
): WidgetDefaultConfig[] => {
  const remoteNames = monitors
    .filter((monitor) => !isDisplayMonitor(monitor))
    .map((monitor) => monitor.name);

  if (remoteNames.length === 0) {
    return [];
  }

  return widgets.filter((widget) => {
    const owner = monitorForWidget(widget, monitors);

    return owner ? remoteNames.includes(owner.name) : false;
  });
};
