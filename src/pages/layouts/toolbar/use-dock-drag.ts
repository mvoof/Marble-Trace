import { useState, type PointerEvent as ReactPointerEvent } from 'react';

import type { EditorViewMode } from '@features/layout-editor/layout-editor-ui.store';

interface DockOffset {
  /** The entry the offset was dragged in; another entry starts centred. */
  entry: EditorViewMode;
  x: number;
  y: number;
}

/**
 * How far the floating pill has been dragged from its centred place by its
 * grip. Not remembered: each entry into a canvas-only view — `entry` changing
 * — starts it centred again.
 */
export const useDockDrag = (entry: EditorViewMode) => {
  const [dragged, setDragged] = useState<DockOffset>({ entry, x: 0, y: 0 });

  // Forgotten on every change of view, the overview included, so coming back
  // to the same view starts centred too.
  if (dragged.entry !== entry) {
    setDragged({ entry, x: 0, y: 0 });
  }

  const offset =
    dragged.entry === entry ? { x: dragged.x, y: dragged.y } : { x: 0, y: 0 };

  const handleGripPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const grip = event.currentTarget;
    const start = {
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };

    event.preventDefault();
    grip.setPointerCapture(event.pointerId);

    const handleMove = (moveEvent: PointerEvent) => {
      setDragged({
        entry,
        x: moveEvent.clientX - start.x,
        y: moveEvent.clientY - start.y,
      });
    };

    const handleEnd = () => {
      grip.removeEventListener('pointermove', handleMove);
      grip.removeEventListener('pointerup', handleEnd);
      grip.removeEventListener('pointercancel', handleEnd);
    };

    grip.addEventListener('pointermove', handleMove);
    grip.addEventListener('pointerup', handleEnd);
    grip.addEventListener('pointercancel', handleEnd);
  };

  return { offset, handleGripPointerDown };
};
