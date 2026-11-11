import React from 'react';
import { observer } from 'mobx-react-lite';

import styles from './StandingsHeaderCell.module.scss';
import { cx } from '@shared/lib/class-names';

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
      className={cx(
        styles.th,
        ALIGN_CLASS[align],
        endsBlock ? styles.thBlockEnd : undefined
      )}
      title={title}
    >
      {children}
    </span>
  )
);
