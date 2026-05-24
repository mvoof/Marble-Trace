import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { OverlayCanvas } from './OverlayCanvas/OverlayCanvas';
import { initOverlaySync } from '@store/sync/sync-init';
import {
  useStore,
  useTelemetryConnectionStore,
} from '@store/root-store-context';

export const OverlayWindow = () => {
  const telemetryConnection = useTelemetryConnectionStore();
  const root = useStore();

  useEffect(() => {
    void telemetryConnection.startWidgetListener();

    return () => telemetryConnection.stopWidgetListener();
  }, [telemetryConnection]);

  useEffect(() => {
    [document.documentElement, document.body].forEach(
      (el) => (el.style.background = 'transparent')
    );

    // Immediately pass clicks through to the game by default.
    // OverlayCanvas will toggle this when drag mode changes.
    getCurrentWebviewWindow().setIgnoreCursorEvents(true).catch(console.error);

    let cleanup: (() => void) | undefined;
    let isMounted = true;

    const init = async () => {
      const result = await initOverlaySync(root);

      if (!isMounted) {
        result();
      } else {
        cleanup = result;
      }
    };

    void init();

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [root]);

  return <OverlayCanvas />;
};
