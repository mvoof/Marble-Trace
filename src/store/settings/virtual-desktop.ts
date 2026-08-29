import type {
  LayoutMonitor,
  MonitorBounds,
  WidgetDefaultConfig,
} from '@/types/widget-settings';

export const widgetCentre = (
  widget: WidgetDefaultConfig
): { x: number; y: number } => ({
  x: widget.userSettings.x + widget.userSettings.currentWidth / 2,
  y: widget.userSettings.y + widget.userSettings.currentHeight / 2,
});

export const boundsContain = (
  bounds: MonitorBounds,
  point: { x: number; y: number }
): boolean =>
  point.x >= bounds.x &&
  point.x < bounds.x + bounds.width &&
  point.y >= bounds.y &&
  point.y < bounds.y + bounds.height;

/**
 * The monitor a widget is drawn on: the one containing its centre. Screen
 * arrangements are rarely a perfect rectangle, so a widget parked in a gap
 * falls back to the first monitor instead of vanishing.
 */
export const monitorForWidget = (
  widget: WidgetDefaultConfig,
  monitors: LayoutMonitor[]
): LayoutMonitor | undefined => {
  if (monitors.length === 0) return undefined;

  const centre = widgetCentre(widget);

  return (
    monitors.find((monitor) => boundsContain(monitor.bounds, centre)) ??
    monitors[0]
  );
};

export const widgetsOnMonitor = (
  widgets: WidgetDefaultConfig[],
  monitorName: string,
  monitors: LayoutMonitor[]
): WidgetDefaultConfig[] =>
  widgets.filter(
    (widget) => monitorForWidget(widget, monitors)?.name === monitorName
  );

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
 * Moves a widget onto another monitor, keeping its relative placement. Used by
 * the explicit "move to monitor" action; dragging across an edge in the editor
 * needs no conversion, since coordinates are already desktop-wide.
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
