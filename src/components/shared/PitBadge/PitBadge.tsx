import styles from './PitBadge.module.scss';

interface PitBadgeProps {
  state?: 'in' | 'stall' | 'exit' | 'none';
}

export const PitBadge = ({ state = 'stall' }: PitBadgeProps) => {
  if (state === 'in') {
    return <span className={`${styles.pitBadge} ${styles.pitIn}`}>PIT IN</span>;
  }

  if (state === 'exit') {
    return (
      <span className={`${styles.pitBadge} ${styles.pitExit}`}>PIT EXIT</span>
    );
  }

  return <span className={styles.pitBadge}>PIT</span>;
};
