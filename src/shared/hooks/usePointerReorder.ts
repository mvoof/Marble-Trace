import { useRef, useState, type PointerEvent } from 'react';

const ITEM_INDEX_ATTRIBUTE = 'data-reorder-index';

/** Which way the list runs: a row of chips, or a column of rows. */
export type ReorderAxis = 'x' | 'y';

export interface ReorderHandle {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}

export interface ReorderItem {
  /** Marks an item for the drag to find under the pointer. */
  attributes: { [ITEM_INDEX_ATTRIBUTE]: number };
  /** Spread on the grip the item is dragged by. */
  handle: ReorderHandle;
  dragging: boolean;
  /** Where a drop would put the dragged item: before or after this one. */
  drop: 'before' | 'after' | null;
}

/**
 * Items of a list moved by dragging one by its grip. Pointer events rather
 * than the HTML drag API, which the app's window takes for dropped files.
 * `onMove` gets the dragged item's index and the index it goes before — the
 * list's length puts it last (`movedBefore` applies it).
 */
export const usePointerReorder = (
  count: number,
  axis: ReorderAxis,
  onMove: (from: number, before: number) => void
) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [dragged, setDragged] = useState<number | null>(null);
  const [dropBefore, setDropBefore] = useState<number | null>(null);

  const reset = () => {
    setDragged(null);
    setDropBefore(null);
  };

  const itemUnder = (event: PointerEvent<HTMLElement>): number | null => {
    const element = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>(`[${ITEM_INDEX_ATTRIBUTE}]`);

    if (!element || !listRef.current?.contains(element)) {
      return null;
    }

    const index = Number(element.getAttribute(ITEM_INDEX_ATTRIBUTE));
    const bounds = element.getBoundingClientRect();
    const inFirstHalf =
      axis === 'x'
        ? event.clientX < bounds.left + bounds.width / 2
        : event.clientY < bounds.top + bounds.height / 2;

    return inFirstHalf ? index : index + 1;
  };

  const item = (index: number): ReorderItem => {
    const isLast = index === count - 1;
    let drop: ReorderItem['drop'] = null;

    if (dragged !== null && dropBefore === index) {
      drop = 'before';
    } else if (dragged !== null && isLast && dropBefore === count) {
      drop = 'after';
    }

    return {
      attributes: { [ITEM_INDEX_ATTRIBUTE]: index },
      dragging: dragged === index,
      drop,
      handle: {
        onPointerDown: (event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragged(index);
        },
        onPointerMove: (event) => {
          if (dragged === index) {
            setDropBefore(itemUnder(event));
          }
        },
        onPointerUp: () => {
          if (dragged === index && dropBefore !== null) {
            onMove(index, dropBefore);
          }

          reset();
        },
        onPointerCancel: reset,
      },
    };
  };

  return { listRef, item };
};
