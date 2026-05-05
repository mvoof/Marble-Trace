import styles from './TimingRow.module.scss';

interface TimingRowProps {
  label: string;
  time: string;
  delta: string;
  accentColor: string;
  deltaColor?: string;
  fill?: boolean;
}

export const TimingRow = ({
  label,
  time,
  delta,
  accentColor,
  deltaColor,
  fill = false,
}: TimingRowProps) => (
  <div
    className={`${styles.row} ${fill ? styles.fill : ''}`}
    style={{ borderLeftColor: accentColor }}
  >
    <span className={styles.label}>{label}</span>
    <span className={styles.time}>{time}</span>
    <span
      className={`${styles.delta} ${!delta ? styles.hiddenDelta : ''}`}
      style={{ color: deltaColor ?? accentColor }}
    >
      {delta || ' '}
    </span>
  </div>
);
