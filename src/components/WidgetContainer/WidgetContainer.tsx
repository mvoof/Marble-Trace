import React, { useCallback, useRef, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { emit } from '@tauri-apps/api/event';
import { appSettingsStore } from '../../store/app-settings.store';
import { widgetSettingsStore } from '../../store/widget-settings.store';
import { telemetryConnectionStore } from '../../store/iracing';
import { WidgetScaler } from '../WidgetScaler';
import styles from './WidgetContainer.module.scss';

interface WidgetContainerProps {
  widgetId: string;
  designWidth: number;
  designHeight: number;
  children: ReactNode;
  visible?: boolean;
  adaptive?: boolean;
}

export const WidgetContainer = observer(
  ({
    widgetId,
    designWidth,
    designHeight,
    children,
    visible = true,
    adaptive = false,
  }: WidgetContainerProps) => {
    const { dragMode } = appSettingsStore;
    const widget = widgetSettingsStore.getWidget(widgetId);

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
    });

    const isConnected = telemetryConnectionStore.status === 'connected';
    const shouldHide =
      (appSettingsStore.hideWidgetsWhenGameClosed &&
        !isConnected &&
        !dragMode) ||
      (!visible && !dragMode);

    const backgroundColor = widget?.backgroundColor ?? '#1a1a1a';
    const backgroundColorEdge = widget?.backgroundColorEdge ?? '#0a0a0a';
    const x = widget?.x ?? 100;
    const y = widget?.y ?? 100;
    const width = widget?.width ?? designWidth;
    const height = widget?.height ?? designHeight;

    const background = shouldHide
      ? 'transparent'
      : `radial-gradient(circle, ${backgroundColor} 0%, ${backgroundColorEdge} 100%)`;

    const handleDragMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!dragMode || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const w = widgetSettingsStore.getWidget(widgetId);
        isDraggingRef.current = true;
        dragStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          widgetX: w?.x ?? 0,
          widgetY: w?.y ?? 0,
        };

        const onMouseMove = (ev: MouseEvent) => {
          if (!isDraggingRef.current) return;
          const dx = ev.clientX - dragStartRef.current.mouseX;
          const dy = ev.clientY - dragStartRef.current.mouseY;
          widgetSettingsStore.updatePosition(
            widgetId,
            Math.round(dragStartRef.current.widgetX + dx),
            Math.round(dragStartRef.current.widgetY + dy)
          );
        };

        const onMouseUp = () => {
          isDraggingRef.current = false;
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          void emit('widget-layout-changed', widgetSettingsStore.widgets);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      },
      [dragMode, widgetId]
    );

    const handleResizeMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!dragMode || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const w = widgetSettingsStore.getWidget(widgetId);
        isResizingRef.current = true;
        resizeStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          widgetW: w?.width ?? designWidth,
          widgetH: w?.height ?? designHeight,
        };

        const onMouseMove = (ev: MouseEvent) => {
          if (!isResizingRef.current) return;
          const dx = ev.clientX - resizeStartRef.current.mouseX;
          const dy = ev.clientY - resizeStartRef.current.mouseY;
          const newW = Math.max(
            80,
            Math.round(resizeStartRef.current.widgetW + dx)
          );
          const newH = Math.max(
            40,
            Math.round(resizeStartRef.current.widgetH + dy)
          );
          widgetSettingsStore.updateSize(widgetId, newW, newH);
        };

        const onMouseUp = () => {
          isResizingRef.current = false;
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          void emit('widget-layout-changed', widgetSettingsStore.widgets);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      },
      [dragMode, widgetId, designWidth, designHeight]
    );

    return (
      <div
        className={styles.container}
        style={{
          left: x,
          top: y,
          width,
          height,
          visibility: shouldHide ? 'hidden' : 'visible',
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className={`${styles.dragWrapper} ${dragMode ? styles.dragging : ''}`}
          onMouseDown={handleDragMouseDown}
        >
          <WidgetScaler
            designWidth={designWidth}
            designHeight={designHeight}
            background={background}
            adaptive={adaptive}
          >
            {children}
          </WidgetScaler>

          {dragMode && (
            <div className={styles.dragOverlay}>
              <span className={styles.dragLabel}>DRAG MODE</span>
            </div>
          )}

          {dragMode && (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div
              className={styles.resizeHandle}
              onMouseDown={handleResizeMouseDown}
            />
          )}
        </div>
      </div>
    );
  }
);
