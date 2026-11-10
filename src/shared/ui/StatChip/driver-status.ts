import type { FlagType } from '@shared/contracts/domain';
import type { PitState } from '@shared/contracts/generated/bindings';

import type { StatChipTone } from './StatChip';

export type DriverStatus =
  | 'pit'
  | 'pit_in'
  | 'pit_exit'
  | 'out'
  | 'off_track'
  | 'dnf'
  | 'tow';

/** One status as a row draws it: a StatChip's lead and tone. */
export interface DriverStatusChip {
  status: DriverStatus;
  label: string;
  tone: StatChipTone;
}

// Every status is tinted, never filled: it qualifies the driver, so it stays
// quieter than the position, the number and the name it sits beside.
const CHIP_BY_STATUS: Record<DriverStatus, Omit<DriverStatusChip, 'status'>> = {
  dnf: { label: 'DNF', tone: 'danger' },
  pit_in: { label: 'IN', tone: 'info' },
  pit_exit: { label: 'OUT', tone: 'accent' },
  tow: { label: 'TOW', tone: 'lapped' },
  out: { label: 'GAR', tone: 'muted' },
  off_track: { label: 'OT', tone: 'muted' },
  pit: { label: 'PIT', tone: 'danger' },
};

export interface DriverStatusState {
  flagType: FlagType;
  isTowed: boolean;
  isOut: boolean;
  isOffTrack: boolean;
  isPit: boolean;
  pitState: PitState | null;
  /**
   * A car that has taken the flag keeps its result rather than being labelled
   * out, off-track or in the pits — where it parked afterwards says nothing.
   * Standings pass this; Relative has no notion of a finished car.
   */
  isFinished?: boolean;
  /** Relative makes the pit badge optional; Standings always shows it. */
  showPit?: boolean;
}

/** A stop in any of its phases — the statuses the pit time rides on. */
export const isPitStatus = (status: DriverStatus): boolean =>
  status === 'pit' || status === 'pit_in' || status === 'pit_exit';

const chipOf = (status: DriverStatus): DriverStatusChip => ({
  status,
  ...CHIP_BY_STATUS[status],
});

/**
 * The statuses that qualify a driver's row, in the order the row draws them —
 * the one place Standings and Relative take them from. A disqualification
 * hides the rest, and a tow hides "out" and the pit badge: the car stands in
 * its stall until the tow is over, and only then is it a stop.
 */
export const resolveDriverStatuses = ({
  flagType,
  isTowed,
  isOut,
  isOffTrack,
  isPit,
  pitState,
  isFinished = false,
  showPit = true,
}: DriverStatusState): DriverStatusChip[] => {
  if (flagType === 'dq') {
    return [chipOf('dnf')];
  }

  const statuses: DriverStatusChip[] = [];

  if (isTowed) {
    statuses.push(chipOf('tow'));
  }

  if (isOut && !isTowed && !isFinished) {
    statuses.push(chipOf('out'));
  }

  if (isOffTrack && !isFinished) {
    statuses.push(chipOf('off_track'));
  }

  if (showPit && isPit && !isTowed && !isFinished) {
    statuses.push(
      chipOf(
        pitState === 'in' ? 'pit_in' : pitState === 'exit' ? 'pit_exit' : 'pit'
      )
    );
  }

  return statuses;
};
