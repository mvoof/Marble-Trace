import { lazy, Suspense, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Layers, MousePointer2 } from 'lucide-react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { componentForWidget } from '@ui/widgets/registry';
import { WidgetInstanceScope } from '@ui/widgets/WidgetInstanceScope/WidgetInstanceScope';
import { WidgetContainer } from '@ui/app/overlay/components/WidgetContainer/WidgetContainer';
import { usePreviewContentStore } from '@ui/app/preview-content-store';
import styles from './OverlayCanvas.module.scss';
import {
  RendererCoreContext,
  useAppSettingsStore,
  useBindingsStore,
  useSimStore,
  useLayoutsStore,
  useLiveWidgetsStore,
} from '@store/root-store-context';

// antd and the widget picker stay out of the overlay's initial bundle.
const DragModeBar = lazy(() =>
  import('@ui/app/overlay/components/DragModeBar/DragModeBar').then(
    (module) => ({ default: module.DragModeBar })
  )
);

export const OverlayCanvas = observer(() => {
  const appSettings = useAppSettingsStore();
  const liveWidgets = useLiveWidgetsStore();
  const layouts = useLayoutsStore();
  const bindings = useBindingsStore();
  const simStore = useSimStore();
  const { t } = useTranslation('main-app');

  // Both modes hand the mouse to the overlay; drag mode also unlocks widget moving.
  const mouseEnabled = appSettings.dragMode || appSettings.interactMode;

  useEffect(() => {
    getCurrentWebviewWindow()
      .setIgnoreCursorEvents(!mouseEnabled)
      .catch((err: unknown) => console.error(err));
  }, [mouseEnabled]);

  const { dragMode } = appSettings;
  const { hideAllWidgets } = appSettings.appSettings;

  // Placing widgets with the game closed, the real stores are empty and every
  // widget draws a fraction of its running self. Sample telemetry stands in for
  // the session so the driver places the widget at the size it will be.
  const previewStore = usePreviewContentStore(
    dragMode && simStore.status !== 'connected'
  );

  const showInteractBanner = appSettings.interactMode;

  const { interactHotkeyMode } = appSettings.appSettings;

  // A device button has no name worth printing, so the banner falls back to
  // naming the mode alone when interact mode is bound to one.
  const interactKey = bindings.primaryAccelerator('app:toggle-interact-mode');

  const interactBannerText = !interactKey
    ? t('overlayCanvas.interactMode')
    : interactHotkeyMode === 'hold'
      ? t('overlayCanvas.interactModeHold', { key: interactKey })
      : t('overlayCanvas.interactModeToggle', { key: interactKey });

  const ownBounds = liveWidgets.ownMonitorName
    ? layouts.monitorByName(liveWidgets.ownMonitorName)?.bounds
    : undefined;

  const monitorOffset = {
    transform: `translate(${-(ownBounds?.x ?? 0)}px, ${-(ownBounds?.y ?? 0)}px)`,
  };

  if (hideAllWidgets || simStore.widgetsSuppressed) {
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
          <Suspense fallback={null}>
            <DragModeBar />
          </Suspense>
        </div>
      )}

      {/* Widget coordinates are virtual-desktop wide, so this window shifts
          them by its own monitor's origin. Only the widgets whose centre lands
          on this monitor are drawn — dragging one over an edge hands it to the
          neighbouring window. */}
      <div className={styles.monitorOrigin} style={monitorOffset}>
        {liveWidgets.ownMonitorWidgets.map((widget) => {
          const WidgetComponent = componentForWidget(widget.type);

          if (!WidgetComponent) return null;

          return (
            <WidgetInstanceScope
              key={widget.id}
              type={widget.type}
              instanceId={widget.id}
              core={previewStore ?? undefined}
            >
              <WidgetContainer widgetId={widget.id}>
                {previewStore ? (
                  <RendererCoreContext.Provider value={previewStore}>
                    <WidgetComponent />
                  </RendererCoreContext.Provider>
                ) : (
                  <WidgetComponent />
                )}
              </WidgetContainer>
            </WidgetInstanceScope>
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

        {liveWidgets.layoutActivatedToast !== null && (
          <div className={styles.toast}>
            <Layers size={14} className={styles.toastIcon} />
            <span className={styles.toastText}>
              {t('overlayCanvas.layoutSwitched', {
                layout: liveWidgets.layoutActivatedToast,
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
