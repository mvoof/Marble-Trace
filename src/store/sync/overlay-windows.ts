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

  // Also set here, not only from inside the overlay: a full-screen always-on-top
  // window that fails to reach its own init would swallow every click on that
  // monitor, leaving the user unable to interact with anything.
  await overlay.setIgnoreCursorEvents(true);

  return overlay;
};

let syncInFlight: Promise<void> = Promise.resolve();

// Brings the set of open overlay windows in line with the active layout: one
// window per monitor of the layout that is physically attached. A monitor the
// machine no longer has keeps its widgets in the layout but gets no window.
// Runs are chained rather than awaited-then-replaced: two concurrent callers
// awaiting the same promise before replacing it would both start a body, and
// the same monitor would get two window creations.
export const syncOverlayWindows = (root: RootStore): Promise<void> => {
  syncInFlight = syncInFlight.then(async () => {
    try {
      const layout = root.widgetSettings.activeLayout;
      const configuredNames = (layout?.monitors ?? []).map(
        (monitor) => monitor.name
      );
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
  });

  return syncInFlight;
};

export const closeAllOverlayWindows = async (): Promise<void> => {
  const labels = await listOverlayWindowLabels();

  for (const label of labels) {
    const existing = await WebviewWindow.getByLabel(label);

    await existing?.close();
  }
};

export { OVERLAY_LABEL_PREFIX };
