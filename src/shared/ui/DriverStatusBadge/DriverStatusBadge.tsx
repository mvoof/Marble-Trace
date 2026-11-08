import type { ReactNode } from 'react';

import styles from './DriverStatusBadge.module.scss';

type DriverStatus =
  | 'pit'
  | 'pit_in'
  | 'pit_exit'
  | 'out'
  | 'off_track'
  | 'dnf'
  | 'tow';

interface DriverStatusBadgeProps {
  status: DriverStatus;
  /**
   * A value carried on the badge's second half, the status colour darkened —
   * two-tone like the SR badge. The time on pit road rides on the pit badge.
   */
  detail?: ReactNode;
}

const BADGE_BY_STATUS: Record<DriverStatus, { label: string; tone: string }> = {
  dnf: { label: 'DNF', tone: styles.dnf },
  pit_in: { label: 'IN', tone: styles.pitIn },
  pit_exit: { label: 'OUT', tone: styles.pitExit },
  tow: { label: 'TOW', tone: styles.tow },
  out: { label: 'GAR', tone: styles.out },
  off_track: { label: 'OT', tone: styles.offTrack },
  pit: { label: 'PIT', tone: styles.pit },
};

export const DriverStatusBadge = ({
  status,
  detail,
}: DriverStatusBadgeProps) => {
  const { label, tone } = BADGE_BY_STATUS[status];

  if (detail === undefined) {
    return <span className={`${styles.badge} ${tone}`}>{label}</span>;
  }

  return (
    <span className={`${styles.badge} ${styles.badgeWithDetail} ${tone}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.detail}>{detail}</span>
    </span>
  );
};
