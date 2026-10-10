import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import styles from './MetricCell.module.scss';

export type MetricTone = 'neutral' | 'positive' | 'warning' | 'danger';

interface MetricCellProps {
  label: string;
  tone: MetricTone;
  children: ReactNode;
}

const TONE_CLASS: Record<MetricTone, string> = {
  neutral: styles.toneNeutral,
  positive: styles.tonePositive,
  warning: styles.toneWarning,
  danger: styles.toneDanger,
};

/** One of the counters on the lower tier: a caption and its value, in one tone. */
export const MetricCell = observer(
  ({ label, tone, children }: MetricCellProps) => (
    <div className={styles.cell}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${TONE_CLASS[tone]}`}>{children}</span>
    </div>
  )
);
