import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';
import type { WidgetMenuSort } from '@entities/app-settings/app-settings.store';
import {
  WIDGET_BY_ID,
  compareManifests,
} from '@entities/widget/widget-catalog';

const isCore = (widget: WidgetDefaultConfig): boolean =>
  WIDGET_BY_ID.get(widget.type)?.tier === 'core';

/**
 * The Widgets page's widgets in menu order, as runs a separator stands
 * between: by tier, the core widgets then the rest; A–Z, one run. Each run is
 * alphabetical, and an empty one is left out.
 */
export const widgetMenuRuns = (
  widgets: readonly WidgetDefaultConfig[],
  sort: WidgetMenuSort
): WidgetDefaultConfig[][] => {
  const sorted = [...widgets].sort(compareManifests);

  if (sort === 'az') {
    return [sorted];
  }

  const core = sorted.filter(isCore);
  const rest = sorted.filter((widget) => !isCore(widget));

  return [core, rest].filter((run) => run.length > 0);
};
