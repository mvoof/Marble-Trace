import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';

import styles from './OrderToggle.module.scss';
import { usePitServiceWidgetStore } from '@store/root-store-context';

interface OrderToggleProps {
  className: string;
  /** Extra class applied only while the block is actually clickable. */
  clickableClassName: string;
  label: string;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * Wraps a pit checkbox block so it becomes a real button while orders may be
 * sent, and stays a plain block otherwise. The overlay only owns the mouse in
 * interact mode, so outside it there is nothing to click and no reason to
 * present the block as interactive.
 */
export const OrderToggle = observer(
  ({
    className,
    clickableClassName,
    label,
    onToggle,
    children,
  }: OrderToggleProps) => {
    const widget = usePitServiceWidgetStore();

    if (!widget.canClickOrders) {
      return <div className={className}>{children}</div>;
    }

    return (
      <button
        type="button"
        aria-label={label}
        className={`${styles.reset} ${className} ${clickableClassName}`}
        onClick={onToggle}
        // Interact mode shares the mouse with widget dragging; without this a
        // click on a checkbox would start moving the widget.
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </button>
    );
  }
);
