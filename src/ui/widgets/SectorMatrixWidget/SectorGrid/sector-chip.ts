import {
  formatSectorDelta,
  formatSectorTime,
  getDeltaState,
} from '@utils/delta-utils';

const AHEAD_COLOR = 'var(--sector-ahead)';
const BEHIND_COLOR = 'var(--sector-behind)';
const NEUTRAL_COLOR = 'var(--sector-neutral)';
const DIM_COLOR = 'var(--sector-dim)';
const IDLE_BORDER_COLOR = 'rgba(255, 255, 255, 0.1)';

const LIVE_LABEL = 'LIVE';
const PENDING_TIME = '--.---';

export interface SectorChipState {
  isCurrent: boolean;
  isFuture: boolean;
  /** The sector's time, or the running one while the car is in it. */
  displayTime: string;
  /** The delta against the personal best; absent on a sector not reached yet. */
  deltaText: string | null;
  deltaColor: string;
  borderColor: string;
  /** Null on a sector already reached, which keeps the stylesheet's colour. */
  timeColor: string | null;
}

export interface SectorChipInput {
  sectorIndex: number;
  currentSectorIdx: number;
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

  const isDone =
    sectorIndex < currentSectorIdx || (sectorTime !== null && sectorTime > 0);

  const isCurrent = sectorIndex === currentSectorIdx && !isDone;
  const isFuture = sectorIndex > currentSectorIdx;

  const delta = sectorDeltas[sectorIndex] ?? null;

  const displayTime = (() => {
    if (isDone) {
      return formatSectorTime(sectorTime);
    }

    if (!isCurrent) {
      return PENDING_TIME;
    }

    const completedSectorSum = sectorTimes
      .slice(0, sectorIndex)
      .reduce<number>((sum, time) => sum + (time ?? 0), 0);

    return (currentLapTime - completedSectorSum).toFixed(3);
  })();

  const borderColor = (() => {
    if (isFuture) {
      return IDLE_BORDER_COLOR;
    }

    if (isCurrent) {
      return AHEAD_COLOR;
    }

    return colorForDeltaState(delta);
  })();

  return {
    isCurrent,
    isFuture,
    displayTime,
    deltaText: isFuture
      ? null
      : isCurrent
        ? LIVE_LABEL
        : formatSectorDelta(delta),
    deltaColor: isCurrent ? DIM_COLOR : colorForDeltaState(delta),
    borderColor,
    timeColor: isFuture ? DIM_COLOR : null,
  };
};
