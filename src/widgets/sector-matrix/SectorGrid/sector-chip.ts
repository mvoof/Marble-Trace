import {
  formatSectorDelta,
  formatSectorTime,
  getDeltaState,
} from '@shared/lib/delta-utils';

const AHEAD_COLOR = 'var(--sector-ahead)';
const BEHIND_COLOR = 'var(--sector-behind)';
const NEUTRAL_COLOR = 'var(--sector-neutral)';
const DIM_COLOR = 'var(--sector-dim)';
const IDLE_BORDER_COLOR = 'rgba(255, 255, 255, 0.1)';

const PENDING_TIME = '--.---';

export interface SectorChipState {
  isCurrent: boolean;
  isFuture: boolean;
  /** The sector's time, or the running one while the car is in it. */
  displayTime: string;
  /**
   * The delta against the personal best; absent on a sector not reached yet,
   * and on the running one until there is a best to measure it against.
   */
  deltaText: string | null;
  deltaColor: string;
  borderColor: string;
  /** Null on a sector already reached, which keeps the stylesheet's colour. */
  timeColor: string | null;
}

export interface SectorChipInput {
  sectorIndex: number;
  /** Null while the car is off the lap: every sector is still ahead. */
  currentSectorIdx: number | null;
  sectorTimes: readonly (number | null)[];
  sectorDeltas: readonly (number | null)[];
  currentLapTime: number;
}

const colorForDeltaState = (delta: number | null): string => {
  const deltaState = getDeltaState(delta);

  if (deltaState === 'ahead') {
    return AHEAD_COLOR;
  }

  if (deltaState === 'behind') {
    return BEHIND_COLOR;
  }

  return NEUTRAL_COLOR;
};

/**
 * Everything one chip of the matrix shows, as plain data. It is pure so that the
 * grid can apply it straight to the DOM on an animation frame — the sector
 * deltas move with the lap, and re-rendering twenty chips for them is what the
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

  const isOnLap = currentSectorIdx !== null;

  // The index alone decides: the backend writes the running sector's time into
  // its slot too, so a time is no sign the car has left the sector.
  const isCurrent = sectorIndex === currentSectorIdx;
  const isFuture = !isOnLap || sectorIndex > currentSectorIdx;

  const delta = sectorDeltas[sectorIndex] ?? null;

  const displayTime = (() => {
    if (isCurrent) {
      const completedSectorSum = sectorTimes
        .slice(0, sectorIndex)
        .reduce<number>((sum, time) => sum + (time ?? 0), 0);

      return formatSectorTime(
        sectorTime ?? currentLapTime - completedSectorSum
      );
    }

    if (sectorTime !== null && sectorTime > 0) {
      return formatSectorTime(sectorTime);
    }

    return PENDING_TIME;
  })();

  const borderColor = (() => {
    if (isFuture) {
      return IDLE_BORDER_COLOR;
    }

    // The running sector's edge follows its live delta, and keeps the last one
    // once the car leaves it; green only marks it until there is a best lap.
    if (isCurrent && delta === null) {
      return AHEAD_COLOR;
    }

    return colorForDeltaState(delta);
  })();

  return {
    isCurrent,
    isFuture,
    displayTime,
    deltaText:
      isFuture || (isCurrent && delta === null)
        ? null
        : formatSectorDelta(delta),
    deltaColor: colorForDeltaState(delta),
    borderColor,
    timeColor: isFuture ? DIM_COLOR : null,
  };
};
