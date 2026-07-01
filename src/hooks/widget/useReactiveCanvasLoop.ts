import {
  useCallback,
  useLayoutEffect,
  useRef,
  type DependencyList,
} from 'react';
import { autorun } from 'mobx';

/**
 * Drives a canvas draw loop from MobX observables without React re-renders.
 * `reactiveEffect` runs inside an `autorun`, so it must synchronously read the
 * observables it depends on; call `scheduleDraw` at the end with the actual
 * paint work to defer it to the next animation frame.
 */
export const useReactiveCanvasLoop = (
  reactiveEffect: (scheduleDraw: (draw: () => void) => void) => void,
  deps: DependencyList
) => {
  const rafRef = useRef(0);

  const scheduleDraw = useCallback((draw: () => void) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useLayoutEffect(() => {
    const disposer = autorun(() => reactiveEffect(scheduleDraw));

    return () => {
      disposer();
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
