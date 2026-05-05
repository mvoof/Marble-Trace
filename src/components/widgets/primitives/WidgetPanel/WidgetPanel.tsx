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
  fitHeight?: boolean;
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
      fitHeight = false,
    },
    ref
  ) => (
    <section
      ref={ref}
      className={[
        styles.panel,
        fitContent && styles.fitContent,
        fitHeight && styles.fitHeight,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
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
