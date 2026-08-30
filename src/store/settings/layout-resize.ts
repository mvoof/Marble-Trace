import { WIDGET_BY_ID } from '@store/widget-catalog';
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

/**
 * The design width a widget's settings imply, for the widgets that declare
 * `deriveDesignWidth` — the tables, whose width *is* the sum of their columns.
 *
 * For them a stored design width is not state, it is a cache of an arithmetic
 * that its own settings already answer, and every copy of it — the file, each
 * layout's snapshot, the undo history — is a chance for the two to drift apart.
 * They show it the same way: the columns scale by `--wfs = currentWidth /
 * designWidth`, so the row stops matching the frame around it the moment the
 * pair disagrees, and the widget appears to jump on the next layout switch.
 *
 * Deriving it wherever widgets are installed means the drift cannot outlive a
 * single write. Everything else keeps its stored size untouched.
 */
export const deriveWidgetDesignWidth = (
  id: string,
  userSettings: WidgetUserSettings,
  storedDesignWidth: number
) => {
  const derive = WIDGET_BY_ID.get(id)?.deriveDesignWidth;

  if (!derive) {
    return storedDesignWidth;
  }

  return Math.max(1, derive(userSettings));
};

/**
 * Installs the derived design width on a widget, keeping `--wfs` where it was:
 * `currentWidth` is rescaled by the same ratio, so repairing a stale width
 * resizes the frame around the table without resizing the text inside it. This
 * is the repair the load path performs, and it has to read the same here — a
 * widget must not change size depending on whether it arrived from the file or
 * from a layout snapshot.
 *
 * A width that already agrees leaves both numbers untouched, which is every
 * call after the first repair.
 */
export const applyDerivedDesignWidth = (
  id: string,
  widget: WidgetDefaultConfig
) => {
  const previousWidth = widget.designWidth;
  const derivedWidth = deriveWidgetDesignWidth(
    id,
    widget.userSettings,
    previousWidth
  );

  if (derivedWidth === previousWidth || previousWidth <= 0) {
    widget.designWidth = derivedWidth;

    return;
  }

  widget.designWidth = derivedWidth;
  widget.userSettings.currentWidth = Math.round(
    (widget.userSettings.currentWidth / previousWidth) * derivedWidth
  );
};
