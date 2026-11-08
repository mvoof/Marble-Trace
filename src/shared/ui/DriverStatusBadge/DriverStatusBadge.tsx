import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import { StatChip, type StatChipLead } from '@shared/ui/StatChip/StatChip';

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
  /** A value on the chip's dark half — the time on pit road, the tow. */
  detail?: ReactNode;
}

interface StatusBadge {
  label: string;
  tone: string;
  lead: StatChipLead;
}

// A stop and a tow are filled — they change the race. Garage, off-track and a
// disqualification are tinted: they are states, not events.
const BADGE_BY_STATUS: Record<DriverStatus, StatusBadge> = {
  dnf: { label: 'DNF', tone: styles.dnf, lead: 'tint' },
  pit_in: { label: 'IN', tone: styles.pitIn, lead: 'solid' },
  pit_exit: { label: 'OUT', tone: styles.pitExit, lead: 'solid' },
  tow: { label: 'TOW', tone: styles.tow, lead: 'solid' },
  out: { label: 'GAR', tone: styles.out, lead: 'tint' },
  off_track: { label: 'OT', tone: styles.offTrack, lead: 'tint' },
  pit: { label: 'PIT', tone: styles.pit, lead: 'solid' },
};

/** A driver's state as a chip — the shape the SR/iR chip beside it has. */
export const DriverStatusBadge = observer(
  ({ status, detail }: DriverStatusBadgeProps) => {
    const { label, tone, lead } = BADGE_BY_STATUS[status];

    return (
      <StatChip
        lead={label}
        leadVariant={lead}
        emphasized={lead === 'solid'}
        className={tone}
      >
        {detail}
      </StatChip>
    );
  }
);
