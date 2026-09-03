import {
  monitorForWidget,
  widgetsOnMonitor,
} from '@store/settings/virtual-desktop';

import type {
  LayoutMonitor,
  LayoutResolution,
  WidgetDefaultConfig,
} from '@/types/widget-settings';

// Diagonal offset applied when a freshly added widget would land on top of one
// that is already centred on the same screen.
const WIDGET_CASCADE_STEP = 40;

/** A widget offered by the overlay's F9 "add widget" picker. */
export interface PickableWidget {
  id: string;
  label: string;
  description?: string;
  available: boolean;
  /** Monitor it currently lives on, or null when it isn't in the layout yet. */
  currentMonitorName: string | null;
}

export interface WidgetSpot {
  x: number;
  y: number;
  zIndex: number;
}

/**
 * What the F9 picker offers on one screen: every widget record not already
 * drawn there, copies included — each is listed on its own, since each is
 * placed and enabled on its own.
 *
 * A record enabled on another monitor is kept in the list with that monitor's
 * name, so the picker offers to move that one rather than silently making
 * another copy: duplicating is a deliberate action in the layout editor.
 */
export const pickableWidgetsForMonitor = (
  allWidgets: WidgetDefaultConfig[],
  enabledWidgets: WidgetDefaultConfig[],
  availableWidgetIds: string[],
  monitorName: string,
  monitors: LayoutMonitor[]
): PickableWidget[] => {
  const available = new Set(availableWidgetIds);

  const drawnHere = new Set(
    widgetsOnMonitor(enabledWidgets, monitorName, monitors).map(
      (widget) => widget.id
    )
  );

  return allWidgets
    .filter((widget) => !drawnHere.has(widget.id))
    .map((widget) => ({
      id: widget.id,
      label: widget.label,
      description: widget.description,
      available: available.has(widget.id),
      currentMonitorName: widget.userSettings.enabled
        ? (monitorForWidget(widget, monitors)?.name ?? null)
        : null,
    }))
    .sort((first, second) => first.label.localeCompare(second.label));
};

/**
 * Where a widget being added lands: the middle of the screen, cascaded off
 * anything already sitting there, clamped inside the monitor and on top.
 *
 * Placement is not cosmetic: an overlay window only speaks for the widgets
 * whose centre lands on its own screen, so a widget left at its stale
 * coordinates would be enabled in the overlay and then dropped by the main
 * window's sync.
 */
export const spotForAddedWidget = (
  widget: WidgetDefaultConfig,
  monitor: LayoutMonitor,
  occupied: WidgetDefaultConfig[],
  allWidgets: WidgetDefaultConfig[]
): WidgetSpot => {
  const { bounds } = monitor;
  const { currentWidth, currentHeight } = widget.userSettings;

  let x = Math.round(bounds.x + (bounds.width - currentWidth) / 2);
  let y = Math.round(bounds.y + (bounds.height - currentHeight) / 2);

  // Cascade off anything already sitting in the middle so repeated adds don't
  // stack into one indistinguishable pile.
  while (
    occupied.some(
      (placed) =>
        Math.abs(placed.userSettings.x - x) < WIDGET_CASCADE_STEP &&
        Math.abs(placed.userSettings.y - y) < WIDGET_CASCADE_STEP
    )
  ) {
    x += WIDGET_CASCADE_STEP;
    y += WIDGET_CASCADE_STEP;
  }

  const maxX = Math.max(bounds.x, bounds.x + bounds.width - currentWidth);
  const maxY = Math.max(bounds.y, bounds.y + bounds.height - currentHeight);

  return {
    x: Math.min(Math.max(x, bounds.x), maxX),
    y: Math.min(Math.max(y, bounds.y), maxY),
    zIndex: topZIndex(allWidgets, widget.id) + 1,
  };
};

/** Highest z-index in the layout, ignoring one widget (the one being moved). */
export const topZIndex = (
  widgets: WidgetDefaultConfig[],
  exceptId: string
): number => {
  let top = 0;

  for (const widget of widgets) {
    if (widget.id === exceptId) continue;

    const zIndex = widget.userSettings.zIndex ?? 0;

    if (zIndex > top) top = zIndex;
  }

  return top;
};

/** Lowest z-index in the layout, ignoring one widget. */
export const bottomZIndex = (
  widgets: WidgetDefaultConfig[],
  exceptId: string
): number => {
  let bottom = 0;

  for (const widget of widgets) {
    if (widget.id === exceptId) continue;

    const zIndex = widget.userSettings.zIndex ?? 0;

    if (zIndex < bottom) bottom = zIndex;
  }

  return bottom;
};

// Breathing room between a starter widget and the edge of the screen.
const STARTER_MARGIN_PX = 24;

/**
 * The curated onboarding layout: the default-enabled starter widgets at
 * sensible anchors for this overlay resolution (standings top-left, relative
 * bottom-left, radar bottom-centre) instead of the raw default positions, which
 * cluster in one corner.
 *
 * `clean` returns the same list with everything disabled — the "start from
 * nothing" layout.
 */
export const buildStarterWidgets = (
  widgets: WidgetDefaultConfig[],
  resolution: LayoutResolution,
  clean = false
): WidgetDefaultConfig[] => {
  if (clean) {
    for (const widget of widgets) {
      widget.userSettings.enabled = false;
    }

    return widgets;
  }

  const { width, height } = resolution;

  const widgetById = (id: string) =>
    widgets.find((candidate) => candidate.id === id);

  const place = (id: string, x: number, y: number) => {
    const widget = widgetById(id);

    if (widget) {
      widget.userSettings.x = Math.round(x);
      widget.userSettings.y = Math.round(y);
    }
  };

  const heightOf = (id: string) =>
    widgetById(id)?.userSettings.currentHeight ?? 0;
  const widthOf = (id: string) =>
    widgetById(id)?.userSettings.currentWidth ?? 0;

  place('standings', STARTER_MARGIN_PX, STARTER_MARGIN_PX);
  place(
    'relative',
    STARTER_MARGIN_PX,
    height - heightOf('relative') - STARTER_MARGIN_PX
  );
  place(
    'proximity-radar',
    (width - widthOf('proximity-radar')) / 2,
    height - heightOf('proximity-radar') - STARTER_MARGIN_PX
  );

  return widgets;
};
