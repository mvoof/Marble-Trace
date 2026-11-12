import { observer } from 'mobx-react-lite';

import { StatChip } from '@shared/ui/StatChip/StatChip';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { usePlayerStore } from '@entities/player/player-context';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { formatLapTimeOrDash } from '@shared/lib/telemetry-format';
import type { TimeVisibility } from '@shared/contracts/widget-choices';
import type { SectorMatrixWidgetSettings } from '../settings-schema';

import styles from './SectorFooter.module.scss';

const hasTime = (lapTime: number | null): boolean =>
  lapTime !== null && lapTime > 0;

const isShown = (visibility: TimeVisibility, timed: boolean): boolean =>
  visibility === 'always' || (visibility === 'withTime' && timed);

/**
 * The bar under the matrix: the last lap and the best, in the best's purple.
 * Each chip shows as its setting says; with neither, the bar is gone.
 */
export const SectorFooter = observer(() => {
  const { lapTiming } = usePlayerStore();
  const { lastLapChip, bestLapChip } =
    useWidgetSettings<SectorMatrixWidgetSettings>('sector-matrix');

  const lastLapTime = lapTiming?.lap_last_lap_time ?? null;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;

  const showsLast = isShown(lastLapChip, hasTime(lastLapTime));
  const showsBest = isShown(bestLapChip, hasTime(bestLapTime));

  if (!showsLast && !showsBest) {
    return null;
  }

  return (
    <div className={styles.footer}>
      {showsLast && (
        <StatChip lead="LAST" look="reading" className={styles.chip}>
          <FixedDigits text={formatLapTimeOrDash(lastLapTime)} />
        </StatChip>
      )}

      {showsBest && (
        <StatChip
          lead="BEST"
          look="reading"
          tone="special"
          className={`${styles.chip} ${styles.bestChip}`}
        >
          <FixedDigits text={formatLapTimeOrDash(bestLapTime)} />
        </StatChip>
      )}
    </div>
  );
});
