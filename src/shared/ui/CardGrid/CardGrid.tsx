import type { ReactNode } from 'react';
import styles from './CardGrid.module.scss';

interface CardGridProps {
  children: ReactNode;
}

/**
 * Main-window cards side by side, growing to fill the row: one card takes the
 * whole width, three share it only in a wide window. A `wide` card always
 * takes a row of its own.
 */
export const CardGrid = ({ children }: CardGridProps) => (
  <div className={styles.grid}>{children}</div>
);
