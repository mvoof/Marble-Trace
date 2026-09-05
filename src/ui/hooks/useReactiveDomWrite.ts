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
 * synchronously; it calls `scheduleWrite` with the actual DOM write, which is
 * coalesced into the next animation frame. Several observable changes inside one
 * frame therefore cost one write, not one each.
 *
 * The exception is the first write, which runs synchronously inside the layout
 * effect: the element has just been mounted carrying none of the value yet, and
 * deferring it would paint one frame of whatever the stylesheet falls back to
 * before jumping — visibly, since these values are usually transitioned.
 *
 * Use it only for hot telemetry fields, and only where a single value changes
 * per frame — an angle, an offset, a level. At 10 Hz the answer is the
 * shell/body split instead.
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
  const effectRef = useRef(reactiveEffect);

  // Declared before the autorun effect below so the commit order refreshes the
  // callback first; writing the ref during render would break under React's
  // replayed/discarded renders.
  useLayoutEffect(() => {
    effectRef.current = reactiveEffect;
  });

  const hasWrittenRef = useRef(false);

  const scheduleWrite = useCallback((write: () => void) => {
    if (!hasWrittenRef.current) {
      hasWrittenRef.current = true;
      write();

      return;
    }

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(write);
  }, []);

  useLayoutEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    hasWrittenRef.current = false;

    const disposer = autorun(() => effectRef.current(element, scheduleWrite));

    return () => {
      disposer();
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return elementRef;
};
