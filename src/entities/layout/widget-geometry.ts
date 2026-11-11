import type {
  LayoutMonitor,
  SavedLayout,
  WidgetDefaultConfig,
  WidgetUserSettings,
} from '@shared/contracts/widget-settings';

import {
  clampToBounds,
  monitorForWidget,
  placeWidgetOnMonitor,
} from './virtual-desktop';

/**
 * How much of an auto-sized widget is kept on its monitor when it is dragged
 * past an edge — its real size is not known to the store.
 */
const AUTO_SIZE_VISIBLE_PX = 24;

/** Where a widget stands, rather than how it looks: never carried by a settings copy or a reset. */
const GEOMETRY_KEYS = [
  'enabled',
  'x',
  'y',
  'currentWidth',
  'currentHeight',
  'zIndex',
] as const;

type Position = { x: number; y: number };

/**
 * The box a widget is kept inside its monitor by. An auto-height widget draws
 * as tall as its content, and its `currentHeight` is only the manifest's number
 * — usually taller than what it draws — so clamping by it would stop the widget
 * short of the bottom edge. Only a strip along its top is kept on screen, so
 * it can never be dragged out of sight entirely. A content-sized widget draws
 * narrower than its `currentWidth` too, and gets the same strip along its left.
 */
export const clampSizeOf = (
  widget: WidgetDefaultConfig
): { width: number; height: number } => ({
  width: widget.contentSized
    ? Math.min(AUTO_SIZE_VISIBLE_PX, widget.userSettings.currentWidth)
    : widget.userSettings.currentWidth,
  height:
    widget.autoHeight || widget.contentSized
      ? Math.min(AUTO_SIZE_VISIBLE_PX, widget.userSettings.currentHeight)
      : widget.userSettings.currentHeight,
});

/**
 * A widget's settings without its place, size and switch. A deep copy: a
 * nested value (a column set, a colour map) shared by reference between two
 * instances would let an edit to one change the other.
 */
export const withoutGeometry = (
  settings: WidgetUserSettings
): Partial<WidgetUserSettings> => {
  const copied = JSON.parse(
    JSON.stringify(settings)
  ) as Partial<WidgetUserSettings>;

  for (const key of GEOMETRY_KEYS) {
    delete copied[key];
  }

  return copied;
};

/** Where `position` lands for this widget, kept inside its own monitor. */
export const clampOnOwnMonitor = (
  widget: WidgetDefaultConfig,
  monitors: LayoutMonitor[],
  position: Position
): Position => {
  const monitor = monitorForWidget(widget, monitors);

  return monitor
    ? clampToBounds(monitor.bounds, position, clampSizeOf(widget))
    : position;
};

/**
 * Gives a widget that stands on no monitor of this layout the first display,
 * and moves it inside that monitor — a widget is drawn only by its own
 * monitor's window, and one left at stale coordinates would be invisible.
 * A widget that already names a monitor of the layout is left exactly where
 * it is. Mutates and returns `widget`.
 */
export const ownedByLayout = (
  widget: WidgetDefaultConfig,
  layout: SavedLayout | null,
  primary: LayoutMonitor | undefined
): WidgetDefaultConfig => {
  if (!layout || !primary || monitorForWidget(widget, layout.monitors)) {
    return widget;
  }

  const { x, y } = clampToBounds(
    primary.bounds,
    widget.userSettings,
    clampSizeOf(widget)
  );

  widget.monitor = primary.name;
  widget.userSettings.x = x;
  widget.userSettings.y = y;

  return widget;
};

/**
 * Where a widget lands on another monitor: the same relative place it had on
 * its own, or, standing on none, inside the target.
 */
export const positionOnMonitor = (
  widget: WidgetDefaultConfig,
  from: LayoutMonitor | undefined,
  to: LayoutMonitor
): Position =>
  from
    ? placeWidgetOnMonitor(widget, from.bounds, to.bounds).userSettings
    : clampToBounds(to.bounds, widget.userSettings, clampSizeOf(widget));
