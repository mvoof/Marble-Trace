import React, { useEffect, useCallback, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { appSettingsStore } from '../../../store/app-settings.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import styles from './WidgetWrapper.module.scss';

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
    const scale = widget?.scale ?? 1;

    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <section
        className={`${styles.wrapper} ${dragMode ? styles.dragging : ''}`}
        style={{
          opacity,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--widget-bg-color' as any]: backgroundColor,
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
