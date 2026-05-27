import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow, currentMonitor } from '@tauri-apps/api/window';
import { PhysicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
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
      // Programmatically resize the window to span the entire screen, including taskbar area,
      // avoiding Windows OS DWM decoration/accent borders on focus lost.
      try {
        const monitor = await currentMonitor();

        if (monitor && isMounted) {
          const { size, position } = monitor;
          const window = getCurrentWindow();

          await window.setSize(new PhysicalSize(size.width, size.height));
          await window.setPosition(
            new PhysicalPosition(position.x, position.y)
          );
        }
      } catch (error) {
        console.error('Failed to resize overlay window:', error);
      }

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
