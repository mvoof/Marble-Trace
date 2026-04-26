import { forwardRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import styles from './WidgetPanel.module.scss';

interface WidgetPanelProps {
  children: ReactNode;
  className?: string;
  minWidth?: number;
  direction?: 'column' | 'row';
  gap?: number;
  style?: CSSProperties;
  fitContent?: boolean;
}

export const WidgetPanel = forwardRef<HTMLElement, WidgetPanelProps>(
  (
    {
      children,
      className,
      minWidth = 200,
      direction = 'column',
      gap = 12,
      style,
      fitContent = false,
    },
    ref
  ) => (
    <section
      ref={ref}
      className={`${styles.panel} ${fitContent ? styles.fitContent : ''} ${className ?? ''}`}
      style={{
        minWidth,
        flexDirection: direction,
        gap,
        ...style,
      }}
    >
      {children}
    </section>
  )
);

WidgetPanel.displayName = 'WidgetPanel';
