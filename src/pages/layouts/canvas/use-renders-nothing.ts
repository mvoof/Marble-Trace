import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Whether the element holds no rendered content at all — a widget that chose to
 * draw nothing (a battery on a car without one, a battle bar with nobody near).
 *
 * Watched rather than read once: the widget is an observer of its own and
 * starts or stops drawing without the frame around it re-rendering.
 */
export const useRendersNothing = (
  ref: RefObject<HTMLElement | null>
): boolean => {
  const [isEmpty, setIsEmpty] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) return;

    const check = () => setIsEmpty(element.childElementCount === 0);

    check();

    const observer = new MutationObserver(check);

    observer.observe(element, { childList: true });

    return () => observer.disconnect();
  }, [ref]);

  return isEmpty;
};
