import type {
  LayoutMonitor,
  WidgetDefaultConfig,
} from '@shared/contracts/widget-settings';

import { hotkeysActOn, monitorForWidget } from './virtual-desktop';

/**
 * The instance that speaks for a widget where only one answer is possible: a
 * setting the backend keeps once, or a widget store, which is one per app and
 * so cannot be per instance.
 *
 * The one the driver works with wins — switched on and under the widget's
 * hotkeys — then any switched-on instance, then any under the hotkeys, then
 * the first. Within each, a physical display goes ahead of a browser screen:
 * the driver's own screen speaks for the widget, not the stream copying it.
 */
export const primaryInstanceAmong = (
  instances: WidgetDefaultConfig[],
  monitors: LayoutMonitor[]
): WidgetDefaultConfig | undefined => {
  const isOnBrowserScreen = (widget: WidgetDefaultConfig) =>
    monitorForWidget(widget, monitors)?.kind === 'remote';
  const ordered = [
    ...instances.filter((widget) => !isOnBrowserScreen(widget)),
    ...instances.filter(isOnBrowserScreen),
  ];
  const isHotkeyed = (widget: WidgetDefaultConfig) => hotkeysActOn(widget);

  return (
    ordered.find(
      (widget) => widget.userSettings.enabled && isHotkeyed(widget)
    ) ??
    ordered.find((widget) => widget.userSettings.enabled) ??
    ordered.find(isHotkeyed) ??
    ordered[0]
  );
};

/**
 * The instance a cycling hotkey reads the current value from before writing
 * the next one to every marked instance: the primary one when it is marked,
 * else the first marked.
 */
export const hotkeyLeaderAmong = (
  instances: WidgetDefaultConfig[],
  monitors: LayoutMonitor[]
): WidgetDefaultConfig | undefined => {
  const marked = instances.filter(hotkeysActOn);
  const primary = primaryInstanceAmong(instances, monitors);

  return primary && marked.includes(primary) ? primary : marked[0];
};

/**
 * The value a cycling hotkey steps to from `current`, wrapping round; the
 * first one when `current` is not among them.
 */
export const nextCycleValue = (
  values: readonly string[],
  current: string
): string => values[(values.indexOf(current) + 1) % values.length];

/**
 * What the visibility hotkey does to every instance it acts on, all the same
 * way: off while any of them is on screen, on when none is.
 */
export const visibilityAfterToggle = (
  instances: WidgetDefaultConfig[]
): boolean => !instances.some((widget) => widget.userSettings.enabled);
