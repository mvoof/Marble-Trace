import type { MonitorWidgetRow } from '@entities/layout/live-widgets.store';

/** Up to this many lines the list is short enough to read without a search. */
const SEARCH_SHOWN_PAST_LINES = 8;

/**
 * The widgets the editor's list shows for one monitor: those switched on
 * there, and those hidden from the list itself while the editor is open, so
 * their eye can bring them back. A layout keeps a switched-off record of
 * every widget, so "has an instance here" is not "placed".
 */
export const placedWidgetRowsOf = (
  rows: readonly MonitorWidgetRow[],
  isKept: (type: string) => boolean
): MonitorWidgetRow[] =>
  rows.filter(
    (row) =>
      row.instances.some((widget) => widget.userSettings.enabled) ||
      (row.instances.length > 0 && isKept(row.type))
  );

/** Lines the rows take in the list: one per instance, copies included. */
export const panelLineCountOf = (rows: readonly MonitorWidgetRow[]): number =>
  rows.reduce((total, row) => total + row.instances.length, 0);

export const isPanelSearchShown = (lineCount: number): boolean =>
  lineCount > SEARCH_SHOWN_PAST_LINES;

export const rowsMatching = (
  rows: readonly MonitorWidgetRow[],
  query: string
): MonitorWidgetRow[] => {
  const needle = query.trim().toLowerCase();

  return rows.filter((row) => row.label.toLowerCase().includes(needle));
};
