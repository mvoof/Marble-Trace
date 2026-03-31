import React, { useEffect, useCallback, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { appSettingsStore } from '../../../store/app-settings.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import styles from './WidgetWrapper.module.scss';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface WidgetWrapperProps {
  widgetId: string;
  children: ReactNode;
}

export const WidgetWrapper = observer(
  ({ widgetId, children }: WidgetWrapperProps) => {
    const { dragMode } = appSettingsStore;
    const widget = widgetSettingsStore.getWidget(widgetId);

    useEffect(() => {
      const appWindow = getCurrentWebviewWindow();
      appWindow.setIgnoreCursorEvents(!dragMode).catch(console.error);
    }, [dragMode]);

    useEffect(() => {
      if (!widget) return;

      const appWindow = getCurrentWebviewWindow();
      appWindow
        .setSize(new LogicalSize(widget.width, widget.height))
        .catch(console.error);
    }, [widget?.width, widget?.height, widget]);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!dragMode) return;
        e.preventDefault();
        getCurrentWebviewWindow().startDragging().catch(console.error);
      },
      [dragMode]
    );

    const opacity = widget?.opacity ?? 0.8;
    const backgroundColor = widget?.backgroundColor ?? '#000000';

    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <section
        className={`${styles.wrapper} ${dragMode ? styles.dragging : ''}`}
        style={{ opacity }}
        onMouseDown={handleMouseDown}
      >
        <span
          className={styles.bgGradient}
          style={{
            background: `linear-gradient(to right, ${hexToRgba(backgroundColor, 0)} 0%, ${hexToRgba(backgroundColor, 0.85)} 35%, ${backgroundColor} 50%, ${hexToRgba(backgroundColor, 0.85)} 65%, ${hexToRgba(backgroundColor, 0)} 100%)`,
          }}
        />

        {dragMode && (
          <section className={styles.dragOverlay}>
            <span className={styles.dragLabel}>DRAG MODE</span>
          </section>
        )}

        <span className={styles.content}>{children}</span>
      </section>
    );
  }
);
