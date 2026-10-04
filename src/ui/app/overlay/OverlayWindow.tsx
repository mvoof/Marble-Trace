import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { OverlayCanvas } from './OverlayCanvas/OverlayCanvas';
import { initOverlaySync } from '@platform/sync/overlay-sync';
import { useStore, useSimStore } from '@store/root-store-context';

// The window manager passes the monitor this window covers in the URL; the
// store needs it before sync init runs, which happens on the first effect.
const readMonitorName = (): string | null =>
  new URLSearchParams(window.location.search).get('monitor');

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
      root.liveWidgets.setOwnMonitorName(monitorName);
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
