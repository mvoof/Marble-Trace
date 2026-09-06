import { observer } from 'mobx-react-lite';

import { getCellDividers } from '@utils/canvas';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import {
  usePlayerStore,
  useBackendComputedStore,
} from '@store/root-store-context';

import { sectorChipStateOf, type SectorChipState } from './sector-chip';
import styles from './SectorGrid.module.scss';

interface Props {
  sectorCount: number;
}

const BORDER_COLOR_PROPERTY = '--chip-border';
const DELTA_COLOR_PROPERTY = '--chip-delta-color';
const TIME_COLOR_PROPERTY = '--chip-time-color';

const colsForCount = (count: number): number => {
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 12) return 3;
  if (count <= 20) return 4;

  return 5;
};

/**
 * The chip's two text nodes and three colours, applied straight to the DOM. The
 * running sector's time and every delta beside it move with the lap, so the grid
 * is markup React writes once and a single pass per animation frame fills. See
 * `docs/rendering.md`.
 */
const applyChipState = (chip: Element, state: SectorChipState): void => {
  if (!(chip instanceof HTMLElement)) {
    return;
  }

  chip.classList.toggle(styles.chipCurrent, state.isCurrent);
  chip.classList.toggle(styles.chipFuture, state.isFuture);
  chip.style.setProperty(BORDER_COLOR_PROPERTY, state.borderColor);
  chip.style.setProperty(DELTA_COLOR_PROPERTY, state.deltaColor);
  chip.style.setProperty(TIME_COLOR_PROPERTY, state.timeColor ?? '');

  const label = chip.querySelector(`.${styles.sectorLabel}`);

  if (label instanceof HTMLElement) {
    label.classList.toggle(styles.labelCurrent, state.isCurrent);
    label.classList.toggle(styles.labelFuture, state.isFuture);
    label.classList.toggle(
      styles.labelDone,
      !state.isCurrent && !state.isFuture
    );
  }

  const delta = chip.querySelector(`.${styles.sectorDelta}`);

  if (delta instanceof HTMLElement) {
    delta.hidden = state.deltaText === null;
    delta.textContent = state.deltaText ?? '';
  }

  const time = chip.querySelector(`.${styles.chipTime}`);

  if (time instanceof HTMLElement) {
    time.textContent = state.displayTime;
  }
};

export const SectorGrid = observer(function SectorGrid({ sectorCount }: Props) {
  const player = usePlayerStore();
  const computed = useBackendComputedStore();

  const cols = colsForCount(sectorCount);

  const gridRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const currentSectorIdx = computed.currentSectorIdx;
      const sectorTimes = computed.sectorTimes;
      const sectorDeltas = computed.sectorDeltas;
      const currentLapTime = player.lapTiming?.lap_current_lap_time ?? 0;

      const chipStates = Array.from(
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
        for (const [sectorIndex, state] of chipStates.entries()) {
          const chip = element.children[sectorIndex];

          if (chip) {
            applyChipState(chip, state);
          }
        }
      });
    },
    [computed, player, sectorCount]
  );

  return (
    <div
      ref={gridRef}
      className={styles.grid}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {Array.from({ length: sectorCount }, (_unused, sectorIndex) => {
        const dividers = getCellDividers(sectorIndex, cols, sectorCount);

        return (
          <div
            key={sectorIndex}
            className={`${styles.chip} ${dividers.right ? styles.dividerRight : ''} ${dividers.top ? styles.dividerTop : ''}`}
          >
            <div className={styles.chipTop}>
              <span className={styles.sectorLabel}>S{sectorIndex + 1}</span>

              <span className={styles.sectorDelta} />
            </div>

            <div className={styles.chipTime} />
          </div>
        );
      })}
    </div>
  );
});
