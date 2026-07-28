import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { availableMonitors } from '@tauri-apps/api/window';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import type { RootStore } from '@store/root-store';
import type { LayoutResolution } from '@/types/widget-settings';
import {
  monitorLabel,
  listOverlayWindowLabels,
  OVERLAY_LABEL_PREFIX,
} from './overlay-labels';
import {
  resolutionsEqual,
  scaleWidgetsToResolution,
} from '@utils/widget/layout-resolution';

const WIN32_DISPLAY_PREFIX = '\\\\.\\';

interface PhysicalMonitor {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  resolution: LayoutResolution;
}

const readMonitors = async (): Promise<PhysicalMonitor[]> => {
  const monitors = await availableMonitors();

  return monitors
    .map((monitor) => {
      const name = monitor.name?.replace(WIN32_DISPLAY_PREFIX, '');

      if (!name) return null;

      const scale = monitor.scaleFactor || 1;

      return {
        name,
        x: monitor.position.x,
        y: monitor.position.y,
        width: monitor.size.width,
        height: monitor.size.height,
        resolution: {
          width: Math.round(monitor.size.width / scale),
          height: Math.round(monitor.size.height / scale),
        },
      };
    })
    .filter((monitor): monitor is PhysicalMonitor => monitor !== null);
};

const createOverlayWindow = async (monitor: PhysicalMonitor) => {
  const label = monitorLabel(monitor.name);

  const overlay = new WebviewWindow(label, {
    url: `index.html#/overlay?monitor=${encodeURIComponent(monitor.name)}`,
    title: '',
    transparent: true,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    shadow: false,
    visible: true,
    focus: false,
  });

  await new Promise<void>((resolve, reject) => {
    void overlay.once('tauri://created', () => resolve());
    void overlay.once('tauri://error', (event) => reject(event.payload));
  });

  // Position and size are applied after creation in physical pixels: the
  // creation options are logical, and monitors with different scale factors
  // would land the window on the wrong screen.
  await overlay.setPosition(new PhysicalPosition(monitor.x, monitor.y));
  await overlay.setSize(new PhysicalSize(monitor.width, monitor.height));

  return overlay;
};

// The layout stores widget coordinates for the resolution the monitor had when
// the config was authored. If the screen changed since, the stored widgets are
// rescaled once, in the layout itself, so every window that later loads this
// config already gets the right coordinates.
const reconcileResolution = (
  root: RootStore,
  monitorName: string,
  liveResolution: LayoutResolution
) => {
  const layout = root.widgetSettings.activeLayout;
  const config = layout?.monitorConfigs[monitorName];

  if (!config) return;

  if (resolutionsEqual(config.resolution, liveResolution)) return;

  config.widgets = scaleWidgetsToResolution(
    config.widgets,
    config.resolution,
    liveResolution
  );
  config.resolution = { ...liveResolution };
};

let syncInFlight: Promise<void> | null = null;

// Brings the set of open overlay windows in line with the active layout: one
// window per monitor config that matches a physically present screen. Configs
// without a screen (a disconnected monitor, the "Custom" editor-only
// resolution) keep their widgets but get no window.
export const syncOverlayWindows = async (root: RootStore): Promise<void> => {
  if (syncInFlight) {
    await syncInFlight;
  }

  syncInFlight = (async () => {
    try {
      const layout = root.widgetSettings.activeLayout;
      const configuredNames = layout ? Object.keys(layout.monitorConfigs) : [];
      const monitors = await readMonitors();
      const monitorByName = new Map(
        monitors.map((monitor) => [monitor.name, monitor])
      );

      const wanted = new Map<string, PhysicalMonitor>();

      for (const name of configuredNames) {
        const monitor = monitorByName.get(name);

        if (monitor) {
          wanted.set(monitorLabel(name), monitor);
        }
      }

      const openLabels = await listOverlayWindowLabels();

      for (const label of openLabels) {
        if (!wanted.has(label)) {
          const existing = await WebviewWindow.getByLabel(label);

          await existing?.close();
        }
      }

      for (const [label, monitor] of wanted) {
        reconcileResolution(root, monitor.name, monitor.resolution);

        if (openLabels.includes(label)) {
          const existing = await WebviewWindow.getByLabel(label);

          if (existing) {
            await existing.setPosition(
              new PhysicalPosition(monitor.x, monitor.y)
            );
            await existing.setSize(
              new PhysicalSize(monitor.width, monitor.height)
            );
          }

          continue;
        }

        await createOverlayWindow(monitor);
      }
    } catch (error) {
      console.error('Failed to sync overlay windows:', error);
    }
  })();

  await syncInFlight;

  syncInFlight = null;
};

export const closeAllOverlayWindows = async (): Promise<void> => {
  const labels = await listOverlayWindowLabels();

  for (const label of labels) {
    const existing = await WebviewWindow.getByLabel(label);

    await existing?.close();
  }
};

export { OVERLAY_LABEL_PREFIX };
