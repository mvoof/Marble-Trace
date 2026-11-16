import type { ReactNode } from 'react';
import styles from './CardGrid.module.scss';

interface CardGridProps {
  children: ReactNode;
}

/**
 * Main-window cards side by side, as many as the width takes at a readable
 * size (three in a wide window), so a short card's switch or button stays
 * next to its text. A `wide` card spans the row.
 */
export const CardGrid = ({ children }: CardGridProps) => (
  <div className={styles.grid}>{children}</div>
);
