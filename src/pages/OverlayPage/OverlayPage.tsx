import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { telemetryConnectionStore } from '../../store/iracing';
import { OverlayCanvas } from '../../components/OverlayCanvas';
import { initOverlaySync } from '../../store/sync';

export const OverlayPage = () => {
  useEffect(() => {
    void telemetryConnectionStore.startWidgetListener();
    return () => telemetryConnectionStore.stopWidgetListener();
  }, []);

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';

    // Immediately pass clicks through to the game by default.
    // OverlayCanvas will toggle this when drag mode changes.
    getCurrentWebviewWindow().setIgnoreCursorEvents(true).catch(console.error);

    let cleanup: (() => void) | undefined;
    let isMounted = true;

    const init = async () => {
      const result = await initOverlaySync();

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
  }, []);

  return <OverlayCanvas />;
};
