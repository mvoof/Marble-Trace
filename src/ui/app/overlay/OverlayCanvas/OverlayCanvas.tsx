import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Button } from 'antd';
import { X, Layers, MousePointer2 } from 'lucide-react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { WIDGET_BY_ID } from '@store/widget-defaults';
import { WidgetContainer } from '@ui/app/overlay/components/WidgetContainer/WidgetContainer';
import { WidgetPicker } from '@ui/app/overlay/components/WidgetPicker/WidgetPicker';
import styles from './OverlayCanvas.module.scss';
import {
  useAppSettingsStore,
  useBindingsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const OverlayCanvas = observer(() => {
  const appSettings = useAppSettingsStore();
  const widgetSettings = useWidgetSettingsStore();
  const bindings = useBindingsStore();

  // Both modes hand the mouse to the overlay; drag mode also unlocks widget moving.
  const mouseEnabled = appSettings.dragMode || appSettings.interactMode;

  useEffect(() => {
    getCurrentWebviewWindow()
      .setIgnoreCursorEvents(!mouseEnabled)
      .catch((err: unknown) => console.error(err));
  }, [mouseEnabled]);

  const { dragMode } = appSettings;
  const { hideAllWidgets } = appSettings.appSettings;

  const showInteractBanner = appSettings.interactMode;

  const { interactHotkeyMode } = appSettings.appSettings;

  // A device button has no name worth printing, so the banner falls back to
  // naming the mode alone when interact mode is bound to one.
  const interactKey = bindings.primaryAccelerator('app:toggle-interact-mode');

  const interactBannerText = !interactKey
    ? 'Interact mode'
    : interactHotkeyMode === 'hold'
      ? `Interact mode — release ${interactKey} to exit`
      : `Interact mode — ${interactKey} to exit`;

  const handleExitDragMode = () => {
    appSettings.setDragMode(false);
  };

  const ownBounds = widgetSettings.ownMonitorName
    ? widgetSettings.monitorByName(widgetSettings.ownMonitorName)?.bounds
    : undefined;

  const monitorOffset = {
    transform: `translate(${-(ownBounds?.x ?? 0)}px, ${-(ownBounds?.y ?? 0)}px)`,
  };

  if (hideAllWidgets) {
    return null;
  }

  // The settings file could not be read, so the widget map still holds the
  // shipped defaults. Painting those would look exactly like the user's own
  // layout had been lost; the main window explains what happened instead.
  if (appSettings.settingsLocked) {
    return null;
  }

  return (
    <div
      className={`${styles.canvas} ${dragMode ? styles.dragActive : ''}`}
      style={{ pointerEvents: mouseEnabled ? 'auto' : 'none' }}
    >
      {dragMode && (
        <div className={styles.exitButtonContainer}>
          <WidgetPicker />

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

      {/* Widget coordinates are virtual-desktop wide, so this window shifts
          them by its own monitor's origin. Only the widgets whose centre lands
          on this monitor are drawn — dragging one over an edge hands it to the
          neighbouring window. */}
      <div className={styles.monitorOrigin} style={monitorOffset}>
        {widgetSettings.ownMonitorWidgets.map((widget) => {
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

      <div className={styles.toastContainer}>
        {showInteractBanner && (
          <div className={`${styles.toast} ${styles.toastInteract}`}>
            <MousePointer2 size={14} className={styles.toastIconInteract} />
            <span className={styles.toastText}>{interactBannerText}</span>
          </div>
        )}

        {widgetSettings.layoutActivatedToast !== null && (
          <div className={styles.toast}>
            <Layers size={14} className={styles.toastIcon} />
            <span className={styles.toastText}>
              {`Layout switched to "${widgetSettings.layoutActivatedToast}"`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
