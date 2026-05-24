import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';

import styles from './TimerItem.module.scss';

interface TimerItemProps {
  label: string;
  children: ReactNode;
}

export const TimerItem = observer(({ label, children }: TimerItemProps) => (
  <span className={styles.clockItem}>
    <WidgetLabel mono>{label}</WidgetLabel>
    {children}
  </span>
));
