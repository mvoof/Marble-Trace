import type { MonitorWidgetRow } from '@entities/layout/live-widgets.store';
import { defaultMonitorOf } from '@entities/layout/virtual-desktop';
import { compareManifests } from '@entities/widget/widget-catalog';
import type { LayoutMonitor } from '@shared/contracts/widget-settings';

/** One row of the "+ Widget" menu. */
export interface AddWidgetEntry {
  type: string;
  label: string;
  /** Switched on on the target monitor already: a click adds a copy. */
  isOnScreen: boolean;
}

export interface AddWidgetSections {
  core: AddWidgetEntry[];
  all: AddWidgetEntry[];
  /** What Enter in the search adds: the top row. */
  topEntry: AddWidgetEntry | undefined;
}

/**
 * The "+ Widget" menu for one monitor's widget rows: the widgets the sim can
 * feed whose name holds the search, the core tier first and the rest after
 * it, each alphabetically.
 */
export const addWidgetMenuSections = (
  rows: readonly MonitorWidgetRow[],
  query: string,
  isCore: (type: string) => boolean
): AddWidgetSections => {
  const needle = query.trim().toLowerCase();
  const entries = rows
    .filter((row) => row.available && row.label.toLowerCase().includes(needle))
    .sort((left, right) =>
      compareManifests(
        { label: left.label, id: left.type },
        { label: right.label, id: right.type }
      )
    )
    .map((row) => ({
      type: row.type,
      label: row.label,
      isOnScreen: row.instances.some(
        (instance) => instance.userSettings.enabled
      ),
    }));

  const core = entries.filter((entry) => isCore(entry.type));
  const all = entries.filter((entry) => !isCore(entry.type));

  return { core, all, topEntry: core[0] ?? all[0] };
};

/**
 * The monitor "+ Widget" adds to by default: the one in focus, else the
 * selected widget's, else the layout's first display.
 */
export const addWidgetTargetOf = ({
  focusedMonitorName,
  selectedWidgetMonitor,
  monitors,
}: {
  focusedMonitorName: string | null;
  selectedWidgetMonitor: string | undefined;
  monitors: LayoutMonitor[];
}): string | undefined => {
  const monitorNamed = (name: string | null | undefined) =>
    monitors.find((monitor) => monitor.name === name)?.name;

  return (
    monitorNamed(focusedMonitorName) ??
    monitorNamed(selectedWidgetMonitor) ??
    defaultMonitorOf({ monitors })?.name
  );
};
