import { nextInstanceId } from '@entities/widget/widget-instance';
import {
  spotForAddedWidget,
  topZIndex,
} from '@entities/widget/widget-placement';
import type {
  LayoutMonitor,
  WidgetDefaultConfig,
} from '@shared/contracts/widget-settings';

import { clampOnOwnMonitor } from './widget-geometry';
import { widgetsOnMonitor } from './virtual-desktop';

/**
 * How far a duplicate lands from the widget it was copied from, so the two
 * are visibly separate the moment the copy appears.
 */
const DUPLICATE_OFFSET_PX = 24;

interface LayoutView {
  monitors: LayoutMonitor[];
  /** Every widget of the layout, in layout order. */
  widgets: WidgetDefaultConfig[];
}

/**
 * Another instance of a widget, on the same monitor: the source's settings as
 * its starting point, offset so it does not land exactly under the widget it
 * came from, and lifted to the top so it is the one being dragged.
 */
export const duplicateOf = (
  source: WidgetDefaultConfig,
  layout: LayoutView
): WidgetDefaultConfig => {
  const position = clampOnOwnMonitor(source, layout.monitors, {
    x: source.userSettings.x + DUPLICATE_OFFSET_PX,
    y: source.userSettings.y + DUPLICATE_OFFSET_PX,
  });

  return {
    ...source,
    id: nextInstanceId(
      source.type,
      layout.widgets.map((widget) => widget.id)
    ),
    userSettings: {
      ...source.userSettings,
      x: position.x,
      y: position.y,
      zIndex: topZIndex(layout.widgets, source.id) + 1,
    },
  };
};

/**
 * A new, switched-on instance of a widget on a monitor, starting from
 * `template` and dropped where nothing else stands.
 */
export const instanceFromTemplate = (
  template: WidgetDefaultConfig,
  type: string,
  monitor: LayoutMonitor,
  layout: LayoutView
): WidgetDefaultConfig => {
  const takenIds = layout.widgets.map((widget) => widget.id);
  const instance: WidgetDefaultConfig = {
    ...template,
    id: takenIds.includes(type) ? nextInstanceId(type, takenIds) : type,
    type,
    monitor: monitor.name,
    userSettings: { ...template.userSettings, enabled: true },
  };

  const occupied = widgetsOnMonitor(
    layout.widgets.filter((widget) => widget.userSettings.enabled),
    monitor.name
  );
  const spot = spotForAddedWidget(instance, monitor, occupied, layout.widgets);

  instance.userSettings.x = spot.x;
  instance.userSettings.y = spot.y;
  instance.userSettings.zIndex = spot.zIndex;

  return instance;
};

/**
 * Which instance of its widget this record is, counting from one, and how
 * many there are — counted on its own monitor: every monitor has its own set,
 * so the widget's first instance there is the widget on that screen, not a
 * copy of one standing somewhere else.
 */
export const copyOrdinalAmong = (
  widget: WidgetDefaultConfig,
  instancesOfType: WidgetDefaultConfig[]
): { ordinal: number; total: number } => {
  const copies = instancesOfType.filter(
    (entry) => entry.monitor === widget.monitor
  );

  return {
    ordinal: copies.findIndex((entry) => entry.id === widget.id) + 1,
    total: copies.length,
  };
};

/**
 * Puts a copy right after the widget it came from, so a widget's copies stay
 * together in the list and in settings.json. Mutates `widgets`.
 */
export const insertAfter = (
  widgets: WidgetDefaultConfig[],
  sourceId: string,
  copy: WidgetDefaultConfig
): void => {
  widgets.splice(
    widgets.findIndex((widget) => widget.id === sourceId) + 1,
    0,
    copy
  );
};

/**
 * A detached copy of a widget list, one level into `userSettings`: for the
 * undo stack, and for copying widgets into another layout record.
 * (structuredClone throws on MobX proxies.)
 */
export const detachedCopiesOf = (
  widgets: WidgetDefaultConfig[]
): WidgetDefaultConfig[] =>
  widgets.map((widget) => ({
    ...widget,
    userSettings: { ...widget.userSettings },
  }));

/**
 * What switching a widget on or off on one monitor does, given its instances
 * there:
 *
 * - `unchanged` — nothing to do; `id` is the instance already on, if any.
 * - `switchOff` — these instances go off; nothing on any other monitor does.
 * - `switchOn` — an instance already standing here comes back on, with every
 *   setting it had.
 * - `create` — there is none here: a new one is made from the template.
 */
export type MonitorSwitch =
  | { kind: 'unchanged'; id: string | null }
  | { kind: 'switchOff'; widgets: WidgetDefaultConfig[] }
  | { kind: 'switchOn'; widget: WidgetDefaultConfig }
  | { kind: 'create' };

export const monitorSwitchOf = (
  instancesOnMonitor: WidgetDefaultConfig[],
  enabled: boolean
): MonitorSwitch => {
  const switchedOn = instancesOnMonitor.filter(
    (widget) => widget.userSettings.enabled
  );

  if (!enabled) {
    return switchedOn.length === 0
      ? { kind: 'unchanged', id: null }
      : { kind: 'switchOff', widgets: switchedOn };
  }

  if (switchedOn.length > 0) {
    return { kind: 'unchanged', id: switchedOn[0].id };
  }

  const reused = instancesOnMonitor.at(0);

  return reused ? { kind: 'switchOn', widget: reused } : { kind: 'create' };
};
