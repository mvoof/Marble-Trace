import React from 'react';
import { observer } from 'mobx-react-lite';

import styles from './StandingsHeaderCell.module.scss';

interface StandingsHeaderCellProps {
  align?: 'left' | 'center' | 'right';
  title?: string;
  className?: string;
  children: React.ReactNode;
}

export const StandingsHeaderCell = observer(
  ({
    align = 'left',
    title,
    className,
    children,
  }: StandingsHeaderCellProps) => {
    const alignClass =
      align === 'center'
        ? styles.thCenter
        : align === 'right'
          ? styles.thRight
          : undefined;

    return (
      <span
        className={[styles.th, alignClass, className].filter(Boolean).join(' ')}
        title={title}
      >
        {children}
      </span>
    );
  }
);
