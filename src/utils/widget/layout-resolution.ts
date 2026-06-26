import type {
  LayoutResolution,
  WidgetDefaultConfig,
} from '@/types/widget-settings';

export const DEFAULT_LAYOUT_RESOLUTION: LayoutResolution = {
  width: 1920,
  height: 1080,
};

export const resolutionsEqual = (
  first: LayoutResolution,
  second: LayoutResolution
): boolean => first.width === second.width && first.height === second.height;

// Position scales per-axis so widgets keep their relative screen placement.
// Size scales uniformly by the smaller axis ratio so widget proportions and
// readability are preserved even when aspect ratios differ (e.g. 21:9 vs 16:9).
export const scaleWidgetsToResolution = (
  widgets: WidgetDefaultConfig[],
  from: LayoutResolution,
  to: LayoutResolution
): WidgetDefaultConfig[] => {
  if (resolutionsEqual(from, to)) {
    return widgets;
  }

  const positionScaleX = to.width / from.width;
  const positionScaleY = to.height / from.height;
  const sizeScale = Math.min(positionScaleX, positionScaleY);

  return widgets.map((widget) => ({
    ...widget,
    userSettings: {
      ...widget.userSettings,
      x: Math.round(widget.userSettings.x * positionScaleX),
      y: Math.round(widget.userSettings.y * positionScaleY),
      currentWidth: Math.round(widget.userSettings.currentWidth * sizeScale),
      currentHeight: Math.round(widget.userSettings.currentHeight * sizeScale),
    },
  }));
};
