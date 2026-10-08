import type {
  LayoutMonitor,
  LayoutResolution,
  MonitorBounds,
  WidgetDefaultConfig,
} from '@shared/contracts/widget-settings';

/**
 * The monitor a widget belongs to: the one its `monitor` field names. Never
 * its position — a widget is kept inside its monitor, and only an explicit move
 * hands it to another one.
 */
export const monitorForWidget = (
  widget: WidgetDefaultConfig,
  monitors: LayoutMonitor[]
): LayoutMonitor | undefined =>
  monitors.find((monitor) => monitor.name === widget.monitor);

export const widgetsOnMonitor = (
  widgets: WidgetDefaultConfig[],
  monitorName: string
): WidgetDefaultConfig[] =>
  widgets.filter((widget) => widget.monitor === monitorName);

/**
 * Where a widget with nowhere else to stand is put: the layout's first physical
 * display, else whatever monitor comes first.
 */
export const defaultMonitorOf = (layout: {
  monitors: LayoutMonitor[];
}): LayoutMonitor | undefined =>
  layout.monitors.find((monitor) => monitor.kind !== 'remote') ??
  layout.monitors[0];

/**
 * Whether a widget's hotkeys act on this instance: what the instance says, on
 * by default — on a browser screen too, so a stream shows what the driver
 * switched to.
 */
export const hotkeysActOn = (widget: WidgetDefaultConfig): boolean =>
  widget.hotkeys ?? true;

/**
 * Where a widget's top-left corner may go so the whole widget stays on its
 * monitor. A widget larger than the monitor is pinned to its top-left edge.
 */
export const clampToBounds = (
  bounds: MonitorBounds,
  position: { x: number; y: number },
  size: { width: number; height: number }
): { x: number; y: number } => {
  const maxX = Math.max(bounds.x, bounds.x + bounds.width - size.width);
  const maxY = Math.max(bounds.y, bounds.y + bounds.height - size.height);

  return {
    x: Math.min(Math.max(position.x, bounds.x), maxX),
    y: Math.min(Math.max(position.y, bounds.y), maxY),
  };
};

/** Smallest rectangle covering every monitor of the layout. */
export const monitorsBounds = (monitors: LayoutMonitor[]): MonitorBounds => {
  if (monitors.length === 0) {
    return { x: 0, y: 0, width: 1920, height: 1080 };
  }

  const left = Math.min(...monitors.map((monitor) => monitor.bounds.x));
  const top = Math.min(...monitors.map((monitor) => monitor.bounds.y));
  const right = Math.max(
    ...monitors.map((monitor) => monitor.bounds.x + monitor.bounds.width)
  );
  const bottom = Math.max(
    ...monitors.map((monitor) => monitor.bounds.y + monitor.bounds.height)
  );

  return { x: left, y: top, width: right - left, height: bottom - top };
};

export const boundsEqual = (first: MonitorBounds, second: MonitorBounds) =>
  first.x === second.x &&
  first.y === second.y &&
  first.width === second.width &&
  first.height === second.height;

/**
 * Moves a widget onto another monitor's rectangle, keeping its relative
 * placement: the explicit "move to monitor" action, and a monitor whose own
 * rectangle moved or changed size.
 *
 * A screen that has not actually moved returns the widget untouched. The
 * conversion below clamps against `currentHeight`, which for an `autoHeight`
 * widget is the manifest's number and not what it draws — re-running it on an
 * unmoved monitor (startup does, for every widget) would walk anything parked
 * near the bottom or right edge back inside those stale bounds.
 */
export const placeWidgetOnMonitor = (
  widget: WidgetDefaultConfig,
  from: MonitorBounds,
  to: MonitorBounds
): WidgetDefaultConfig => {
  if (boundsEqual(from, to)) return widget;

  const relativeX = (widget.userSettings.x - from.x) / from.width;
  const relativeY = (widget.userSettings.y - from.y) / from.height;

  return {
    ...widget,
    userSettings: {
      ...widget.userSettings,
      x: Math.round(
        Math.min(
          to.x + relativeX * to.width,
          to.x + to.width - widget.userSettings.currentWidth
        )
      ),
      y: Math.round(
        Math.min(
          to.y + relativeY * to.height,
          to.y + to.height - widget.userSettings.currentHeight
        )
      ),
    },
  };
};

/**
 * The monitor entry a layout is anchored to when the hardware answers: the
 * screen at the desktop origin, covering its whole reported resolution. Both
 * paths that wait for a monitor — creating a layout and first-run setup — end
 * in this same entry, and the shape is the part of them that must not drift.
 */
export const fullScreenMonitor = (monitor: {
  name: string;
  resolution: LayoutResolution;
}): LayoutMonitor => ({
  name: monitor.name,
  bounds: {
    x: 0,
    y: 0,
    width: monitor.resolution.width,
    height: monitor.resolution.height,
  },
});
