import React from 'react';
import { observer } from 'mobx-react-lite';

import styles from './StandingsHeaderCell.module.scss';

interface StandingsHeaderCellProps {
  align?: 'left' | 'center' | 'right';
  title?: string;
  /** Closes a group of columns — the rule the rows carry runs up through it. */
  endsBlock?: boolean;
  children: React.ReactNode;
}

const ALIGN_CLASS = {
  left: undefined,
  center: styles.thCenter,
  right: styles.thRight,
} as const;

export const StandingsHeaderCell = observer(
  ({
    align = 'left',
    title,
    endsBlock = false,
    children,
  }: StandingsHeaderCellProps) => (
    <span
      className={[
        styles.th,
        ALIGN_CLASS[align],
        endsBlock ? styles.thBlockEnd : undefined,
      ]
        .filter(Boolean)
        .join(' ')}
      title={title}
    >
      {children}
    </span>
  )
);
