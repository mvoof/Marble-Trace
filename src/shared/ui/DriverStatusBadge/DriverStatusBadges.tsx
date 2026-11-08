import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import { DriverStatusBadge } from './DriverStatusBadge';
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
      return <DriverStatusBadge status="dnf" />;
    }

    return (
      <>
        {isTowed && <DriverStatusBadge status="tow" detail={towDetail} />}

        {isOut && !isTowed && !isFinished && <DriverStatusBadge status="out" />}

        {isOffTrack && !isFinished && <DriverStatusBadge status="off_track" />}

        {showPit && isPit && !isTowed && !isFinished && (
          <DriverStatusBadge
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
