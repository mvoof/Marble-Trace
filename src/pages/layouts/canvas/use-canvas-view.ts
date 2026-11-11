import { useLayoutEffect, useRef, useState } from 'react';

import { monitorsBounds } from '@entities/layout/virtual-desktop';
import type {
  LayoutMonitor,
  MonitorBounds,
} from '@shared/contracts/widget-settings';

/**
 * What part of the desktop the canvas shows and at what zoom: the focused
 * screen, or every screen of the layout at once, fitted into the pane.
 *
 * Overview is the only way to drag a widget between screens; focusing one
 * zooms to it, because three or more screens side by side leave widgets too
 * small to grab.
 */
export const useCanvasView = (
  monitors: LayoutMonitor[],
  focusedMonitor: LayoutMonitor | undefined
) => {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [paneSize, setPaneSize] = useState({ width: 0, height: 0 });
  const [frozenView, setFrozenView] = useState<MonitorBounds | null>(null);

  useLayoutEffect(() => {
    const pane = paneRef.current;

    if (!pane) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      setPaneSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(pane);

    return () => observer.disconnect();
  }, []);

  const desktop = monitorsBounds(monitors);
  // The overview zoom follows the desktop rectangle, which a screen being
  // dragged is part of — recomputing it mid-drag would rescale the canvas
  // under the cursor. The box is frozen for the duration and catches up on
  // drop.
  const view = focusedMonitor ? focusedMonitor.bounds : (frozenView ?? desktop);

  const fit =
    paneSize.width > 0 &&
    paneSize.height > 0 &&
    view.width > 0 &&
    view.height > 0
      ? Math.min(paneSize.width / view.width, paneSize.height / view.height)
      : 0;

  return {
    paneRef,
    view,
    fit,
    /** Holds the overview zoom as it is now, until `thawView`. */
    freezeView: () => setFrozenView(desktop),
    thawView: () => setFrozenView(null),
  };
};
