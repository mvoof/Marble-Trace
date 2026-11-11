import type { CSSProperties, ReactNode, Ref } from 'react';

import styles from './WidgetPanel.module.scss';
import { cx } from '@shared/lib/class-names';

interface WidgetPanelProps {
  children: ReactNode;
  className?: string;
  minWidth?: number;
  direction?: 'column' | 'row';
  gap?: number;
  style?: CSSProperties;
  fitContent?: boolean;
  fitHeight?: boolean;
  edgeInset?: boolean;
  ref?: Ref<HTMLElement>;
}

export const WidgetPanel = ({
  children,
  className,
  minWidth = 200,
  direction = 'column',
  gap = 12,
  style,
  fitContent = false,
  fitHeight = false,
  edgeInset = false,
  ref,
}: WidgetPanelProps) => (
  <section
    ref={ref}
    className={cx(
      styles.panel,
      fitContent && styles.fitContent,
      fitHeight && styles.fitHeight,
      edgeInset && styles.edgeInset,
      className
    )}
    style={{
      minWidth: `calc(${minWidth}px * var(--wfs, 1))`,
      flexDirection: direction,
      gap,
      ...style,
    }}
  >
    {children}
  </section>
);
