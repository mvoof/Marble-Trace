import styles from './PitPanel.module.scss';

interface PitPanelProps {
  isOverLimit: boolean;
  currentSpeed: string;
  limitSpeed: string;
  speedUnit: string;
}

export const PitPanel = ({
  isOverLimit,
  limitSpeed,
  speedUnit,
}: PitPanelProps) => (
  <div
    className={`${styles.panel} ${isOverLimit ? styles.panelWarn : styles.panelSafe}`}
  >
    <span className={styles.label}>
      {isOverLimit ? 'REDUCE SPEED!' : 'PIT LIMITER'}
    </span>
    <span className={styles.badge}>
      LIMIT {limitSpeed} {speedUnit}
    </span>
  </div>
);
