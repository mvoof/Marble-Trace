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
import styles from './WidgetWrapper.module.scss';

interface WidgetWrapperProps {
  widgetId: string;
  designWidth: number;
  designHeight: number;
  children: ReactNode;
}

export const WidgetWrapper = observer(
  ({ widgetId, designWidth, designHeight, children }: WidgetWrapperProps) => {
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

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;

        const { width, height } = entry.contentRect;
        const scaleX = width / designWidth;
        const scaleY = height / designHeight;
        setScale(Math.min(scaleX, scaleY));
      });

      observer.observe(el);

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

    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <section
        ref={wrapperRef}
        className={`${styles.wrapper} ${dragMode ? styles.dragging : ''}`}
        onMouseDown={handleMouseDown}
      >
        <span
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

        <span
          className={styles.content}
          style={{
            width: designWidth,
            height: designHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {children}
        </span>
      </section>
    );
  }
);
