import { availableMonitors, primaryMonitor } from '@tauri-apps/api/window';
import type { LayoutResolution } from '@/types/widget-settings';

const WIN32_DISPLAY_PREFIX = '\\\\.\\';

export interface OverlayMonitor {
  name: string;
  resolution: LayoutResolution;
}

const stripName = (raw: string | null | undefined): string | undefined =>
  raw ? raw.replace(WIN32_DISPLAY_PREFIX, '') : undefined;

// Returns all available monitors with their logical (CSS px) resolutions.
export const listOverlayMonitors = async (): Promise<OverlayMonitor[]> => {
  const monitors = await availableMonitors();

  return monitors
    .map((monitor) => {
      const name = stripName(monitor.name);

      if (!name) return null;

      const scale = monitor.scaleFactor || 1;

      return {
        name,
        resolution: {
          width: Math.round(monitor.size.width / scale),
          height: Math.round(monitor.size.height / scale),
        },
      };
    })
    .filter((monitor): monitor is OverlayMonitor => monitor !== null);
};

// Finds a monitor by name (Win32 prefix stripped). Falls back to primary.
export const resolveMonitorByName = async (
  monitorName: string | null
): Promise<{ name: string; resolution: LayoutResolution } | null> => {
  const monitors = await availableMonitors();

  const monitor =
    (monitorName
      ? monitors.find((candidate) => stripName(candidate.name) === monitorName)
      : undefined) ??
    (await primaryMonitor()) ??
    monitors[0];

  if (!monitor) return null;

  const name = stripName(monitor.name) ?? 'primary';
  const scale = monitor.scaleFactor || 1;

  return {
    name,
    resolution: {
      width: Math.round(monitor.size.width / scale),
      height: Math.round(monitor.size.height / scale),
    },
  };
};
