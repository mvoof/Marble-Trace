import { WIDGET_BY_ID } from '@entities/widget/widget-catalog';
import type { CapabilitiesPayload } from '@shared/contracts/bindings';
import type { WidgetDefaultConfig } from '@entities/widget/widget-settings';

/**
 * Which of these widgets the connected sim can actually feed. Shared by the
 * active layout and by the catalog on the Widgets page, which hold different
 * records of the same widgets: the layout's may be copies, the catalog's are
 * always originals.
 */
export const availableWidgetIdsOf = (
  widgets: Iterable<WidgetDefaultConfig>,
  capabilities: CapabilitiesPayload | null | undefined
): string[] => {
  const ids: string[] = [];

  for (const widget of widgets) {
    const required = WIDGET_BY_ID.get(widget.type)?.requiredCapabilities;

    if (!required || required.length === 0 || !capabilities) {
      ids.push(widget.id);
      continue;
    }

    if (required.every((requirement) => capabilities[requirement] === true)) {
      ids.push(widget.id);
    }
  }

  return ids;
};
