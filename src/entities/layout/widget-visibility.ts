import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';

/**
 * The ids of the widgets that are switched on and that the connected sim can
 * feed, in list order.
 */
export const shownWidgetIdsOf = (
  widgets: Iterable<WidgetDefaultConfig>,
  availableIds: Iterable<string>
): string[] => {
  const available = new Set(availableIds);
  const ids: string[] = [];

  for (const widget of widgets) {
    if (widget.userSettings.enabled && available.has(widget.id)) {
      ids.push(widget.id);
    }
  }

  return ids;
};

/** The same ids, back to front: lowest `zIndex` first, list order within one. */
export const shownWidgetIdsByZOrder = (
  widgets: Iterable<WidgetDefaultConfig>,
  availableIds: Iterable<string>
): string[] => {
  const byId = new Map(
    Array.from(widgets, (widget) => [widget.id, widget] as const)
  );
  const zIndexOf = (id: string) => byId.get(id)?.userSettings.zIndex ?? 0;

  return shownWidgetIdsOf(byId.values(), availableIds).sort(
    (first, second) => zIndexOf(first) - zIndexOf(second)
  );
};

/**
 * The widget types with at least one instance among `shownIds`, sorted.
 * Addressed by type, not by copy: a binding belongs to the widget, so it fires
 * while any copy of it is on screen.
 */
export const shownWidgetTypesOf = (
  widgets: WidgetDefaultConfig[],
  shownIds: Iterable<string>
): string[] => {
  const shown = new Set(shownIds);
  const types = new Set<string>();

  for (const widget of widgets) {
    if (shown.has(widget.id)) {
      types.add(widget.type);
    }
  }

  return Array.from(types).sort();
};
