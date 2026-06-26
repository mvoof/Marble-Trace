import { availableMonitors, primaryMonitor } from '@tauri-apps/api/window';
import type { LayoutResolution } from '@/types/widget-settings';

const WIN32_DISPLAY_PREFIX = '\\\\.\\';

export interface OverlayResolution {
  resolution: LayoutResolution;
  monitorName: string | undefined;
}

// Resolves the overlay window's logical (CSS px) resolution for the selected
// monitor. Monitor sizes are physical px, so we divide by the scale factor to
// match the overlay window's coordinate space (window.innerWidth/innerHeight).
export const resolveOverlayResolution = async (
  monitorIndex: number | null
): Promise<OverlayResolution | null> => {
  const monitors = await availableMonitors();

  const monitor =
    (monitorIndex !== null ? monitors[monitorIndex] : undefined) ??
    (await primaryMonitor());

  if (!monitor) {
    return null;
  }

  const scale = monitor.scaleFactor || 1;

  return {
    resolution: {
      width: Math.round(monitor.size.width / scale),
      height: Math.round(monitor.size.height / scale),
    },
    monitorName: monitor.name
      ? monitor.name.replace(WIN32_DISPLAY_PREFIX, '')
      : undefined,
  };
};
