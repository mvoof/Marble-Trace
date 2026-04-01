import React, {
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { observer } from 'mobx-react-lite';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { appSettingsStore } from '../../../store/app-settings.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { telemetryStore } from '../../../store/telemetry.store';
import styles from './WidgetWrapper.module.scss';

interface WidgetWrapperProps {
  widgetId: string;
  designWidth: number;
  designHeight: number;
  fillMode?: boolean;
  children: ReactNode;
}

export const WidgetWrapper = observer(
  ({
    widgetId,
    designWidth,
    designHeight,
    fillMode = false,
    children,
  }: WidgetWrapperProps) => {
    const { dragMode } = appSettingsStore;
    const widget = widgetSettingsStore.getWidget(widgetId);
    const wrapperRef = useRef<HTMLElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
      const appWindow = getCurrentWebviewWindow();
      appWindow.setIgnoreCursorEvents(!dragMode).catch(console.error);
    }, [dragMode]);

    useEffect(() => {
      const el = wrapperRef.current;
      if (!el) return;

      const updateScale = () => {
        const { width, height } = el.getBoundingClientRect();

        // Calculate scale to fit while preserving aspect ratio
        const scaleX = width / designWidth;
        const scaleY = height / designHeight;
        const newScale = Math.min(scaleX, scaleY);

        setScale(newScale);
      };

      const observer = new ResizeObserver(updateScale);
      observer.observe(el);

      // Initial update
      updateScale();

      return () => observer.disconnect();
    }, [designWidth, designHeight, fillMode]);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!dragMode) return;
        e.preventDefault();
        getCurrentWebviewWindow().startDragging().catch(console.error);
      },
      [dragMode]
    );

    const backgroundColor = widget?.backgroundColor ?? '#1a1a1a';
    const isConnected = telemetryStore.status === 'connected';
    const shouldHide =
      appSettingsStore.hideWidgetsWhenGameClosed && !isConnected && !dragMode;

    if (shouldHide) {
      return null;
    }

    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <section
        ref={wrapperRef}
        className={`${styles.wrapper} ${dragMode ? styles.dragging : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div
          className={styles.bgGradient}
          style={{
            background: `radial-gradient(circle, ${backgroundColor} 0%, #0a0a0a 100%)`,
          }}
        />

        {dragMode && (
          <section className={styles.dragOverlay}>
            <span className={styles.dragLabel}>DRAG MODE</span>
          </section>
        )}

        <div
          className={styles.content}
          style={
            fillMode
              ? { width: '100%', height: '100%' }
              : {
                  width: designWidth,
                  height: designHeight,
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                }
          }
        >
          {children}
        </div>
      </section>
    );
  }
);
