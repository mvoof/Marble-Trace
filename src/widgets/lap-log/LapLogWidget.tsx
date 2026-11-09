import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { NoDataPlaceholder } from '@shared/ui/NoDataPlaceholder/NoDataPlaceholder';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip } from '@shared/ui/StatChip/StatChip';
import { useVisibleRowCount } from '@shared/hooks/useVisibleRowCount';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { usePlayerStore } from '@entities/player/player-context';
import { useSimStore } from '@entities/sim/sim-context';
import type { LapHistoryEntry } from '@shared/contracts/generated/bindings';
import { averageValidLapTime, formatLapTimeOrDash } from './lap-log-utils';
import { LapRow, type LapRowKind } from './LapRow/LapRow';
import type { LapLogVisibility, LapLogWidgetSettings } from './settings-schema';

import styles from './LapLogWidget.module.scss';

/** A row's height before the first one is measured: the mockup's 34px. */
const ROW_HEIGHT_REM = 2.125;

/** The lap being driven and at least one behind it. */
const MIN_VISIBLE_ROWS = 2;

const LIVE_ROW_COUNT = 1;

const entryKind = (entry: LapHistoryEntry): LapRowKind => {
  if (entry.isBest) {
    return 'best';
  }

  if (entry.lapTime === null) {
    return 'invalid';
  }

  return 'lap';
};

const isShown = (visibility: LapLogVisibility, hasTime: boolean): boolean =>
  visibility === 'always' || (visibility === 'withTime' && hasTime);

/**
 * The lap being driven over the laps before it, as a timing table: the best
 * lap in the header, each lap's loss to it in a chip — or, as a setting, a
 * bar — and the mean of the timed laps under them. Like the tables, the width
 * sets the scale and the height how many laps fit.
 */
export const LapLogWidget = observer(() => {
  const { paceLossBars, bestLapChip, averageFooter } =
    useWidgetSettings<LapLogWidgetSettings>('lap-log');
  const { lapHistory } = useBackendComputedStore();
  const { lapTiming } = usePlayerStore();
  const sim = useSimStore();

  const { ref: lapListRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(
      ROW_HEIGHT_REM,
      MIN_VISIBLE_ROWS,
      '[data-lap-row]'
    );

  const lapNum = lapTiming?.lap ?? null;
  const currentLapTime = lapTiming?.lap_current_lap_time ?? 0;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;

  const visibleHistory = lapHistory.slice(
    0,
    Math.max(0, visibleRowCount - LIVE_ROW_COUNT)
  );
  const { average, count } = averageValidLapTime(visibleHistory);

  const hasData = sim.isConnected && lapTiming != null;
  const showsBestChip = isShown(
    bestLapChip,
    bestLapTime !== null && bestLapTime > 0
  );
  const showsFooter = hasData && isShown(averageFooter, average !== null);

  return (
    <WidgetPanel
      direction="column"
      gap={0}
      minWidth={0}
      className={styles.panel}
    >
      <div className={styles.header}>
        <span className={styles.title}>LAP LOG</span>

        {showsBestChip && (
          <StatChip
            lead="BEST"
            tone="special"
            emphasized
            className={styles.bestChip}
          >
            <FixedDigits text={formatLapTimeOrDash(bestLapTime)} />
          </StatChip>
        )}
      </div>

      {!hasData ? (
        <NoDataPlaceholder />
      ) : (
        <div ref={lapListRef} className={styles.lapList}>
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
      )}

      {showsFooter && (
        <div className={styles.footer}>
          <span className={styles.footerLabel}>
            AVG VALID ({count} {count === 1 ? 'LAP' : 'LAPS'})
          </span>

          <StatChip>
            <FixedDigits text={formatLapTimeOrDash(average)} />
          </StatChip>
        </div>
      )}
    </WidgetPanel>
  );
});
