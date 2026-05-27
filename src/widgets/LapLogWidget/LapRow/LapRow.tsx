import styles from './LapRow.module.scss';

interface Props {
  lapLabel: string;
  time: string | null;
  deltaLabel?: string;
  deltaColor?: string;
  isLive?: boolean;
  isBest?: boolean;
}

export const LapRow = ({
  lapLabel,
  time,
  deltaLabel,
  deltaColor,
  isLive,
  isBest,
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

    <span
      className={`${styles.lapTime} ${isBest ? styles.lapTimeBest : ''} ${time === null ? styles.lapTimeInvalid : ''}`}
    >
      {time ?? 'INV'}
    </span>

    {deltaLabel !== undefined && (
      <span className={styles.deltaCell}>
        <span
          className={styles.delta}
          style={deltaColor ? { color: deltaColor } : undefined}
        >
          {deltaLabel}
        </span>
      </span>
    )}
  </div>
);
