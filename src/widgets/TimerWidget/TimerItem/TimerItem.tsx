import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import styles from './TimerItem.module.scss';

interface TimerItemProps {
  label: string;
  align?: 'left' | 'right';
  children: ReactNode;
}

export const TimerItem = observer(
  ({ label, align = 'left', children }: TimerItemProps) => (
    <span
      className={align === 'right' ? styles.clockItemRight : styles.clockItem}
    >
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{children}</span>
    </span>
  )
);
