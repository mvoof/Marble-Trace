import { observer } from 'mobx-react-lite';

import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';

interface LiveTextProps {
  /**
   * Runs inside the autorun: reads observables, returns the text. Pass a
   * stable reference (a store method or a `useCallback`) — a new function each
   * render rebinds the reaction.
   */
  read: () => string;
  className?: string;
}

/**
 * The common hot write in one line: one value in one node, written only when
 * the text changed.
 */
export const LiveText = observer(({ read, className }: LiveTextProps) => {
  const ref = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const text = read();

      scheduleWrite(() => {
        if (element.textContent !== text) {
          element.textContent = text;
        }
      });
    },
    [read]
  );

  return <span ref={ref} className={className} />;
});
