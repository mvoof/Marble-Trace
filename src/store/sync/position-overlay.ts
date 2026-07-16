import {
  getCurrentWindow,
  availableMonitors,
  primaryMonitor,
} from '@tauri-apps/api/window';
import { PhysicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import type { RootStore } from '@store/root-store';
import {
  resolutionsEqual,
  scaleWidgetsToResolution,
} from '@utils/widget/layout-resolution';

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

    const liveResolution = {
      width: Math.round(monitor.size.width / scale),
      height: Math.round(monitor.size.height / scale),
    };

    // Widgets are stored as raw pixel positions authored for the layout's
    // configured resolution. If the real monitor the overlay just landed on
    // doesn't match that (resolution changed since the layout was authored,
    // "Custom" resolution with no matching real monitor, etc.), the widgets
    // themselves must be rescaled too — otherwise they keep the coordinates
    // of the old design canvas inside a differently-sized real window.
    const authoredResolution = root.widgetSettings.overlayResolution;

    if (!resolutionsEqual(authoredResolution, liveResolution)) {
      root.widgetSettings.setWidgets(
        scaleWidgetsToResolution(
          root.widgetSettings.allWidgets,
          authoredResolution,
          liveResolution
        )
      );
    }

    root.widgetSettings.setOverlayResolution(liveResolution);
  } catch (error) {
    console.error('Failed to position overlay window:', error);
  }
};
