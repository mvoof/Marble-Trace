import { useRef, useState, type PointerEvent } from 'react';

/** What a press on these starts is theirs: a widget may hold controls. */
const OWN_CONTROLS = 'button, input, select, textarea, a, [role="slider"]';

interface PanStart {
  pointerX: number;
  pointerY: number;
  scrollLeft: number;
  scrollTop: number;
}

/**
 * Drag a scrolling box by its content, as a hand moves a sheet of paper: the
 * pointer held down anywhere but on a control scrolls the box with it, while
 * the box has anything to scroll.
 */
export const useDragToPan = () => {
  const panStart = useRef<PanStart | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget;
    const scrolls =
      box.scrollWidth > box.clientWidth || box.scrollHeight > box.clientHeight;
    const isOwnControl =
      event.target instanceof Element &&
      event.target.closest(OWN_CONTROLS) !== null;

    if (!scrolls || event.button !== 0 || isOwnControl) {
      return;
    }

    box.setPointerCapture(event.pointerId);
    panStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      scrollLeft: box.scrollLeft,
      scrollTop: box.scrollTop,
    };
    setIsPanning(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const start = panStart.current;

    if (!start) {
      return;
    }

    const box = event.currentTarget;

    box.scrollLeft = start.scrollLeft - (event.clientX - start.pointerX);
    box.scrollTop = start.scrollTop - (event.clientY - start.pointerY);
  };

  const endPan = (event: PointerEvent<HTMLElement>) => {
    if (!panStart.current) {
      return;
    }

    panStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsPanning(false);
  };

  return {
    isPanning,
    panHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPan,
      onPointerCancel: endPan,
    },
  };
};
