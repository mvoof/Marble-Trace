import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import styles from './TimerItem.module.scss';

interface TimerItemProps {
  label: string;
  variant?: 'time' | 'date';
  children: ReactNode;
}

export const TimerItem = observer(
  ({ label, variant = 'time', children }: TimerItemProps) => {
    const valueClassName =
      variant === 'date' ? `${styles.value} ${styles.dateValue}` : styles.value;

    return (
      <span className={styles.clockItem}>
        <span className={styles.label}>{label}</span>
        <span className={valueClassName}>{children}</span>
      </span>
    );
  }
);
