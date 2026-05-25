import type { LapDeltaReference } from '@/types/widget-settings';
import styles from './ReferenceBadge.module.scss';

interface Props {
  reference: LapDeltaReference;
  className?: string;
}

export const ReferenceBadge = ({ reference, className }: Props) => (
  <span className={`${styles.badge} ${className ?? ''}`}>
    {reference === 'session_best' ? 'SB' : 'PB'}
  </span>
);
