import { MOVE_DURATION_MS } from '@utils/animation';
import { useLayoutEffect, useRef, useState, type RefCallback } from 'react';

const ROW_SELECTOR = '[data-driver-row]';
export const ROW_KEY_ATTRIBUTE = 'data-row-key';
const MOVE_EASING = 'cubic-bezier(0.33, 0, 0.15, 1)';
// Sub-pixel drift from rounding must not trigger a transition.
const MIN_MOVE_PX = 1;

type RowTops = Map<string, number>;

const readRows = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(ROW_SELECTOR));

const rowKey = (row: HTMLElement): string =>
  row.getAttribute(ROW_KEY_ATTRIBUTE) ?? '';

// Vertical offset a still-running transition has already applied. Without it a
// reorder that lands mid-flight would restart from the settled layout position
// and the row would visibly jump.
const currentShift = (row: HTMLElement): number => {
  const { transform } = getComputedStyle(row);

  if (!transform || transform === 'none') {
    return 0;
  }

  const values = transform
    .slice(transform.indexOf('(') + 1, -1)
    .split(',')
    .map(Number);

  const translateY = values.length === 16 ? values[13] : values[5];

  return Number.isFinite(translateY) ? translateY : 0;
};

const measureTops = (rows: HTMLElement[]): RowTops => {
  const tops: RowTops = new Map();

  for (const row of rows) {
    tops.set(rowKey(row), row.offsetTop);
  }

  return tops;
};

/**
 * Slides rows to their new places when the standings order changes (FLIP): each
 * row is offset back to where it was, then released into a transition, so a car
 * that gains a place visibly travels up past the one it passed.
 *
 * Transforms are written straight to the nodes rather than through React state —
 * they are per-frame geometry, and re-rendering to animate would fight the
 * 10 Hz telemetry updates that cause the reorder in the first place.
 */
export const useRowMoveAnimation = <T extends HTMLElement>(
  animate = true
): RefCallback<T> => {
  const [container, setContainer] = useState<T | null>(null);
  const previousTops = useRef<RowTops>(new Map());
  const previousOrder = useRef('');
  const frameId = useRef(0);
  const wasAnimating = useRef(animate);

  // No dependency array: the order can change on any render, and comparing the
  // rendered key order is cheaper than measuring, so unchanged renders cost a
  // single attribute read per row.
  useLayoutEffect(() => {
    if (!container) {
      return;
    }

    const rows = readRows(container);
    const order = rows.map(rowKey).join();

    if (order === previousOrder.current) {
      return;
    }

    previousOrder.current = order;

    // Skipped both while animation is off and on the first render after it comes
    // back on: the rows moved because the list itself moved, not because of a
    // pass, so sliding them would animate the scroll instead of an overtake.
    const skipAnimation = !animate || !wasAnimating.current;

    wasAnimating.current = animate;

    if (skipAnimation) {
      cancelAnimationFrame(frameId.current);

      for (const row of rows) {
        row.style.transition = 'none';
        row.style.transform = '';
      }

      previousTops.current = measureTops(rows);

      return;
    }

    const tops = measureTops(rows);
    const moved: HTMLElement[] = [];

    for (const row of rows) {
      const before = previousTops.current.get(rowKey(row));
      const after = tops.get(rowKey(row));

      if (before === undefined || after === undefined) {
        continue;
      }

      const delta = before + currentShift(row) - after;

      if (Math.abs(delta) < MIN_MOVE_PX) {
        row.style.transition = 'none';
        row.style.transform = '';
        continue;
      }

      row.style.transition = 'none';
      row.style.transform = `translateY(${delta}px)`;
      moved.push(row);
    }

    previousTops.current = tops;

    if (moved.length === 0) {
      return;
    }

    cancelAnimationFrame(frameId.current);

    frameId.current = requestAnimationFrame(() => {
      for (const row of moved) {
        row.style.transition = `transform ${MOVE_DURATION_MS}ms ${MOVE_EASING}`;
        row.style.transform = '';
      }
    });
  });

  useLayoutEffect(() => {
    if (!container) {
      return;
    }

    // Row heights follow --wfs, so a resize invalidates the stored geometry.
    // Re-measure without animating — the rows did not change places.
    const observer = new ResizeObserver(() => {
      previousTops.current = measureTops(readRows(container));
    });

    observer.observe(container);

    return () => {
      cancelAnimationFrame(frameId.current);
      observer.disconnect();
    };
  }, [container]);

  return setContainer;
};
