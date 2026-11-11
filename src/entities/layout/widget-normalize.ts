import { DEFAULT_WIDGETS } from '@entities/widget/widget-catalog';
import { applyDerivedDesignWidth } from '@entities/widget/layout-resize';
import type {
  SavedLayout,
  WidgetDefaultConfig,
} from '@shared/contracts/widget-settings';
import { mergeWithDefaults } from '@shared/lib/deep-merge';

import { ownedByLayout } from './widget-geometry';
import { defaultMonitorOf } from './virtual-desktop';

/**
 * Brings a widget list up to the current shape: stored settings are merged
 * over the shipped defaults, a design width that is derived rather than stored
 * is recomputed, and every widget is given a monitor of `layout` to belong to.
 *
 * A widget the list holds no instance of at all is added, switched off, on
 * the first display: every widget the build ships has at least one record in a
 * layout, so there is always one to switch on. A record whose type this build
 * no longer ships drops out.
 */
export const normalizeWidgets = (
  widgets: WidgetDefaultConfig[],
  layout: SavedLayout | null
): WidgetDefaultConfig[] => {
  const primary = layout ? defaultMonitorOf(layout) : undefined;

  // Walking the catalog rather than the list keeps the shipped order stable
  // and groups a widget's instances together.
  return DEFAULT_WIDGETS.flatMap((defaultWidget) => {
    const savedInstances = widgets.filter(
      (widget) => widget.type === defaultWidget.id
    );

    if (savedInstances.length === 0) {
      const installed: WidgetDefaultConfig = {
        ...defaultWidget,
        userSettings: { ...defaultWidget.userSettings, enabled: false },
      };

      applyDerivedDesignWidth(defaultWidget.id, installed);

      return [ownedByLayout(installed, layout, primary)];
    }

    return savedInstances.map((savedWidget) => {
      const installed: WidgetDefaultConfig = {
        ...mergeWithDefaults(defaultWidget, savedWidget),
        // Taken from the record, not from the default: `id` is the instance's
        // own key and `monitor` is where it stands, and taking either from
        // the manifest would collapse every instance into one.
        id: savedWidget.id,
        type: defaultWidget.id,
        ...(savedWidget.monitor === undefined
          ? {}
          : { monitor: savedWidget.monitor }),
        ...(savedWidget.hotkeys === undefined
          ? {}
          : { hotkeys: savedWidget.hotkeys }),
        userSettings: mergeWithDefaults(
          defaultWidget.userSettings,
          savedWidget.userSettings ?? {}
        ),
      };

      applyDerivedDesignWidth(defaultWidget.id, installed);

      return ownedByLayout(installed, layout, primary);
    });
  });
};
