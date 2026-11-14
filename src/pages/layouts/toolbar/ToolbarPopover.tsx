import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import { useClickOutside } from '@shared/hooks/useClickOutside';
import { cx } from '@shared/lib/class-names';

import styles from './ToolbarPopover.module.scss';

interface PopoverControl {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

interface ToolbarPopoverProps {
  trigger: (control: PopoverControl) => ReactNode;
  children: (control: PopoverControl) => ReactNode;
  /** Which edge of the trigger the panel lines up with. */
  align?: 'start' | 'end';
  isWide?: boolean;
}

/**
 * A panel under a control of the bar, closed by a click elsewhere or Escape.
 *
 * The panel stays mounted while closed: a file picker or a dialog opened from
 * one of its rows outlives the panel closing behind it.
 */
export const ToolbarPopover = observer(
  ({
    trigger,
    children,
    align = 'start',
    isWide = false,
  }: ToolbarPopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const close = useCallback(() => setIsOpen(false), []);
    const rootRef = useClickOutside<HTMLDivElement>(close);
    const control: PopoverControl = {
      isOpen,
      toggle: () => setIsOpen((wasOpen) => !wasOpen),
      close,
    };

    useEffect(() => {
      if (!isOpen) {
        return;
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          close();
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, close]);

    return (
      <div ref={rootRef} className={styles.root}>
        {trigger(control)}

        <div
          className={cx(
            styles.panel,
            align === 'end' && styles.panelEnd,
            isWide && styles.panelWide
          )}
          hidden={!isOpen}
        >
          {children(control)}
        </div>
      </div>
    );
  }
);
