import type uPlot from 'uplot';

import {
  frameRange,
  panRange,
  zoomRange,
  type ChartGesture,
  type ChartViewport,
} from '@shared/lib/chart-viewport';

/** A wheel notch narrows the stretch to this share, or widens it by its inverse. */
const ZOOM_IN = 0.8;
const ZOOM_OUT = 1 / ZOOM_IN;
const MAIN_BUTTON = 0;
const SHIFT_KEY = 'Shift';

type Drag =
  | { kind: 'pan'; startX: number; startRange: readonly [number, number] }
  | { kind: 'frame'; startM: number; startLeft: number };

/**
 * The chart's gestures over its plot: wheel zooms at the pointer, drag pans a
 * zoomed view, Shift + drag frames a stretch, double click shows the whole
 * lap. X only. Answers a function that takes them off.
 */
export const attachGestures = (
  chart: uPlot,
  viewport: ChartViewport
): (() => void) => {
  const over = chart.over;
  let drag: Drag | null = null;
  let shiftDown = false;
  let hovering = false;

  const metresAt = (offsetX: number) => chart.posToVal(offsetX, 'x');
  const offsetOf = (clientX: number) => {
    const bounds = over.getBoundingClientRect();

    return Math.min(Math.max(clientX - bounds.left, 0), bounds.width);
  };

  const gestureNow = (): ChartGesture => {
    if (drag !== null) {
      return drag.kind;
    }

    if (shiftDown) {
      return 'frame';
    }

    return viewport.range === null ? 'zoom' : 'pan';
  };

  const updateLook = () => {
    const gesture = gestureNow();
    const cursors: Record<ChartGesture, string> = {
      zoom: 'zoom-in',
      pan: drag === null ? 'grab' : 'grabbing',
      frame: 'crosshair',
    };

    over.style.cursor = cursors[gesture];

    if (hovering || drag !== null) {
      viewport.setGesture(gesture);
    }
  };

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();

    const factor = event.deltaY > 0 ? ZOOM_OUT : ZOOM_IN;

    viewport.setRange(
      zoomRange(
        viewport.range,
        viewport.lengthM,
        metresAt(event.offsetX),
        factor
      ),
      'chart'
    );
  };

  const handleDragMove = (event: MouseEvent) => {
    if (drag?.kind === 'pan') {
      const [from, to] = drag.startRange;
      const metresPerPixel = (to - from) / over.clientWidth;
      const deltaM = -(event.clientX - drag.startX) * metresPerPixel;

      viewport.setRange(
        panRange(drag.startRange, viewport.lengthM, deltaM),
        'chart'
      );
    } else if (drag?.kind === 'frame') {
      const left = offsetOf(event.clientX);

      chart.setSelect(
        {
          left: Math.min(left, drag.startLeft),
          width: Math.abs(left - drag.startLeft),
          top: 0,
          height: over.clientHeight,
        },
        false
      );
    }
  };

  const handleDragEnd = (event: MouseEvent) => {
    if (drag?.kind === 'frame') {
      const endM = metresAt(offsetOf(event.clientX));

      chart.setSelect({ left: 0, width: 0, top: 0, height: 0 }, false);
      viewport.setRange(
        frameRange(drag.startM, endM, viewport.lengthM),
        'chart'
      );
    }

    drag = null;
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
    updateLook();
  };

  const handleMouseDown = (event: MouseEvent) => {
    if (event.button !== MAIN_BUTTON) {
      return;
    }

    if (event.shiftKey) {
      drag = {
        kind: 'frame',
        startM: metresAt(event.offsetX),
        startLeft: event.offsetX,
      };
    } else if (viewport.range !== null) {
      drag = { kind: 'pan', startX: event.clientX, startRange: viewport.range };
    } else {
      return;
    }

    event.preventDefault();
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    updateLook();
  };

  const handleDoubleClick = () => viewport.setRange(null, 'chart');

  const handleKey = (event: KeyboardEvent) => {
    if (event.key === SHIFT_KEY) {
      shiftDown = event.type === 'keydown';
      updateLook();
    }
  };

  const handleEnter = (event: MouseEvent) => {
    hovering = true;
    shiftDown = event.shiftKey;
    updateLook();
  };

  const handleLeave = () => {
    hovering = false;

    if (drag === null) {
      viewport.setGesture(null);
    }
  };

  over.addEventListener('wheel', handleWheel, { passive: false });
  over.addEventListener('mousedown', handleMouseDown);
  over.addEventListener('dblclick', handleDoubleClick);
  over.addEventListener('mouseenter', handleEnter);
  over.addEventListener('mouseleave', handleLeave);
  window.addEventListener('keydown', handleKey);
  window.addEventListener('keyup', handleKey);
  const stopRange = viewport.onRange(updateLook);
  updateLook();

  return () => {
    stopRange();
    over.removeEventListener('wheel', handleWheel);
    over.removeEventListener('mousedown', handleMouseDown);
    over.removeEventListener('dblclick', handleDoubleClick);
    over.removeEventListener('mouseenter', handleEnter);
    over.removeEventListener('mouseleave', handleLeave);
    window.removeEventListener('keydown', handleKey);
    window.removeEventListener('keyup', handleKey);
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
  };
};

/** Whether the pointer is over this chart's plot: its cursor is the user's. */
export const isHovered = (chart: uPlot) => chart.over.matches(':hover');
