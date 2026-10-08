import {
  telemetryEventsToMask,
  type TelemetryEventName,
} from '@shared/contracts/telemetry-events';
import { WIDGET_BY_ID } from '@entities/widget/widget-catalog';
import type { WidgetDefaultConfig } from '@entities/widget/widget-settings';

/**
 * The mask a set of widgets asks for: the union of the `telemetryEvents` every
 * enabled one of them declares in its manifest. A widget states its appetite
 * next to itself, so nothing here has to be kept in step with it.
 *
 * It lives in `store/` rather than `utils/` because it reads the widget
 * catalog, which a pure helper may not import.
 */
export const maskOfWidgets = (widgets: WidgetDefaultConfig[]): number => {
  const requested = new Set<TelemetryEventName>();

  for (const widget of widgets) {
    if (!widget.userSettings.enabled) continue;

    const manifest = WIDGET_BY_ID.get(widget.type);

    for (const event of manifest?.telemetryEvents ?? []) {
      requested.add(event);
    }
  }

  return telemetryEventsToMask(requested);
};
