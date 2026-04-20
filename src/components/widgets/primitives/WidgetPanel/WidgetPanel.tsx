import type { CSSProperties, ReactNode } from 'react';

import styles from './WidgetPanel.module.scss';

interface WidgetPanelProps {
  children: ReactNode;
  className?: string;
  minWidth?: number;
  direction?: 'column' | 'row';
  gap?: number;
  style?: CSSProperties;
}

export const WidgetPanel = ({
  children,
  className,
  minWidth = 200,
  direction = 'column',
  gap = 12,
  style,
}: WidgetPanelProps) => (
  <section
    className={`${styles.panel} ${className ?? ''}`}
    style={{
      minWidth,
      flexDirection: direction,
      gap,
      ...style,
    }}
  >
    {children}
  </section>
);
