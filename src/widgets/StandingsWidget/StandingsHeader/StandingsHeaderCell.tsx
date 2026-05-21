import React from 'react';
import { observer } from 'mobx-react-lite';

import styles from './StandingsHeaderCell.module.scss';

interface StandingsHeaderCellProps {
  align?: 'left' | 'center' | 'right';
  title?: string;
  children: React.ReactNode;
}

export const StandingsHeaderCell = observer(
  ({ align = 'left', title, children }: StandingsHeaderCellProps) => {
    const alignClass =
      align === 'center'
        ? styles.thCenter
        : align === 'right'
          ? styles.thRight
          : undefined;

    return (
      <span
        className={`${styles.th}${alignClass ? ` ${alignClass}` : ''}`}
        title={title}
      >
        {children}
      </span>
    );
  }
);
