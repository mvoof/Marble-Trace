import styles from './StatusIndicator.module.scss';

type Status = 'positive' | 'warning' | 'danger' | 'info' | 'neutral' | 'off';
type Size = 'sm' | 'md';

interface StatusIndicatorProps {
  status: Status;
  label?: string;
  size?: Size;
  pulse?: boolean;
}

export const StatusIndicator = ({
  status,
  label,
  size = 'sm',
  pulse = false,
}: StatusIndicatorProps) => (
  <span className={styles.container}>
    <span
      className={`${styles.dot} ${styles[status]} ${styles[`dot-${size}`]} ${pulse ? styles.pulse : ''}`}
    />

    {label && <span className={styles.label}>{label}</span>}
  </span>
);
