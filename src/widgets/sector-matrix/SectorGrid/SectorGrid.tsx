import { observer } from 'mobx-react-lite';

import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { clearStatChip, writeStatChip } from '@shared/ui/StatChip/StatChip';
import {
  useLiveParts,
  writeState,
  type LiveParts,
} from '@shared/ui/live/live-parts';
import { usePlayerStore } from '@entities/player/player-context';
import { useBackendComputedStore } from '@entities/cars/computed-context';

import { sectorChipStateOf, type SectorChipState } from './sector-chip';
import styles from './SectorGrid.module.scss';

interface Props {
  sectorCount: number;
}

const DELTA_PART = 'delta';

type CellPart = `cell${number}` | `delta${number}` | `time${number}`;

// Past two rows the cells tighten, so a long track's matrix stays short.
const COMPACT_ABOVE_COUNT = 6;
const PAIRED_COUNT = 4;
const PAIRED_COLUMNS = 2;
const MAX_COLUMNS = 3;

/**
 * A short track is one row of its sectors; four make a square; more add rows,
 * never columns — a fourth column leaves the time too little width.
 */
const colsForCount = (count: number): number => {
  if (count === PAIRED_COUNT) {
    return PAIRED_COLUMNS;
  }

  return Math.min(count, MAX_COLUMNS);
};

/**
 * A cell's delta: a stat chip, or nothing. `writeStatChip` and `writeState`
 * each write only what changed, so an unchanged frame touches nothing.
 */
const writeDelta = (slot: HTMLElement, state: SectorChipState): void => {
  const { delta } = state;

  if (delta === null) {
    writeState(slot, 'delta', null);
    clearStatChip(slot);

    return;
  }

  writeStatChip(
    slot,
    delta.tone,
    delta.isLive ? 'label' : 'number',
    delta.text,
    'reading'
  );
  writeState(slot, 'delta', delta.isLive ? 'live' : 'chip');
};

/**
 * The cell's state, delta and time, applied straight to the DOM. The running
 * sector's time and every delta beside it move with the lap, so the grid is
 * markup React writes once and a single pass per animation frame fills. See
 * `docs/rendering.md`.
 */
const applyCellState = (
  parts: LiveParts<CellPart>,
  sectorIndex: number,
  state: SectorChipState
): void => {
  parts.state(`cell${sectorIndex}`, 'kind', state.kind);

  const delta = parts.elementOf(`delta${sectorIndex}`);

  if (delta instanceof HTMLElement) {
    writeDelta(delta, state);
  }

  parts.text(`time${sectorIndex}`, state.displayTime);
};

export const SectorGrid = observer(({ sectorCount }: Props) => {
  const player = usePlayerStore();
  const computed = useBackendComputedStore();

  const cols = colsForCount(sectorCount);
  const isCompact = sectorCount > COMPACT_ABOVE_COUNT;

  const parts = useLiveParts<CellPart>();

  const gridRef = useReactiveDomWrite<HTMLDivElement>(
    (_element, scheduleWrite) => {
      const currentSectorIdx = computed.currentSectorIdx;
      const sectorTimes = computed.sectorTimes;
      const sectorDeltas = computed.sectorDeltas;
      const currentLapTime = player.lapTiming?.lap_current_lap_time ?? 0;

      const cellStates = Array.from(
        { length: sectorCount },
        (_unused, sectorIndex) =>
          sectorChipStateOf({
            sectorIndex,
            currentSectorIdx,
            sectorTimes,
            sectorDeltas,
            currentLapTime,
          })
      );

      scheduleWrite(() => {
        for (const [sectorIndex, state] of cellStates.entries()) {
          applyCellState(parts, sectorIndex, state);
        }
      });
    },
    [computed, player, sectorCount, parts]
  );

  return (
    <div
      ref={gridRef}
      className={`${styles.grid} ${isCompact ? styles.gridCompact : ''}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: sectorCount }, (_unused, sectorIndex) => (
        <div
          key={sectorIndex}
          ref={parts.ref(`cell${sectorIndex}`)}
          className={`${styles.cell} ${sectorIndex >= cols ? styles.ruleTop : ''}`}
          data-kind="empty"
        >
          <div className={styles.cellTop}>
            <span className={styles.label}>S{sectorIndex + 1}</span>

            <span
              ref={parts.ref(`delta${sectorIndex}`)}
              data-part={DELTA_PART}
            />
          </div>

          <div ref={parts.ref(`time${sectorIndex}`)} className={styles.time} />
        </div>
      ))}
    </div>
  );
});
