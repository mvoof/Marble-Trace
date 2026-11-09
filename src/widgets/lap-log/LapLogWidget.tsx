import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { NoDataPlaceholder } from '@shared/ui/NoDataPlaceholder/NoDataPlaceholder';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip } from '@shared/ui/StatChip/StatChip';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { usePlayerStore } from '@entities/player/player-context';
import { useSimStore } from '@entities/sim/sim-context';
import type { LapHistoryEntry } from '@shared/contracts/generated/bindings';
import { averageValidLapTime, formatLapTimeOrDash } from './lap-log-utils';
import { LapRow, type LapRowKind } from './LapRow/LapRow';
import type { LapLogWidgetSettings } from './settings-schema';

import styles from './LapLogWidget.module.scss';

const HISTORY_SHOW_SIZE = 8;

const entryKind = (entry: LapHistoryEntry): LapRowKind => {
  if (entry.isBest) {
    return 'best';
  }

  if (entry.lapTime === null) {
    return 'invalid';
  }

  return 'lap';
};

/**
 * The lap being driven over the last eight, as a timing table: the best lap
 * in the header, each lap's loss to it in a chip — or, as a setting, a bar —
 * and the mean of the timed laps under them.
 */
export const LapLogWidget = observer(() => {
  const { paceLossBars } = useWidgetSettings<LapLogWidgetSettings>('lap-log');
  const { lapHistory } = useBackendComputedStore();
  const { lapTiming } = usePlayerStore();
  const sim = useSimStore();

  const lapNum = lapTiming?.lap ?? null;
  const currentLapTime = lapTiming?.lap_current_lap_time ?? 0;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;

  const visibleHistory = lapHistory.slice(0, HISTORY_SHOW_SIZE);
  const { average, count } = averageValidLapTime(visibleHistory);

  const hasData = sim.isConnected && lapTiming != null;

  return (
    <WidgetPanel direction="column" gap={0} minWidth={0}>
      <div className={styles.header}>
        <span className={styles.title}>LAP LOG</span>

        <StatChip
          lead="BEST"
          tone="special"
          emphasized
          className={styles.bestChip}
        >
          <FixedDigits text={formatLapTimeOrDash(bestLapTime)} />
        </StatChip>
      </div>

      {!hasData ? (
        <NoDataPlaceholder />
      ) : (
        <>
          <div>
            <LapRow
              kind="live"
              lapNum={lapNum}
              time={formatLapTimeOrDash(currentLapTime)}
            />

            {visibleHistory.map((entry) => (
              <LapRow
                key={entry.lapNum}
                kind={entryKind(entry)}
                lapNum={entry.lapNum}
                time={formatLapTimeOrDash(entry.lapTime)}
                delta={entry.delta}
                paceLossBars={paceLossBars}
              />
            ))}
          </div>

          <div className={styles.footer}>
            <span className={styles.footerLabel}>
              AVG VALID ({count} {count === 1 ? 'LAP' : 'LAPS'})
            </span>

            <StatChip>
              <FixedDigits text={formatLapTimeOrDash(average)} />
            </StatChip>
          </div>
        </>
      )}
    </WidgetPanel>
  );
});
