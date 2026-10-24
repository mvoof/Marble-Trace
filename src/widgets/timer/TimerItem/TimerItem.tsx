import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import styles from './TimerItem.module.scss';

interface TimerItemProps {
  label: string;
  children: ReactNode;
}

export const TimerItem = observer(({ label, children }: TimerItemProps) => {
  return (
    <span className={styles.clockItem}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{children}</span>
    </span>
  );
});
