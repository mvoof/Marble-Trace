import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { observer } from 'mobx-react-lite';

import { cx } from '@shared/lib/class-names';

import styles from './ToolbarPopover.module.scss';

/** Room between the trigger and a detached panel, and the window's edge. */
const DETACHED_GAP_PX = 6;
const DETACHED_WIDE_WIDTH_PX = 300;

interface PopoverControl {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

interface ToolbarPopoverProps {
  trigger: (control: PopoverControl) => ReactNode;
  children: (control: PopoverControl) => ReactNode;
  /** Align with a trigger edge, or center under the positioned toolbar. */
  align?: 'start' | 'end' | 'center';
  isWide?: boolean;
  /**
   * Drawn over the whole window rather than inside the trigger's box: for a
   * trigger in a narrow column that clips what overflows it.
   */
  isDetached?: boolean;
}

/**
 * Under the trigger, kept inside the window: lined up with its left edge, or
 * with its right edge for an `end` panel.
 */
const detachedPlacementOf = (
  trigger: HTMLElement,
  align: 'start' | 'end'
): CSSProperties => {
  const bounds = trigger.getBoundingClientRect();

  if (align === 'end') {
    return {
      top: bounds.bottom + DETACHED_GAP_PX,
      right: Math.max(DETACHED_GAP_PX, window.innerWidth - bounds.right),
      left: 'auto',
    };
  }

  const rightmostLeft =
    window.innerWidth - DETACHED_WIDE_WIDTH_PX - DETACHED_GAP_PX;

  return {
    top: bounds.bottom + DETACHED_GAP_PX,
    left: Math.max(DETACHED_GAP_PX, Math.min(bounds.left, rightmostLeft)),
  };
};

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
    isDetached = false,
  }: ToolbarPopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [placement, setPlacement] = useState<CSSProperties>({});
    const rootRef = useRef<HTMLDivElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const close = useCallback(() => setIsOpen(false), []);
    const control: PopoverControl = {
      isOpen,
      toggle: () => {
        if (!isOpen && isDetached && rootRef.current) {
          setPlacement(
            detachedPlacementOf(
              rootRef.current,
              align === 'end' ? 'end' : 'start'
            )
          );
        }

        setIsOpen(!isOpen);
      },
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

      // A detached panel lives outside the trigger's box: a click in either
      // is a click inside.
      const handleMouseDown = (event: MouseEvent) => {
        const target = event.target as Node;
        const isInside =
          rootRef.current?.contains(target) ||
          panelRef.current?.contains(target);

        if (!isInside) {
          close();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleMouseDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousedown', handleMouseDown);
      };
    }, [isOpen, close]);

    const panel = (
      <div
        ref={panelRef}
        className={cx(
          styles.panel,
          align === 'end' && styles.panelEnd,
          align === 'center' && styles.panelCentered,
          isWide && styles.panelWide,
          isDetached && styles.panelDetached
        )}
        style={isDetached ? placement : undefined}
        hidden={!isOpen}
      >
        {children(control)}
      </div>
    );

    return (
      <div
        ref={rootRef}
        className={cx(styles.root, align === 'center' && styles.rootCentered)}
      >
        {trigger(control)}

        {isDetached ? createPortal(panel, document.body) : panel}
      </div>
    );
  }
);
