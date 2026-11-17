import { useEffect } from 'react';

/** The class the main window's scrollbar thumb shows on (MainWindow.module.scss). */
export const SCROLLING_CLASS = 'mt-scrolling';

/** How long a scrollbar stays after the last scroll. */
const HIDE_AFTER_MS = 900;

/**
 * Scrollbars show while something scrolls and fade a moment after, as in the
 * mockup: every scrolled element is marked for a short while. Scroll events do
 * not bubble, so the listener catches them on the way down.
 */
export const useAutoHideScrollbars = () => {
  useEffect(() => {
    const timers = new Map<Element, number>();

    const onScroll = (event: Event) => {
      const target =
        event.target === document
          ? document.scrollingElement
          : (event.target as Element | null);

      if (!target) {
        return;
      }

      target.classList.add(SCROLLING_CLASS);
      window.clearTimeout(timers.get(target));
      timers.set(
        target,
        window.setTimeout(() => {
          target.classList.remove(SCROLLING_CLASS);
          timers.delete(target);
        }, HIDE_AFTER_MS)
      );
    };

    document.addEventListener('scroll', onScroll, {
      capture: true,
      passive: true,
    });

    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });

      for (const [element, timer] of timers) {
        window.clearTimeout(timer);
        element.classList.remove(SCROLLING_CLASS);
      }
    };
  }, []);
};
