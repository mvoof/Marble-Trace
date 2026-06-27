import {
  getCurrentWindow,
  availableMonitors,
  primaryMonitor,
} from '@tauri-apps/api/window';
import { PhysicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import type { RootStore } from '@store/root-store';

const WIN32_DISPLAY_PREFIX = '\\\\.\\';

// Moves the overlay window to the monitor with the given name (Win32 prefix
// stripped). Falls back to the primary monitor if the name doesn't match any
// available monitor or is null. Also updates overlayResolution in the store.
export const positionOverlayToMonitor = async (
  monitorName: string | null,
  root: RootStore
): Promise<void> => {
  try {
    const monitors = await availableMonitors();

    const monitor =
      (monitorName
        ? monitors.find(
            (candidate) =>
              candidate.name?.replace(WIN32_DISPLAY_PREFIX, '') === monitorName
          )
        : undefined) ??
      (await primaryMonitor()) ??
      monitors[0];

    if (!monitor) return;

    const win = getCurrentWindow();

    await win.setPosition(
      new PhysicalPosition(monitor.position.x, monitor.position.y)
    );

    await win.setSize(
      new PhysicalSize(monitor.size.width, monitor.size.height)
    );

    const scale = monitor.scaleFactor || 1;

    root.widgetSettings.setOverlayResolution({
      width: Math.round(monitor.size.width / scale),
      height: Math.round(monitor.size.height / scale),
    });
  } catch (error) {
    console.error('Failed to position overlay window:', error);
  }
};
