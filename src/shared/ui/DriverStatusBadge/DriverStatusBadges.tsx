import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import {
  StatChip,
  type StatChipLead,
  type StatChipTone,
} from '@shared/ui/StatChip/StatChip';
import type { FlagType } from '@shared/contracts/domain';
import type { PitState } from '@shared/contracts/generated/bindings';

export interface DriverStatusBadgesProps {
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
  /** Carried on the pit badge's darker half — Standings puts the time there. */
  pitDetail?: ReactNode;
  /** Carried on the tow badge's darker half — the player's tow countdown. */
  towDetail?: ReactNode;
}

/**
 * The badges that qualify a driver's row: disqualified, towed, out of the
 * world, off track, in the pits.
 *
 * Shared by Standings and Relative, which resolved the same five states in the
 * same order with the same precedence — a disqualification hides the rest, and
 * a tow hides "out" and the pit badge: the car stands in its stall until the
 * tow is over, and only then is it a stop.
 */
type DriverStatus =
  | 'pit'
  | 'pit_in'
  | 'pit_exit'
  | 'out'
  | 'off_track'
  | 'dnf'
  | 'tow';

interface StatusChip {
  label: string;
  tone: StatChipTone;
  lead: StatChipLead;
}

// A stop and a tow are filled — they change the race. Garage, off-track and a
// disqualification are tinted: they are states, not events. Whatever rides
// along — the pit time, the tow — sits on the chip's dark half.
const CHIP_BY_STATUS: Record<DriverStatus, StatusChip> = {
  dnf: { label: 'DNF', tone: 'danger', lead: 'tint' },
  pit_in: { label: 'IN', tone: 'info', lead: 'solid' },
  pit_exit: { label: 'OUT', tone: 'accent', lead: 'solid' },
  tow: { label: 'TOW', tone: 'lapped', lead: 'solid' },
  out: { label: 'GAR', tone: 'muted', lead: 'tint' },
  off_track: { label: 'OT', tone: 'muted', lead: 'tint' },
  pit: { label: 'PIT', tone: 'danger', lead: 'solid' },
};

const StatusChip = observer(
  ({ status, detail }: { status: DriverStatus; detail?: ReactNode }) => {
    const { label, tone, lead } = CHIP_BY_STATUS[status];

    return (
      <StatChip
        lead={label}
        leadVariant={lead}
        tone={tone}
        emphasized={lead === 'solid'}
      >
        {detail}
      </StatChip>
    );
  }
);

export const DriverStatusBadges = observer(
  ({
    flagType,
    isTowed,
    isOut,
    isOffTrack,
    isPit,
    pitState,
    isFinished = false,
    showPit = true,
    pitDetail,
    towDetail,
  }: DriverStatusBadgesProps) => {
    if (flagType === 'dq') {
      return <StatusChip status="dnf" />;
    }

    return (
      <>
        {isTowed && <StatusChip status="tow" detail={towDetail} />}

        {isOut && !isTowed && !isFinished && <StatusChip status="out" />}

        {isOffTrack && !isFinished && <StatusChip status="off_track" />}

        {showPit && isPit && !isTowed && !isFinished && (
          <StatusChip
            status={
              pitState === 'in'
                ? 'pit_in'
                : pitState === 'exit'
                  ? 'pit_exit'
                  : 'pit'
            }
            detail={pitDetail}
          />
        )}
      </>
    );
  }
);
