import styles from './TimingRow.module.scss';

interface TimingRowProps {
  label: string;
  time: string;
  delta: string;
  accentColor: string;
  deltaColor?: string;
}

export const TimingRow = ({
  label,
  time,
  delta,
  accentColor,
  deltaColor,
}: TimingRowProps) => (
  <div
    className={`${styles.row} ${!delta ? styles.noDelta : ''}`}
    style={{ borderLeftColor: accentColor }}
  >
    <span className={styles.label}>{label}</span>
    <span className={styles.time}>{time}</span>
    {delta && (
      <span
        className={styles.delta}
        style={{ color: deltaColor ?? accentColor }}
      >
        {delta}
      </span>
    )}
  </div>
);
