import { useLayoutEffect, useRef } from 'react';

/**
 * Publishes where the floating toolbar ends as `--editor-toolbar-bottom` on the
 * editor root, for the fullscreen widget drawer to start below it.
 *
 * Measured rather than declared: the bar wraps onto a second and third row as
 * the window narrows, and a constant would put the drawer underneath it at
 * exactly the widths where every tool matters most.
 */
export const useToolbarBottom = <RootElement extends HTMLElement>(
  rootRef: React.RefObject<RootElement | null>
) => {
  const toolbarRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const root = rootRef.current;

    if (!toolbar || !root) {
      return;
    }

    const publish = () => {
      const top = toolbar.offsetTop;

      root.style.setProperty(
        '--editor-toolbar-bottom',
        `${Math.round(top + toolbar.offsetHeight + top)}px`
      );
    };

    publish();

    const observer = new ResizeObserver(publish);

    observer.observe(toolbar);

    return () => observer.disconnect();
  }, [rootRef]);

  return toolbarRef;
};
