import type { RootStore } from '@store/root-store';
import type { LayoutMonitor } from '@/types/widget-settings';
import { listMonitorBounds } from './overlay-resolution';
import { syncOverlayWindows } from './overlay-windows';

// Rearranging displays in Windows raises WM_DISPLAYCHANGE, but neither Tauri
// nor tao surfaces it to JS — the only window events available are per-window
// resize/move/scale. So the arrangement is polled instead.
//
// Polling is limited to a focused main window: the layout editor is the only
// place the arrangement is visible, and a user who just changed their display
// settings comes back to the app, which is exactly when the check runs.
const POLL_INTERVAL_MS = 2000;

const signatureOf = (monitors: LayoutMonitor[]): string =>
  monitors
    .map(
      ({ name, bounds }) =>
        `${name}:${bounds.x},${bounds.y},${bounds.width},${bounds.height}`
    )
    .sort()
    .join('|');

export const watchMonitorArrangement = (
  root: RootStore,
  onChange: () => void
): (() => void) => {
  let lastSignature: string | null = null;
  let stopped = false;

  const check = async () => {
    if (stopped || !document.hasFocus()) return;

    try {
      const monitors = await listMonitorBounds();
      const signature = signatureOf(monitors);

      if (signature === lastSignature) return;

      const isFirstRun = lastSignature === null;

      lastSignature = signature;
      root.widgetSettings.setAttachedMonitors(monitors);

      if (isFirstRun) return;

      // Widgets move with the screen they sit on, then the overlay windows
      // follow the layout onto their new positions.
      root.widgetSettings.alignMonitorsToHardware(monitors);

      await syncOverlayWindows(root);

      onChange();
    } catch (error) {
      console.error('Failed to read monitor arrangement:', error);
    }
  };

  void check();

  const timer = window.setInterval(() => void check(), POLL_INTERVAL_MS);

  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
};
