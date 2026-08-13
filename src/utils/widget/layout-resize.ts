import { WIDGET_BY_ID } from '@store/widget-defaults';
import type {
  WidgetDefaultConfig,
  WidgetUserSettings,
} from '@/types/widget-settings';

/**
 * Runs a widget's own `resolveLayoutChange` (declared in its `manifest.ts`) and
 * writes the result back onto the widget.
 *
 * Toggling a column or swapping orientation changes how wide the widget wants
 * to be; the manifest owns that arithmetic so the store never grows a per-widget
 * if/else. Mutates `widget` in place — callers are already inside an action.
 */
export const applyLayoutResize = (
  id: string,
  widget: WidgetDefaultConfig,
  prevSettings: WidgetUserSettings,
  newSettings: WidgetUserSettings
) => {
  const resolver = WIDGET_BY_ID.get(id)?.resolveLayoutChange;

  if (!resolver) return;

  const result = resolver(prevSettings, newSettings, {
    designWidth: widget.designWidth,
    designHeight: widget.designHeight,
    currentWidth: widget.userSettings.currentWidth,
    currentHeight: widget.userSettings.currentHeight,
  });

  if (!result) return;

  if (result.designWidth !== undefined) {
    widget.designWidth = result.designWidth;
  }

  if (result.designHeight !== undefined) {
    widget.designHeight = result.designHeight;
  }

  if (result.currentWidth !== undefined) {
    widget.userSettings.currentWidth = result.currentWidth;
  }

  if (result.currentHeight !== undefined) {
    widget.userSettings.currentHeight = result.currentHeight;
  }

  if (result.userSettingsPatch) {
    Object.assign(widget.userSettings, result.userSettingsPatch);
  }
};
