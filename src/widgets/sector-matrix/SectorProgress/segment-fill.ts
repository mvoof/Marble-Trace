import type { SectorEntry } from '@shared/contracts/generated/bindings';

const FULL = 1;
const EMPTY = 0;
const LAP_END_PCT = 1;

/**
 * How full each segment of the lap bar is, 0 to 1: a sector the car has left
 * is full, the one it is in fills with its share of that sector, the rest are
 * empty. Off the lap every segment is empty.
 */
export const segmentFills = (
  sectors: readonly SectorEntry[],
  currentSectorIdx: number | null,
  lapDistPct: number
): number[] => {
  const starts = sectors
    .map((sector) => sector.sectorStartPct)
    .toSorted((first, second) => first - second);

  return starts.map((startPct, sectorIndex) => {
    if (currentSectorIdx === null || sectorIndex > currentSectorIdx) {
      return EMPTY;
    }

    if (sectorIndex < currentSectorIdx) {
      return FULL;
    }

    const endPct = starts[sectorIndex + 1] ?? LAP_END_PCT;
    const length = endPct - startPct;

    if (length <= 0) {
      return EMPTY;
    }

    return Math.min(FULL, Math.max(EMPTY, (lapDistPct - startPct) / length));
  });
};
