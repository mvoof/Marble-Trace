import { useState, type MouseEvent as ReactMouseEvent } from 'react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import type {
  LayoutMonitor,
  MonitorBounds,
} from '@shared/contracts/widget-settings';
import { boundsOverlap, clearOfMonitors } from '@shared/lib/remote-screen';

export interface DraggedScreen {
  name: string;
  bounds: MonitorBounds;
  /** Dropping here would land on another screen. */
  isBlocked: boolean;
}

interface ScreenDragView {
  fit: number;
  freezeView: () => void;
  thawView: () => void;
}

/**
 * Re-parking a remote screen by its grab bar. Remote screens are the only
 * rectangles the user places by hand: a real monitor's position is dictated
 * by Windows. The screen in hand is drawn from here until it is dropped.
 */
export const useScreenDrag = (
  monitors: LayoutMonitor[],
  { fit, freezeView, thawView }: ScreenDragView
) => {
  const layouts = useLayoutsStore();
  const appSettings = useAppSettingsStore();
  const [draggedScreen, setDraggedScreen] = useState<DraggedScreen | null>(
    null
  );

  const startScreenDrag = (event: ReactMouseEvent, monitor: LayoutMonitor) => {
    if (event.button !== 0 || fit <= 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // The zoom must not change while a screen is in hand: the plate is drawn
    // at the stage's scale, so rescaling on grab slides it out from under the
    // pointer. The box is frozen exactly as it was, and room outside it comes
    // from the stage dropping its clipping for the duration instead.
    freezeView();

    const snapToGrid = appSettings.appSettings.editorSnapToGrid;
    const gridSize = appSettings.appSettings.editorGridSize;
    const startMouseX = event.clientX;
    const startMouseY = event.clientY;
    const startX = monitor.bounds.x;
    const startY = monitor.bounds.y;

    const others = monitors
      .filter((candidate) => candidate.name !== monitor.name)
      .map((candidate) => ({ ...candidate.bounds }));

    // The drag writes to local state only. Committing every move would have
    // to refuse the ones that overlap, and a screen cannot reach the far side
    // of a monitor without crossing it — the drag would stall at the edge.
    let dropped = { ...monitor.bounds };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startMouseX) / fit;
      const deltaY = (moveEvent.clientY - startMouseY) / fit;

      let nextX = Math.round(startX + deltaX);
      let nextY = Math.round(startY + deltaY);

      if (snapToGrid) {
        nextX = Math.round(nextX / gridSize) * gridSize;
        nextY = Math.round(nextY / gridSize) * gridSize;
      }

      dropped = { ...monitor.bounds, x: nextX, y: nextY };

      setDraggedScreen({
        name: monitor.name,
        bounds: dropped,
        isBlocked: others.some((other) => boundsOverlap(other, dropped)),
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Landing on another screen is resolved by sliding out of it the short
      // way, so a drop half over a monitor reads as "put it beside this one"
      // rather than as nothing happening.
      const landed = clearOfMonitors(dropped, others);

      layouts.moveRemoteScreen(monitor.name, landed.x, landed.y);
      setDraggedScreen(null);
      thawView();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return { draggedScreen, startScreenDrag };
};
