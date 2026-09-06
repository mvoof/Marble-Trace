import {
  useCallback,
  useLayoutEffect,
  useRef,
  type DependencyList,
  type RefObject,
} from 'react';
import { autorun } from 'mobx';

/**
 * Sends a fast-changing value to the DOM without waking React. The sanctioned
 * bypass of the rendering rule, and the only one — a hand-rolled ref plus
 * `requestAnimationFrame` is the same idea without the review signal. See
 * `docs/rendering.md`.
 *
 * The DOM sibling of `useReactiveCanvasLoop`, and deliberately the same shape:
 * `reactiveEffect` runs inside an `autorun` and must read its observables
 * synchronously; it calls `scheduleWrite` with the actual DOM write, and every
 * write the latest run scheduled is flushed together in the next animation
 * frame. Several observable changes inside one frame therefore cost one write
 * per call site, not one each — and a run that writes two properties, or two
 * elements, keeps both.
 *
 * The exception is the first run, whose writes all happen synchronously inside
 * the layout effect: the element has just been mounted carrying none of the value yet, and
 * deferring it would paint one frame of whatever the stylesheet falls back to
 * before jumping — visibly, since these values are usually transitioned.
 *
 * Use it only for hot telemetry fields — an angle, an offset, a level. At 10 Hz
 * the answer is the shell/body split instead.
 *
 * Returns the ref to attach to the element the write targets. The autorun starts
 * once that element is attached and is disposed, along with any pending frame,
 * on unmount.
 */
export const useReactiveDomWrite = <ElementType extends Element>(
  reactiveEffect: (
    element: ElementType,
    scheduleWrite: (write: () => void) => void
  ) => void,
  deps: DependencyList
): RefObject<ElementType | null> => {
  const elementRef = useRef<ElementType | null>(null);
  const rafRef = useRef(0);
  const pendingWritesRef = useRef<Array<() => void>>([]);
  const effectRef = useRef(reactiveEffect);

  // Declared before the autorun effect below so the commit order refreshes the
  // callback first; writing the ref during render would break under React's
  // replayed/discarded renders.
  useLayoutEffect(() => {
    effectRef.current = reactiveEffect;
  });

  const isFirstRunRef = useRef(true);

  const flushWrites = useCallback(() => {
    rafRef.current = 0;
    const writes = pendingWritesRef.current;
    pendingWritesRef.current = [];

    for (const write of writes) {
      write();
    }
  }, []);

  const scheduleWrite = useCallback(
    (write: () => void) => {
      if (isFirstRunRef.current) {
        write();

        return;
      }

      pendingWritesRef.current.push(write);

      if (rafRef.current === 0) {
        rafRef.current = requestAnimationFrame(flushWrites);
      }
    },
    [flushWrites]
  );

  useLayoutEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    isFirstRunRef.current = true;

    const disposer = autorun(() => {
      // A run supersedes the one before it: whatever the previous run queued is
      // about to be re-scheduled from fresher values, so it is dropped rather
      // than written first. Two runs inside one frame therefore still cost one
      // write per call site, exactly as one run does.
      pendingWritesRef.current = [];

      effectRef.current(element, scheduleWrite);
      isFirstRunRef.current = false;
    });

    return () => {
      disposer();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      pendingWritesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return elementRef;
};
