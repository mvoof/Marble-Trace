import { useRef, useState, type PointerEvent } from 'react';

const BLOCK_INDEX_ATTRIBUTE = 'data-block-index';

export interface BlockDragHandle {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}

export interface BlockDragState {
  /** Marks a block for the drag to find under the pointer. */
  attributes: { [BLOCK_INDEX_ATTRIBUTE]: number };
  handle: BlockDragHandle;
  dragging: boolean;
  /** Where a drop would put the dragged block: before or after this one. */
  drop: 'before' | 'after' | null;
}

/**
 * Blocks moved by dragging one by its label. Pointer events rather than the
 * HTML drag API, which the app's window takes for dropped files.
 */
export const useBlockDrag = (
  count: number,
  onMove: (from: number, before: number) => void
) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [dragged, setDragged] = useState<number | null>(null);
  const [dropBefore, setDropBefore] = useState<number | null>(null);

  const reset = () => {
    setDragged(null);
    setDropBefore(null);
  };

  const blockUnder = (event: PointerEvent<HTMLElement>): number | null => {
    const element = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>(`[${BLOCK_INDEX_ATTRIBUTE}]`);

    if (!element || !listRef.current?.contains(element)) {
      return null;
    }

    const index = Number(element.getAttribute(BLOCK_INDEX_ATTRIBUTE));
    const bounds = element.getBoundingClientRect();

    return event.clientX < bounds.left + bounds.width / 2 ? index : index + 1;
  };

  const block = (index: number): BlockDragState => {
    const isLast = index === count - 1;
    let drop: BlockDragState['drop'] = null;

    if (dragged !== null && dropBefore === index) {
      drop = 'before';
    } else if (dragged !== null && isLast && dropBefore === count) {
      drop = 'after';
    }

    return {
      attributes: { [BLOCK_INDEX_ATTRIBUTE]: index },
      dragging: dragged === index,
      drop,
      handle: {
        onPointerDown: (event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragged(index);
        },
        onPointerMove: (event) => {
          if (dragged === index) {
            setDropBefore(blockUnder(event));
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

  return { listRef, block };
};
