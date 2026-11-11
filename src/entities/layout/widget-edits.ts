import { checkedSettings } from '@entities/widget/widget-catalog';
import { applyLayoutResize } from '@entities/widget/layout-resize';
import type {
  WidgetDefaultConfig,
  WidgetUserSettings,
} from '@shared/contracts/widget-settings';

// Edits of one widget record, made inside the store's actions. The movers say
// whether anything changed, so the store records a mutation only for a real one.

/**
 * Writes a settings change the way a toggle would: checked against the
 * widget's manifest, and a changed orientation or column set reshapes the
 * widget (`applyLayoutResize`).
 */
export const applySettingsEdit = (
  widget: WidgetDefaultConfig,
  partial: Partial<WidgetUserSettings>
): void => {
  const previous = { ...widget.userSettings };

  Object.assign(widget.userSettings, checkedSettings(widget.type, partial));

  applyLayoutResize(widget.type, widget, previous, widget.userSettings);
};

export const moveWidgetTo = (
  widget: WidgetDefaultConfig,
  position: { x: number; y: number }
): boolean => {
  const settings = widget.userSettings;

  if (settings.x === position.x && settings.y === position.y) {
    return false;
  }

  settings.x = position.x;
  settings.y = position.y;

  return true;
};

export const resizeWidgetTo = (
  widget: WidgetDefaultConfig,
  width: number,
  height: number
): boolean => {
  const settings = widget.userSettings;

  if (settings.currentWidth === width && settings.currentHeight === height) {
    return false;
  }

  settings.currentWidth = width;
  settings.currentHeight = height;

  return true;
};

/**
 * Marks an instance for the widget's hotkeys, or unmarks it. Stored only
 * where it departs from the default.
 */
export const markForHotkeys = (
  widget: WidgetDefaultConfig,
  actsOn: boolean
): void => {
  if (actsOn) {
    delete widget.hotkeys;
  } else {
    widget.hotkeys = false;
  }
};
