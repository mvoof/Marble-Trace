import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Button } from 'antd';
import { X } from 'lucide-react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { WIDGET_BY_ID } from '@store/widget-defaults';
import { WidgetContainer } from '@app/overlay/components/WidgetContainer/WidgetContainer';
import styles from './OverlayCanvas.module.scss';
import {
  useAppSettingsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const OverlayCanvas = observer(() => {
  const appSettings = useAppSettingsStore();
  const widgetSettings = useWidgetSettingsStore();

  const { dragMode } = appSettings;
  const { hideAllWidgets } = appSettings.settings;
  useEffect(() => {
    getCurrentWebviewWindow()
      .setIgnoreCursorEvents(!dragMode)
      .catch((err: unknown) => console.error(err));
  }, [dragMode]);

  const handleExitDragMode = () => {
    appSettings.setDragMode(false);
  };

  if (hideAllWidgets) {
    return null;
  }

  const enabledWidgets = widgetSettings.allWidgets.filter(
    (widget) => widget.userSettings.enabled
  );

  return (
    <div
      className={`${styles.canvas} ${dragMode ? styles.dragActive : ''}`}
      style={{ pointerEvents: dragMode ? 'auto' : 'none' }}
    >
      {dragMode && (
        <div className={styles.exitButtonContainer}>
          <Button
            type="primary"
            danger
            icon={<X size={16} />}
            onClick={handleExitDragMode}
            size="large"
          >
            Exit Edit Mode
          </Button>
        </div>
      )}

      {enabledWidgets.map((widget) => {
        const widgetDefinition = WIDGET_BY_ID.get(widget.id);

        if (!widgetDefinition) return null;

        const WidgetComponent = widgetDefinition.component;

        return (
          <WidgetContainer key={widget.id} widgetId={widget.id}>
            <WidgetComponent />
          </WidgetContainer>
        );
      })}
    </div>
  );
});
