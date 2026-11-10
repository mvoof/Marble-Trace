import { observer } from 'mobx-react-lite';

import { StatChip } from '@shared/ui/StatChip/StatChip';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { getGameDelta } from '@shared/lib/delta-utils';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { usePlayerStore } from '@entities/player/player-context';
import type { SectorMatrixWidgetSettings } from '../settings-schema';
import { formatLapTimeOrDash } from '@shared/lib/telemetry-format';

import styles from './SectorHeader.module.scss';

/** The bar over the matrix: the lap and its running time, the predicted lap. */
export const SectorHeader = observer(() => {
  const { lapTiming } = usePlayerStore();

  const { predictedLap } =
    useWidgetSettings<SectorMatrixWidgetSettings>('sector-matrix');

  const lapNum = lapTiming?.lap ?? null;
  const currentLapTime = lapTiming?.lap_current_lap_time ?? 0;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;
  const liveDelta = getGameDelta(lapTiming, 'personal_best');

  const predictedTime =
    bestLapTime !== null && bestLapTime > 0 && liveDelta !== null
      ? bestLapTime + liveDelta
      : null;

  const showsPredicted =
    predictedLap === 'always' ||
    (predictedLap === 'withTime' && predictedTime !== null);

  return (
    <div className={styles.header}>
      <div className={styles.lap}>
        <StatChip
          lead={`L${lapNum ?? '-'}`}
          look="state"
          tone="positive"
          className={styles.lapChip}
        />

        <FixedDigits
          className={styles.lapTime}
          text={formatLapTimeOrDash(currentLapTime)}
        />
      </div>

      {showsPredicted && (
        <StatChip
          lead="PRED"
          look="reading"
          tone="accent"
          className={styles.predChip}
        >
          <FixedDigits text={formatLapTimeOrDash(predictedTime)} />
        </StatChip>
      )}
    </div>
  );
});
