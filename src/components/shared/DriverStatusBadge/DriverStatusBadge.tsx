import styles from './DriverStatusBadge.module.scss';

type DriverStatus = 'pit' | 'pit_in' | 'pit_exit' | 'out' | 'off_track' | 'dnf';

interface DriverStatusBadgeProps {
  status: DriverStatus;
}

export const DriverStatusBadge = ({ status }: DriverStatusBadgeProps) => {
  if (status === 'dnf') {
    return <span className={`${styles.badge} ${styles.dnf}`}>DNF</span>;
  }

  if (status === 'pit_in') {
    return <span className={`${styles.badge} ${styles.pitIn}`}>PIT IN</span>;
  }

  if (status === 'pit_exit') {
    return <span className={`${styles.badge} ${styles.pitExit}`}>PIT OUT</span>;
  }

  if (status === 'out') {
    return <span className={`${styles.badge} ${styles.out}`}>OUT</span>;
  }

  if (status === 'off_track') {
    return <span className={`${styles.badge} ${styles.offTrack}`}>OT</span>;
  }

  return <span className={`${styles.badge} ${styles.pit}`}>PIT</span>;
};
