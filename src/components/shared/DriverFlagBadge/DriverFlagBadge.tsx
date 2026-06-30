import type { FlagType } from '@/types';
import styles from './DriverFlagBadge.module.scss';

interface DriverFlagBadgeProps {
  type: FlagType;
}

export const DriverFlagBadge = ({ type }: DriverFlagBadgeProps) => {
  if (type === 'none') return null;

  const getTitle = () => {
    switch (type) {
      case 'checkered':
        return 'Finished (Checkered Flag)';
      case 'blue':
        return 'Lapped Warning (Blue Flag)';
      case 'meatball':
        return 'Mechanical Damage (Meatball Flag)';
      case 'black':
        return 'Warning (Black Flag)';
      case 'penalty':
        return 'Active Penalty (Black Flag)';
      case 'dq':
        return 'Disqualified (DQ Flag)';
      default:
        return '';
    }
  };

  return (
    <div className={`${styles.flagBadge} ${styles[type]}`} title={getTitle()}>
      {type === 'meatball' && <span className={styles.orangeCircle} />}
      {type === 'dq' && <span className={styles.dqX} />}
    </div>
  );
};
