import React, { useEffect, useCallback, useRef, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { appSettingsStore } from '../../../store/app-settings.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { telemetryConnection } from '../../../store/iracing';
import styles from './WidgetWrapper.module.scss';

interface WidgetWrapperProps {
  widgetId: string;
  designWidth: number;
  designHeight: number;
  children: ReactNode;
  visible?: boolean;
}

export const WidgetWrapper = observer(
  ({
    widgetId,
    designWidth,
    designHeight,
    children,
    visible = true,
  }: WidgetWrapperProps) => {
    const { dragMode } = appSettingsStore;
    const widget = widgetSettingsStore.getWidget(widgetId);
    const wrapperRef = useRef<HTMLElement>(null);

    useEffect(() => {
      const appWindow = getCurrentWebviewWindow();
      appWindow.setIgnoreCursorEvents(!dragMode).catch(console.error);
    }, [dragMode]);

    useEffect(() => {
      const el = wrapperRef.current;
      if (!el) return;

      const BASE_FONT_SIZE = 16;

      const updateScale = () => {
        const { width, height } = el.getBoundingClientRect();
        const scaleX = width / designWidth;
        const scaleY = height / designHeight;
        const scale = Math.min(scaleX, scaleY);

        document.documentElement.style.fontSize = `${scale * BASE_FONT_SIZE}px`;
      };

      const observer = new ResizeObserver(updateScale);
      observer.observe(el);
      updateScale();

      return () => observer.disconnect();
    }, [designWidth, designHeight]);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!dragMode) return;
        e.preventDefault();
        getCurrentWebviewWindow().startDragging().catch(console.error);
      },
      [dragMode]
    );

    const backgroundColor = widget?.backgroundColor ?? '#1a1a1a';
    const backgroundColorEdge = widget?.backgroundColorEdge ?? '#0a0a0a';
    const isConnected = telemetryConnection.status === 'connected';
    const shouldHide =
      (appSettingsStore.hideWidgetsWhenGameClosed &&
        !isConnected &&
        !dragMode) ||
      (!visible && !dragMode);

    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <section
        ref={wrapperRef}
        className={`${styles.wrapper} ${dragMode ? styles.dragging : ''}`}
        style={{
          background: shouldHide
            ? 'transparent'
            : `radial-gradient(circle, ${backgroundColor} 0%, ${backgroundColorEdge} 100%)`,
          visibility: shouldHide ? 'hidden' : 'visible',
        }}
        onMouseDown={handleMouseDown}
      >
        {dragMode && (
          <section className={styles.dragOverlay}>
            <span className={styles.dragLabel}>DRAG MODE</span>
          </section>
        )}

        {children}
      </section>
    );
  }
);
