import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { OverlayCanvas } from './OverlayCanvas/OverlayCanvas';
import { initOverlaySync } from '@platform/sync/overlay-sync';
import { useStore, useSimStore } from '@store/root-store-context';

// The window manager passes the monitor this window covers in the URL. Read
// straight from the hash rather than through the router: the store needs it
// before sync init runs, which happens on the first effect.
const readMonitorName = (): string | null => {
  const query = window.location.hash.split('?')[1];

  if (!query) return null;

  return new URLSearchParams(query).get('monitor');
};

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

    const monitorName = readMonitorName();

    if (monitorName) {
      root.widgetSettings.setOwnMonitorName(monitorName);
    }

    let cleanup: (() => void) | undefined;
    let isMounted = true;

    const init = async () => {
      const result = await initOverlaySync(root);

      if (!isMounted) {
        result();

        return;
      }

      cleanup = result;
    };

    void init();

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [root]);

  return <OverlayCanvas />;
};
