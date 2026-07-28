import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button } from 'antd';
import { X, Layers, MousePointer2 } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
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

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  // Both modes hand the mouse to the overlay; drag mode also unlocks widget moving.
  const mouseEnabled = appSettings.dragMode || appSettings.interactMode;

  useEffect(() => {
    getCurrentWebviewWindow()
      .setIgnoreCursorEvents(!mouseEnabled)
      .catch((err: unknown) => console.error(err));
  }, [mouseEnabled]);

  useEffect(() => {
    let timer: number | null = null;

    const unlistenPromise = listen<string>('layout-activated', (event) => {
      setToastMessage(`Layout switched to "${event.payload}"`);
      setShowToast(true);

      if (timer !== null) {
        window.clearTimeout(timer);
      }

      timer = window.setTimeout(() => {
        setShowToast(false);
      }, 3000);
    });

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const { dragMode } = appSettings;
  const { hideAllWidgets } = appSettings.appSettings;

  // Drag mode already announces itself with its own banner and backdrop.
  const showInteractBanner = appSettings.interactMode && !dragMode;

  const { interactHotkey, interactHotkeyMode } = appSettings.appSettings;

  const interactBannerText =
    interactHotkeyMode === 'hold'
      ? `Interact mode — release ${interactHotkey} to exit`
      : `Interact mode — ${interactHotkey} to exit`;

  const handleExitDragMode = () => {
    appSettings.setDragMode(false);
  };

  if (hideAllWidgets) {
    return null;
  }

  return (
    <div
      className={`${styles.canvas} ${dragMode ? styles.dragActive : ''}`}
      style={{ pointerEvents: mouseEnabled ? 'auto' : 'none' }}
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

      {widgetSettings.enabledWidgetIds.map((id) => {
        const widgetDefinition = WIDGET_BY_ID.get(id);

        if (!widgetDefinition) return null;

        const WidgetComponent = widgetDefinition.component;

        return (
          <WidgetContainer key={id} widgetId={id}>
            <WidgetComponent />
          </WidgetContainer>
        );
      })}

      <div className={styles.toastContainer}>
        {showInteractBanner && (
          <div className={`${styles.toast} ${styles.toastInteract}`}>
            <MousePointer2 size={14} className={styles.toastIconInteract} />
            <span className={styles.toastText}>{interactBannerText}</span>
          </div>
        )}

        {showToast && toastMessage && (
          <div className={styles.toast}>
            <Layers size={14} className={styles.toastIcon} />
            <span className={styles.toastText}>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
});
