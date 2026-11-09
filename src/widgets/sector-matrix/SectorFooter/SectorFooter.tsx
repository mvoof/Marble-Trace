import { observer } from 'mobx-react-lite';

import { StatChip } from '@shared/ui/StatChip/StatChip';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { usePlayerStore } from '@entities/player/player-context';
import { formatLapTimeOrDash } from '../sector-matrix-format';

import styles from './SectorFooter.module.scss';

/** The bar under the matrix: the last lap and the best, in the best's purple. */
export const SectorFooter = observer(() => {
  const { lapTiming } = usePlayerStore();

  const lastLapTime = lapTiming?.lap_last_lap_time ?? null;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;

  return (
    <div className={styles.footer}>
      <StatChip lead="LAST" className={styles.chip}>
        <FixedDigits text={formatLapTimeOrDash(lastLapTime)} />
      </StatChip>

      <StatChip
        lead="BEST"
        tone="special"
        emphasized
        className={`${styles.chip} ${styles.bestChip}`}
      >
        <FixedDigits text={formatLapTimeOrDash(bestLapTime)} />
      </StatChip>
    </div>
  );
});
