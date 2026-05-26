import type { LapDeltaReference } from '@/types/widget-settings';
import styles from './ReferenceBadge.module.scss';

interface Props {
  reference: LapDeltaReference;
  className?: string;
}

const REFERENCE_LABEL: Record<LapDeltaReference, string> = {
  personal_best: 'PB',
  personal_optimal: 'PO',
  session_best: 'SB',
  session_optimal: 'SO',
  session_last: 'SL',
};

export const ReferenceBadge = ({ reference, className }: Props) => (
  <span className={`${styles.badge} ${className ?? ''}`}>
    {REFERENCE_LABEL[reference]}
  </span>
);
