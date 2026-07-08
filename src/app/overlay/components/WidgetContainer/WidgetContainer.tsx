import React, { useCallback, useRef, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { widgetFrameBorderRadius } from '@utils/widget/widget-frame';
import styles from './WidgetContainer.module.scss';
import { WidgetIdContext } from './WidgetIdContext';
import { WidgetDragToolbar } from '@app/overlay/components/WidgetDragToolbar/WidgetDragToolbar';
import {
  useAppSettingsStore,
  usePlayerStore,
  useSimStore,
  useWidgetAutoHideStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface WidgetContainerProps {
  widgetId: string;
  children: ReactNode;
}

export const WidgetContainer = observer(
  ({ widgetId, children }: WidgetContainerProps) => {
    const { dragMode, appSettings } = useAppSettingsStore();
    const widgetSettings = useWidgetSettingsStore();

    const simStore = useSimStore();
    const widgetAutoHide = useWidgetAutoHideStore();
    const player = usePlayerStore();

    const widget = widgetSettings.getWidget(widgetId);

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
    });

    const isConnected = simStore.status === 'connected';
    const isOnTrack = player.isOnTrack;

    const shouldHide =
      (appSettings.hideWidgetsWhenGameClosed && !isConnected && !dragMode) ||
      (appSettings.hideWidgetsInGarage &&
        !isOnTrack &&
        isConnected &&
        !dragMode) ||
      (!widgetAutoHide.isVisible(widgetId) && !dragMode);

    const backgroundColor =
      widget?.userSettings.backgroundColor ?? 'rgba(21, 22, 26, 0.8)';

    const borderColor =
      widget?.userSettings.borderColor ?? 'rgba(255, 255, 255, 0.1)';

    const x = widget?.userSettings.x ?? 100;
    const y = widget?.userSettings.y ?? 100;

    const width = widget?.userSettings.currentWidth ?? 200;
    const height = widget?.userSettings.currentHeight ?? 200;

    const designWidth = widget?.designWidth ?? width;
    const designHeight = widget?.designHeight ?? height;
    const autoHeight = widget?.autoHeight ?? false;
    const overflowVisible = widget?.overflowVisible ?? false;
    const transparentContainer = widget?.transparentContainer ?? false;

    const widgetScale = width / designWidth;

    const background =
      shouldHide || transparentContainer ? 'transparent' : backgroundColor;
    const containerBorderColor =
      shouldHide || transparentContainer ? 'transparent' : borderColor;

    const handleDragMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!dragMode || e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        const currentWidget = widgetSettings.getWidget(widgetId);

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

          widgetSettings.updatePosition(
            widgetId,
            Math.round(dragStartRef.current.widgetX + dx),
            Math.round(dragStartRef.current.widgetY + dy)
          );
        };

        const onMouseUp = () => {
          isDraggingRef.current = false;
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      },
      [dragMode, widgetId, widgetSettings]
    );

    const handleResizeMouseDown = useCallback(
      (e: React.MouseEvent, direction: ResizeDirection) => {
        if (!dragMode || e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        const currentWidget = widgetSettings.getWidget(widgetId);

        isResizingRef.current = true;

        resizeStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          widgetW: currentWidget?.userSettings.currentWidth ?? designWidth,
          widgetH: currentWidget?.userSettings.currentHeight ?? designHeight,
          widgetX: currentWidget?.userSettings.x ?? 0,
          widgetY: currentWidget?.userSettings.y ?? 0,
        };

        const onMouseMove = (ev: MouseEvent) => {
          if (!isResizingRef.current) return;

          const dx = ev.clientX - resizeStartRef.current.mouseX;
          const dy = ev.clientY - resizeStartRef.current.mouseY;

          const minW = Math.max(20, Math.round(designWidth * 0.2));
          const minH = Math.max(20, Math.round(designHeight * 0.2));

          const startW = resizeStartRef.current.widgetW;
          const startH = resizeStartRef.current.widgetH;
          const startX = resizeStartRef.current.widgetX;
          const startY = resizeStartRef.current.widgetY;

          let newW = startW;
          let newH = startH;
          let newX = startX;
          let newY = startY;

          if (direction.includes('e')) {
            newW = Math.max(minW, Math.round(startW + dx));
          }

          if (direction.includes('w')) {
            newW = Math.max(minW, Math.round(startW - dx));
            newX = Math.round(startX + startW - newW);
          }

          if (direction.includes('s')) {
            newH = Math.max(minH, Math.round(startH + dy));
          }

          if (direction.includes('n')) {
            newH = Math.max(minH, Math.round(startH - dy));
            newY = Math.round(startY + startH - newH);
          }

          widgetSettings.updateSize(widgetId, newW, newH);

          if (newX !== startX || newY !== startY) {
            widgetSettings.updatePosition(widgetId, newX, newY);
          }
        };

        const onMouseUp = () => {
          isResizingRef.current = false;

          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      },
      [dragMode, widgetSettings, widgetId, designWidth, designHeight]
    );

    const resizeDirections: ResizeDirection[] = autoHeight
      ? ['e', 'w']
      : ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

    const borderRadius = widgetFrameBorderRadius(
      widgetId,
      (widget?.userSettings ?? {}) as unknown as Record<string, unknown>
    );

    return (
      <div
        className={`${styles.container} ${shouldHide ? styles.hidden : ''}`}
        data-widget-id={widgetId}
        style={{
          left: x,
          top: y,
          width,
          height: autoHeight ? 'auto' : height,
        }}
      >
        <div
          role="presentation"
          className={`${styles.dragWrapper} ${dragMode ? styles.draggingCursor : ''}`}
          style={autoHeight ? { height: 'auto' } : undefined}
          onMouseDown={handleDragMouseDown}
        >
          <ErrorBoundary>
            <div
              className={`${styles.widgetInner} ${dragMode ? styles.dragging : ''} ${overflowVisible ? styles.overflowVisible : ''}`}
              style={
                {
                  ...(autoHeight ? { height: 'auto' } : undefined),
                  background,
                  borderColor: containerBorderColor,
                  borderWidth: transparentContainer ? 0 : undefined,
                  borderRadius,
                  ['--wfs']: widgetScale,
                  ['--widget-bg']: backgroundColor,
                  ['--widget-border']: borderColor,
                } as React.CSSProperties
              }
            >
              <WidgetIdContext.Provider value={widgetId}>
                {children}
              </WidgetIdContext.Provider>
            </div>
          </ErrorBoundary>

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
