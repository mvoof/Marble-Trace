import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import styles from './MetricCell.module.scss';

export type MetricTone =
  | 'neutral'
  | 'positive'
  | 'warning'
  | 'danger'
  | 'muted';

/** The share of the lower tier a column takes — the mockup's 4 · 5 · 3. */
export type MetricWidth = 'narrow' | 'normal' | 'wide';

interface MetricCellProps {
  label: string;
  tone: MetricTone;
  width: MetricWidth;
  /** The caption in the alarm color too — the limit is close. */
  isLabelAlarmed?: boolean;
  children: ReactNode;
}

const TONE_CLASS: Record<MetricTone, string> = {
  neutral: styles.toneNeutral,
  positive: styles.tonePositive,
  warning: styles.toneWarning,
  danger: styles.toneDanger,
  muted: styles.toneMuted,
};

const WIDTH_CLASS: Record<MetricWidth, string> = {
  narrow: styles.widthNarrow,
  normal: styles.widthNormal,
  wide: styles.widthWide,
};

/** One column of the lower tier: a caption at its left, the value at its right. */
export const MetricCell = observer(
  ({
    label,
    tone,
    width,
    isLabelAlarmed = false,
    children,
  }: MetricCellProps) => (
    <div className={`${styles.cell} ${WIDTH_CLASS[width]}`}>
      <span
        className={`${styles.label} ${isLabelAlarmed ? styles.labelAlarmed : ''}`}
      >
        {label}
      </span>
      <span className={`${styles.value} ${TONE_CLASS[tone]}`}>{children}</span>
    </div>
  )
);
