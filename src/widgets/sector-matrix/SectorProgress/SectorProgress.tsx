import { observer } from 'mobx-react-lite';

import { StatChip } from '@shared/ui/StatChip/StatChip';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import type { SectorEntry } from '@shared/contracts/generated/bindings';
import { usePlayerStore } from '@entities/player/player-context';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { segmentFills } from './segment-fill';

import styles from './SectorProgress.module.scss';

interface Props {
  sectors: readonly SectorEntry[];
}

const PERCENT = 100;

/** The lap as one segment per sector, with how far into it the car is. */
export const SectorProgress = observer(({ sectors }: Props) => {
  const { lapTiming } = usePlayerStore();
  const { currentSectorIdx } = useBackendComputedStore();

  const lapDistPct = lapTiming?.lap_dist_pct ?? 0;
  const fills = segmentFills(sectors, currentSectorIdx, lapDistPct);
  const sectorNumber = currentSectorIdx === null ? '-' : currentSectorIdx + 1;

  return (
    <div className={styles.root}>
      <div
        className={styles.segments}
        style={{ gridTemplateColumns: `repeat(${fills.length}, 1fr)` }}
      >
        {fills.map((fill, sectorIndex) => (
          <span key={sectorIndex} className={styles.segment}>
            <span
              className={styles.segmentFill}
              style={{ transform: `scaleX(${fill})` }}
            />
          </span>
        ))}
      </div>

      <div className={styles.meta}>
        <span className={styles.lapProgress}>
          <FixedDigits
            className={styles.percent}
            text={`${Math.round(lapDistPct * PERCENT)}%`}
          />

          <span className={styles.caption}>LAP PROGRESS</span>
        </span>

        <StatChip
          lead={`S${sectorNumber}/${fills.length}`}
          leadKind="number"
          tone="muted"
          size="xs"
          className={styles.counter}
        />
      </div>
    </div>
  );
});
