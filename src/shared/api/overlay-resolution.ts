import { invoke } from '@tauri-apps/api/core';
import { availableMonitors, primaryMonitor } from '@tauri-apps/api/window';

import type { DisplayName } from '@shared/contracts/generated/bindings';
import type {
  LayoutMonitor,
  LayoutResolution,
} from '@shared/contracts/widget-settings';

const WIN32_DISPLAY_PREFIX = '\\\\.\\';

export interface OverlayMonitor {
  name: string;
  resolution: LayoutResolution;
}

/**
 * Attached monitors with their placement on the virtual desktop, in logical
 * pixels — the coordinate space layouts store widget positions in.
 */
export const listMonitorBounds = async (): Promise<LayoutMonitor[]> => {
  const monitors = await availableMonitors();

  return monitors
    .map((monitor) => {
      const name = stripName(monitor.name);

      if (!name) return null;

      const scale = monitor.scaleFactor || 1;

      return {
        name,
        bounds: {
          x: Math.round(monitor.position.x / scale),
          y: Math.round(monitor.position.y / scale),
          width: Math.round(monitor.size.width / scale),
          height: Math.round(monitor.size.height / scale),
        },
      };
    })
    .filter((monitor): monitor is LayoutMonitor => monitor !== null);
};

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

export interface MonitorDetails {
  /** As `listMonitorBounds` names it: `DISPLAY1`. */
  name: string;
  /** The model from the monitor's EDID; null when it reports none. */
  model: string | null;
  isPrimary: boolean;
  /** In physical pixels, as the monitor's spec sheet gives it. */
  resolution: LayoutResolution;
}

/**
 * What the editor labels each attached monitor with beyond its bounds: the
 * model, read by the backend from the display configuration, and whether
 * Windows has it as the primary.
 */
export const listMonitorDetails = async (): Promise<MonitorDetails[]> => {
  const [monitors, primary, displayNames] = await Promise.all([
    availableMonitors(),
    primaryMonitor(),
    invoke<DisplayName[]>('list_display_names'),
  ]);

  const primaryName = stripName(primary?.name);
  const models = new Map(
    displayNames.map((display) => [
      stripName(display.deviceName),
      display.model,
    ])
  );

  return monitors
    .map((monitor) => {
      const name = stripName(monitor.name);

      if (!name) return null;

      return {
        name,
        model: models.get(name) ?? null,
        isPrimary: name === primaryName,
        resolution: {
          width: monitor.size.width,
          height: monitor.size.height,
        },
      };
    })
    .filter((details): details is MonitorDetails => details !== null);
};
