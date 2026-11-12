import { type ReactNode } from 'react';
import {
  useWidgetGestures,
  type GeometryWriter,
} from '@features/layout-editor/use-widget-gestures';
import { observer } from 'mobx-react-lite';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';
import {
  resizeDirectionsFor,
  widgetBoxSize,
  widgetFrameStyle,
  type ResizeDirection,
  widgetScaleOf,
} from '@entities/widget/widget-frame';
import styles from './WidgetContainer.module.scss';
import { WidgetIdContext } from '@entities/widget/WidgetIdContext';
import { WidgetDragToolbar } from '@app/windows/overlay/components/WidgetDragToolbar/WidgetDragToolbar';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { usePlayerStore } from '@entities/player/player-context';
import { useSimStore } from '@entities/sim/sim-context';
import { useWidgetAutoHideStore } from '@features/widget-auto-hide/widget-auto-hide-context';
import { useLiveWidgetsStore } from '@entities/layout/live-widgets-context';
import { useOverlayRoot } from '@app/roots/overlay-root-context';

interface WidgetContainerProps {
  widgetId: string;
  children: ReactNode;
}

export const WidgetContainer = observer(
  ({ widgetId, children }: WidgetContainerProps) => {
    const { dragMode, appSettings, hidesOffTrack } = useAppSettingsStore();
    const liveWidgets = useLiveWidgetsStore();
    const { settingsClient } = useOverlayRoot();

    const simStore = useSimStore();
    const widgetAutoHide = useWidgetAutoHideStore();
    const player = usePlayerStore();

    const widget = liveWidgets.getWidget(widgetId);

    // An overlay changes geometry only by command; main handles it.
    const geometryWriter: GeometryWriter = {
      move: (id, x, y) => settingsClient.moveWidget(id, x, y),
      resize: (id, box) =>
        settingsClient.resizeWidget(id, box.x, box.y, box.width, box.height),
      end: (id) => settingsClient.endGeometry(id),
    };

    const { onDragMouseDown, onResizeMouseDown } = useWidgetGestures(
      widgetId,
      geometryWriter,
      { widgets: liveWidgets, viewScale: 1, enabled: dragMode }
    );

    const isConnected = simStore.status === 'connected';
    const isOnTrack = player.isOnTrack;

    const shouldHide =
      (appSettings.hideWidgetsWhenGameClosed && !isConnected && !dragMode) ||
      (!isOnTrack && isConnected && !dragMode && hidesOffTrack) ||
      (!widgetAutoHide.isVisible(widgetId) && !dragMode);

    const x = widget?.userSettings.x ?? 100;
    const y = widget?.userSettings.y ?? 100;

    const width = widget?.userSettings.currentWidth ?? 200;
    const height = widget?.userSettings.currentHeight ?? 200;

    const designWidth = widget?.designWidth ?? width;
    const designHeight = widget?.designHeight ?? height;
    const autoHeight = widget?.autoHeight ?? false;
    const contentSized = widget?.contentSized ?? false;
    const overflowVisible = widget?.overflowVisible ?? false;
    const transparentContainer = widget?.transparentContainer ?? false;

    const scaleFromHeight = widget?.scaleFromHeight ?? false;

    const widgetScale = widgetScaleOf({
      scaleFromHeight,
      width,
      height,
      designWidth,
      designHeight,
    });

    const resizeDirections: ResizeDirection[] = resizeDirectionsFor({
      autoHeight,
      contentSized,
      lockAspectRatio: widget?.lockAspectRatio,
      scaleFromHeight,
    });

    const frameStyle = widgetFrameStyle({
      widgetType: widget ? widget.type : widgetId,
      userSettings: widget?.userSettings ?? {},
      widgetScale,
      transparentContainer,
      autoHeight,
      contentSized,
      hidden: shouldHide,
    });

    const borderRadius = frameStyle.borderRadius;
    const boxSize = widgetBoxSize({ width, height, autoHeight, contentSized });
    const isAutoSized = boxSize.width === 'auto' || boxSize.height === 'auto';

    return (
      <div
        className={`${styles.container} ${shouldHide ? styles.hidden : ''}`}
        data-widget-id={widgetId}
        style={{
          left: x,
          top: y,
          ...boxSize,
        }}
      >
        <div
          role="presentation"
          className={`${styles.dragWrapper} ${dragMode ? styles.draggingCursor : ''}`}
          style={isAutoSized ? boxSize : undefined}
          onMouseDown={onDragMouseDown}
        >
          <ErrorBoundary>
            <div
              className={`${styles.widgetInner} ${overflowVisible ? styles.overflowVisible : ''}`}
              style={frameStyle}
            >
              <WidgetIdContext.Provider value={widgetId}>
                {shouldHide ? null : children}
              </WidgetIdContext.Provider>
            </div>
          </ErrorBoundary>

          {dragMode && (
            <div
              role="presentation"
              className={styles.selectionOutline}
              style={{ borderRadius }}
            />
          )}

          {dragMode && <WidgetDragToolbar widgetId={widgetId} />}

          {dragMode &&
            resizeDirections.map((direction) => (
              <div
                key={direction}
                role="presentation"
                className={`${styles.resizeHandle} ${styles[`resizeHandle${direction.toUpperCase()}`]}`}
                onMouseDown={(event) => onResizeMouseDown(event, direction)}
              />
            ))}
        </div>
      </div>
    );
  }
);
