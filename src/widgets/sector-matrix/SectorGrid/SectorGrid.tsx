import { observer } from 'mobx-react-lite';

import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { writeStatChip } from '@shared/ui/StatChip/StatChip';
import { usePlayerStore } from '@entities/player/player-context';
import { useBackendComputedStore } from '@entities/cars/computed-context';

import { sectorChipStateOf, type SectorChipState } from './sector-chip';
import styles from './SectorGrid.module.scss';

interface Props {
  sectorCount: number;
}

const DELTA_PART = 'delta';
const TIME_PART = 'time';

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

const writeDelta = (slot: HTMLElement, state: SectorChipState): void => {
  const { delta } = state;
  const key = delta === null ? '' : `${delta.tone}|${delta.text}`;

  if (slot.dataset['key'] === key) {
    return;
  }

  slot.dataset['key'] = key;

  if (delta === null) {
    slot.className = styles.deltaSlot;
    slot.replaceChildren();

    return;
  }

  writeStatChip(
    slot,
    delta.tone,
    delta.isLive ? 'label' : 'number',
    delta.text
  );
  slot.classList.add(styles.deltaSlot, styles.deltaChip);

  if (delta.isLive) {
    slot.classList.add(styles.deltaLive);
  }
};

/**
 * The cell's state, delta and time, applied straight to the DOM. The running
 * sector's time and every delta beside it move with the lap, so the grid is
 * markup React writes once and a single pass per animation frame fills. See
 * `docs/rendering.md`.
 */
const applyCellState = (cell: Element, state: SectorChipState): void => {
  if (!(cell instanceof HTMLElement)) {
    return;
  }

  cell.dataset['kind'] = state.kind;

  const delta = cell.querySelector(`[data-part="${DELTA_PART}"]`);

  if (delta instanceof HTMLElement) {
    writeDelta(delta, state);
  }

  const time = cell.querySelector(`[data-part="${TIME_PART}"]`);

  if (time instanceof HTMLElement && time.textContent !== state.displayTime) {
    time.textContent = state.displayTime;
  }
};

export const SectorGrid = observer(({ sectorCount }: Props) => {
  const player = usePlayerStore();
  const computed = useBackendComputedStore();

  const cols = colsForCount(sectorCount);
  const isCompact = sectorCount > COMPACT_ABOVE_COUNT;

  const gridRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
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
          const cell = element.children[sectorIndex];

          if (cell) {
            applyCellState(cell, state);
          }
        }
      });
    },
    [computed, player, sectorCount]
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
          className={`${styles.cell} ${sectorIndex >= cols ? styles.ruleTop : ''}`}
          data-kind="empty"
        >
          <div className={styles.cellTop}>
            <span className={styles.label}>S{sectorIndex + 1}</span>

            <span className={styles.deltaSlot} data-part={DELTA_PART} />
          </div>

          <div className={styles.time} data-part={TIME_PART} />
        </div>
      ))}
    </div>
  );
});
