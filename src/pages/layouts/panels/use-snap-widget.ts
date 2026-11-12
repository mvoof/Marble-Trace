import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';
import { monitorForWidget } from '@entities/layout/virtual-desktop';
import {
  snappedPosition,
  type SnapPosition,
} from '@features/layout-editor/snap-position';
import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';

/**
 * Quick placement: sends a widget to a corner, an edge or the centre of the
 * screen it stands on, measured as the canvas draws it.
 */
export const useSnapWidget = () => {
  const liveWidgets = useMainLiveWidgetsStore();
  const layouts = useLayoutsStore();

  return (widget: WidgetDefaultConfig, position: SnapPosition) => {
    const widgetElement = document.querySelector<HTMLElement>(
      `[data-widget-id="${widget.id}"]`
    );
    // A content-sized widget draws narrower than its stored width, which is
    // only its scale: measure it. `offsetWidth` is already in world units —
    // the canvas zoom is a CSS transform, which layout sizes ignore.
    const width =
      widget.contentSized && widgetElement
        ? widgetElement.offsetWidth
        : widget.userSettings.currentWidth;
    // An auto-height widget sizes itself from its content, so the stored
    // height is stale: measure the rendered box and convert it from screen
    // pixels back to world units, the known width as the scale reference.
    const measuredHeight = (): number => {
      if (widget.contentSized && widgetElement) {
        return widgetElement.offsetHeight;
      }

      const widgetRect = widgetElement?.getBoundingClientRect();

      if (widget.autoHeight && widgetRect && widgetRect.width > 0) {
        return Math.round(widgetRect.height * (width / widgetRect.width));
      }

      return widget.userSettings.currentHeight;
    };
    // Widget coordinates are virtual-desktop wide, so the corners are those
    // of the screen the widget sits on, not of the desktop box.
    const screen = monitorForWidget(
      widget,
      layouts.editingLayout?.monitors ?? []
    )?.bounds ?? {
      x: 0,
      y: 0,
      width: liveWidgets.overlayResolution.width,
      height: liveWidgets.overlayResolution.height,
    };
    const { x, y } = snappedPosition(
      position,
      { width, height: measuredHeight() },
      screen
    );

    liveWidgets.pushUndo();
    liveWidgets.updatePosition(widget.id, x, y);
  };
};
