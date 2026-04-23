import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { appSettingsStore } from '../../store/app-settings.store';
import { widgetSettingsStore } from '../../store/widget-settings.store';
import {
  WIDGET_REGISTRY,
  resolveWidgetVariant,
} from '../../utils/widget-registry';
import { WidgetContainer } from '../WidgetContainer';
import styles from './OverlayCanvas.module.scss';

export const OverlayCanvas = observer(() => {
  const { dragMode, hideAllWidgets } = appSettingsStore;
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    getCurrentWebviewWindow()
      .setIgnoreCursorEvents(!dragMode)
      .catch(console.error);
  }, [dragMode]);

  const handleVisibilityChange = (id: string, visible: boolean) => {
    setVisibilityMap((prev) => {
      if (prev[id] === visible) return prev;
      return { ...prev, [id]: visible };
    });
  };

  if (hideAllWidgets) {
    return null;
  }

  const enabledWidgets = widgetSettingsStore.widgets.filter((w) => w.enabled);

  return (
    <div
      className={styles.canvas}
      style={{ pointerEvents: dragMode ? 'auto' : 'none' }}
    >
      {enabledWidgets.map((widget) => {
        const entry = WIDGET_REGISTRY[widget.id];
        if (!entry) return null;

        const variant = resolveWidgetVariant(widget.id, entry);
        const {
          component: WidgetComponent,
          designWidth,
          designHeight,
          adaptive,
        } = variant;

        return (
          <WidgetContainer
            key={widget.id}
            widgetId={widget.id}
            designWidth={designWidth}
            designHeight={designHeight}
            visible={visibilityMap[widget.id] ?? true}
            adaptive={adaptive}
          >
            <WidgetComponent
              onVisibilityChange={(v) => handleVisibilityChange(widget.id, v)}
            />
          </WidgetContainer>
        );
      })}
    </div>
  );
});
