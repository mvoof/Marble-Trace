import { useEffect } from 'react';
import { reaction } from 'mobx';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { OverlayCanvas } from './OverlayCanvas/OverlayCanvas';
import { initOverlaySync } from '@store/sync/sync-init';
import { positionOverlayToMonitor } from '@store/sync/position-overlay';
import { useStore, useSimStore } from '@store/root-store-context';

export const OverlayWindow = () => {
  const simStore = useSimStore();
  const root = useStore();

  useEffect(() => {
    void simStore.startWidgetListener();

    return () => simStore.stopWidgetListener();
  }, [simStore]);

  useEffect(() => {
    [document.documentElement, document.body].forEach(
      (el) => (el.style.background = 'transparent')
    );

    getCurrentWebviewWindow().setIgnoreCursorEvents(true).catch(console.error);

    let cleanup: (() => void) | undefined;
    let isMounted = true;

    const init = async () => {
      const result = await initOverlaySync(root);

      if (!isMounted) {
        result();

        return;
      }

      cleanup = result;

      await positionOverlayToMonitor(
        root.widgetSettings.activeLayout?.activeMonitorName ?? null,
        root
      );

      if (!isMounted) {
        return;
      }

      const disposeReaction = reaction(
        () => root.widgetSettings.activeLayout?.activeMonitorName ?? null,
        (name) => void positionOverlayToMonitor(name, root)
      );

      cleanup = () => {
        result();
        disposeReaction();
      };
    };

    void init();

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [root]);

  return <OverlayCanvas />;
};
