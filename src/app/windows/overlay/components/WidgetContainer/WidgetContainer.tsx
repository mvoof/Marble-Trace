import React, { useCallback, useRef, type ReactNode } from 'react';
import { resizeBox } from '@features/layout-editor/resize-geometry';
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

    const isDraggingRef = useRef(false);
    const isResizingRef = useRef(false);

    const dragStartRef = useRef({
      mouseX: 0,
      mouseY: 0,
      widgetX: 0,
      widgetY: 0,
    });

    const resizeStartRef = useRef({
      mouseX: 0,
      mouseY: 0,
      widgetW: 0,
      widgetH: 0,
      widgetX: 0,
      widgetY: 0,
      // The box a content-sized widget drew at the press; its stored width is
      // only the scale, not its size.
      drawnW: 0,
      drawnH: 0,
    });

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

    const handleDragMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!dragMode || e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        const currentWidget = liveWidgets.getWidget(widgetId);

        isDraggingRef.current = true;

        dragStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          widgetX: currentWidget?.userSettings.x ?? 0,
          widgetY: currentWidget?.userSettings.y ?? 0,
        };

        const onMouseMove = (ev: MouseEvent) => {
          if (!isDraggingRef.current) return;

          const dx = ev.clientX - dragStartRef.current.mouseX;
          const dy = ev.clientY - dragStartRef.current.mouseY;

          settingsClient.moveWidget(
            widgetId,
            Math.round(dragStartRef.current.widgetX + dx),
            Math.round(dragStartRef.current.widgetY + dy)
          );
        };

        const onMouseUp = () => {
          isDraggingRef.current = false;
          settingsClient.endGeometry(widgetId);
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      },
      [dragMode, widgetId, liveWidgets, settingsClient]
    );

    const handleResizeMouseDown = useCallback(
      (e: React.MouseEvent, direction: ResizeDirection) => {
        if (!dragMode || e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        const currentWidget = liveWidgets.getWidget(widgetId);
        const drawnBox = (e.currentTarget as HTMLElement).closest<HTMLElement>(
          '[data-widget-id]'
        );

        isResizingRef.current = true;

        resizeStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          widgetW: currentWidget?.userSettings.currentWidth ?? designWidth,
          widgetH: currentWidget?.userSettings.currentHeight ?? designHeight,
          widgetX: currentWidget?.userSettings.x ?? 0,
          widgetY: currentWidget?.userSettings.y ?? 0,
          drawnW: drawnBox?.offsetWidth ?? 0,
          drawnH: drawnBox?.offsetHeight ?? 0,
        };

        const onMouseMove = (ev: MouseEvent) => {
          if (!isResizingRef.current) return;

          const dx = ev.clientX - resizeStartRef.current.mouseX;
          const dy = ev.clientY - resizeStartRef.current.mouseY;

          const box = resizeBox({
            direction,
            dx,
            dy,
            start: {
              x: resizeStartRef.current.widgetX,
              y: resizeStartRef.current.widgetY,
              width: resizeStartRef.current.widgetW,
              height: resizeStartRef.current.widgetH,
            },
            drawn: {
              width: resizeStartRef.current.drawnW,
              height: resizeStartRef.current.drawnH,
            },
            design: { width: designWidth, height: designHeight },
            widget: {
              contentSized: widget?.contentSized,
              scaleFromHeight: widget?.scaleFromHeight,
              lockAspectRatio: widget?.lockAspectRatio,
            },
          });

          settingsClient.resizeWidget(
            widgetId,
            box.x,
            box.y,
            box.width,
            box.height
          );
        };

        const onMouseUp = () => {
          isResizingRef.current = false;
          settingsClient.endGeometry(widgetId);

          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      },
      [
        dragMode,
        liveWidgets,
        settingsClient,
        widgetId,
        designWidth,
        designHeight,
        widget?.lockAspectRatio,
        widget?.scaleFromHeight,
        widget?.contentSized,
      ]
    );

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
          onMouseDown={handleDragMouseDown}
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
                onMouseDown={(e) => handleResizeMouseDown(e, direction)}
              />
            ))}
        </div>
      </div>
    );
  }
);
