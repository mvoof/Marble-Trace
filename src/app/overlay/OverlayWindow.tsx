import { useEffect } from 'react';
import { reaction } from 'mobx';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  getCurrentWindow,
  availableMonitors,
  primaryMonitor,
} from '@tauri-apps/api/window';
import { PhysicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import { OverlayCanvas } from './OverlayCanvas/OverlayCanvas';
import { initOverlaySync } from '@store/sync/sync-init';
import {
  useStore,
  useTelemetryConnectionStore,
} from '@store/root-store-context';

const positionToMonitor = async (monitorIndex: number | null) => {
  try {
    const monitors = await availableMonitors();

    const monitor =
      monitorIndex !== null && monitorIndex < monitors.length
        ? monitors[monitorIndex]
        : ((await primaryMonitor()) ?? monitors[0]);

    if (!monitor) return;

    const win = getCurrentWindow();

    await win.setPosition(
      new PhysicalPosition(monitor.position.x, monitor.position.y)
    );

    await win.setSize(
      new PhysicalSize(monitor.size.width, monitor.size.height)
    );
  } catch (error) {
    console.error('Failed to position overlay window:', error);
  }
};

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

        return;
      }

      cleanup = result;

      await positionToMonitor(root.appSettings.appSettings.overlayMonitorIndex);

      const disposeReaction = reaction(
        () => root.appSettings.appSettings.overlayMonitorIndex,
        (index) => void positionToMonitor(index)
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
