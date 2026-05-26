import { ReferenceBadge } from '@/components/shared/ReferenceBadge/ReferenceBadge';
import type { LapDeltaReference } from '@/types/widget-settings';
import styles from './LapRow.module.scss';

interface Props {
  lapLabel: string;
  time: string;
  deltaLabel: string;
  deltaColor?: string;
  isLive?: boolean;
  isBest?: boolean;
  reference?: LapDeltaReference;
}

export const LapRow = ({
  lapLabel,
  time,
  deltaLabel,
  deltaColor,
  isLive,
  isBest,
  reference,
}: Props) => (
  <div
    className={`${styles.row} ${isLive ? styles.rowLive : ''} ${isBest ? styles.rowBest : ''}`}
  >
    <span
      className={`${styles.lapNum} ${isLive ? styles.lapNumLive : ''} ${isBest ? styles.lapNumBest : ''}`}
    >
      {isLive && <span className={styles.liveIcon}>▶</span>}
      {lapLabel}
    </span>

    <span className={`${styles.lapTime} ${isBest ? styles.lapTimeBest : ''}`}>
      {time}
    </span>

    <span className={styles.deltaCell}>
      <span
        className={styles.delta}
        style={deltaColor ? { color: deltaColor } : undefined}
      >
        {deltaLabel}
      </span>

      {reference && !isBest && <ReferenceBadge reference={reference} />}
    </span>
  </div>
);
