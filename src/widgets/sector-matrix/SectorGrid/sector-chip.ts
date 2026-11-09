import {
  formatSectorDelta,
  formatSectorTime,
  getDeltaState,
} from '@shared/lib/delta-utils';
import type { StatChipTone } from '@shared/ui/StatChip/StatChip';
import { EMPTY_VALUE } from '@shared/lib/telemetry-format';

const LIVE_TEXT = 'LIVE';

/**
 * What a cell shows the sector as: banked ahead of, behind or level with the
 * best; the one the car is in; one not reached, with last lap's time or none.
 */
export type SectorCellKind =
  | 'ahead'
  | 'behind'
  | 'level'
  | 'current'
  | 'upcoming'
  | 'empty';

/** The chip beside the sector's name: its delta, or LIVE on the running one. */
export interface SectorDeltaChip {
  text: string;
  tone: StatChipTone;
  /** The running sector before there is a best to measure it against. */
  isLive: boolean;
}

export interface SectorChipState {
  kind: SectorCellKind;
  /** The sector's time, or the running one while the car is in it. */
  displayTime: string;
  /** Absent on a sector not reached yet. */
  delta: SectorDeltaChip | null;
}

export interface SectorChipInput {
  sectorIndex: number;
  /** Null while the car is off the lap: every sector is still ahead. */
  currentSectorIdx: number | null;
  sectorTimes: readonly (number | null)[];
  sectorDeltas: readonly (number | null)[];
  currentLapTime: number;
}

const toneForDelta = (delta: number | null): StatChipTone => {
  const deltaState = getDeltaState(delta);

  if (deltaState === 'ahead') {
    return 'positive';
  }

  if (deltaState === 'behind') {
    return 'danger';
  }

  return 'accent';
};

const bankedKindOf = (delta: number | null): SectorCellKind => {
  const deltaState = getDeltaState(delta);

  if (deltaState === 'ahead') {
    return 'ahead';
  }

  if (deltaState === 'behind') {
    return 'behind';
  }

  return 'level';
};

const deltaChipOf = (delta: number | null): SectorDeltaChip | null =>
  delta === null
    ? null
    : {
        text: formatSectorDelta(delta),
        tone: toneForDelta(delta),
        isLive: false,
      };

/**
 * Everything one cell of the matrix shows, as plain data. It is pure so that the
 * grid can apply it straight to the DOM on an animation frame — the sector
 * deltas move with the lap, and re-rendering twenty cells for them is what the
 * rendering rule is about. See `docs/rendering.md`.
 */
export const sectorChipStateOf = ({
  sectorIndex,
  currentSectorIdx,
  sectorTimes,
  sectorDeltas,
  currentLapTime,
}: SectorChipInput): SectorChipState => {
  const sectorTime = sectorTimes[sectorIndex] ?? null;
  const delta = sectorDeltas[sectorIndex] ?? null;

  // The index alone decides: the backend writes the running sector's time into
  // its slot too, so a time is no sign the car has left the sector.
  if (sectorIndex === currentSectorIdx) {
    const completedSectorSum = sectorTimes
      .slice(0, sectorIndex)
      .reduce<number>((sum, time) => sum + (time ?? 0), 0);

    return {
      kind: 'current',
      displayTime: formatSectorTime(
        sectorTime ?? currentLapTime - completedSectorSum
      ),
      // The running sector shows its live delta once there is a best lap.
      delta: deltaChipOf(delta) ?? {
        text: LIVE_TEXT,
        tone: 'positive',
        isLive: true,
      },
    };
  }

  const hasTime = sectorTime !== null && sectorTime > 0;
  const isFuture = currentSectorIdx === null || sectorIndex > currentSectorIdx;

  if (isFuture) {
    return {
      kind: hasTime ? 'upcoming' : 'empty',
      displayTime: hasTime ? formatSectorTime(sectorTime) : EMPTY_VALUE,
      delta: null,
    };
  }

  return {
    kind: bankedKindOf(delta),
    displayTime: hasTime ? formatSectorTime(sectorTime) : EMPTY_VALUE,
    delta: deltaChipOf(delta),
  };
};
