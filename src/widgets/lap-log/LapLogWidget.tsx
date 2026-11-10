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
import { formatLapTimeOrDash } from '@shared/lib/telemetry-format';
import { averageValidLapTime } from './lap-log-utils';
import { LapRow, type LapRowKind } from './LapRow/LapRow';
import type {
  RowPadding,
  TimeVisibility,
} from '@shared/contracts/widget-choices';
import type { LapLogWidgetSettings } from './settings-schema';

import styles from './LapLogWidget.module.scss';

/** A row's height before the first one is measured: the mockup's 34px. */
const ROW_HEIGHT_REM = 2.125;

/** The lap being driven and at least one behind it. */
const MIN_LAP_ROWS = 2;

const LIVE_ROW_COUNT = 1;

/**
 * The footer is one row tall — a chip and the row's padding and rule — so the
 * rows that fit the frame, counted from under the header, leave it one.
 */
const FOOTER_ROW_COUNT = 1;

const ROW_PADDING_CLASS: Record<RowPadding, string> = {
  narrow: styles.rowPaddingNarrow,
  medium: styles.rowPaddingMedium,
  wide: styles.rowPaddingWide,
};

const entryKind = (entry: LapHistoryEntry): LapRowKind => {
  if (entry.isBest) {
    return 'best';
  }

  if (entry.lapTime === null) {
    return 'invalid';
  }

  return 'lap';
};

const isShown = (visibility: TimeVisibility, hasTime: boolean): boolean =>
  visibility === 'always' || (visibility === 'withTime' && hasTime);

/**
 * The lap being driven over the laps before it, as a timing table: the best
 * lap in the header, each lap's loss to it in a chip — or, as a setting, a
 * bar — and the mean of the timed laps under them. Like the tables, the width
 * sets the scale and the frame's height how many laps may show; the card is
 * only as tall as the laps it has, so the frame is a ceiling, not a size.
 */
export const LapLogWidget = observer(() => {
  const { showDelta, paceLossBars, rowPadding, bestLapChip, averageFooter } =
    useWidgetSettings<LapLogWidgetSettings>('lap-log');
  const { lapHistory } = useBackendComputedStore();
  const { lapTiming } = usePlayerStore();
  const sim = useSimStore();

  // Measured against the whole frame, not the card: the card is only as tall
  // as its laps, the frame is the room they may take.
  const { ref: frameRef, count: rowsUnderHeader } =
    useVisibleRowCount<HTMLDivElement>(
      ROW_HEIGHT_REM,
      MIN_LAP_ROWS,
      '[data-lap-row]'
    );

  const lapNum = lapTiming?.lap ?? null;
  const currentLapTime = lapTiming?.lap_current_lap_time ?? 0;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;

  const hasData = sim.isConnected && lapTiming != null;
  const showsBestChip = isShown(
    bestLapChip,
    bestLapTime !== null && bestLapTime > 0
  );

  // Whether the footer could show decides the room the laps get, so a lap
  // turning valid never trades a row for the footer and back.
  const reservesFooter = hasData && averageFooter !== 'never';
  const lapRows = Math.max(
    MIN_LAP_ROWS,
    rowsUnderHeader - (reservesFooter ? FOOTER_ROW_COUNT : 0)
  );

  const visibleHistory = lapHistory.slice(0, lapRows - LIVE_ROW_COUNT);
  const { average, count } = averageValidLapTime(visibleHistory);
  const showsFooter =
    reservesFooter && isShown(averageFooter, average !== null);

  return (
    <WidgetPanel
      direction="column"
      gap={0}
      minWidth={0}
      className={styles.panel}
    >
      {/* Mounted afresh when the laps come in, so the row count is measured
        against a real row instead of the fallback height. */}
      <div
        ref={frameRef}
        key={hasData ? 'laps' : 'empty'}
        className={styles.frame}
      >
        <div className={`${styles.card} ${ROW_PADDING_CLASS[rowPadding]}`}>
          <div className={styles.header}>
            <span className={styles.title}>LAP LOG</span>

            {showsBestChip && (
              <StatChip
                // Without the delta column the card is too narrow for the word.
                lead={showDelta ? 'BEST' : '★'}
                look="reading"
                tone="special"
                className={styles.bestChip}
              >
                <FixedDigits text={formatLapTimeOrDash(bestLapTime)} />
              </StatChip>
            )}
          </div>

          {!hasData ? (
            <NoDataPlaceholder />
          ) : (
            <div className={styles.lapList}>
              <LapRow
                kind="live"
                lapNum={lapNum}
                time={formatLapTimeOrDash(currentLapTime)}
                showDelta={showDelta}
              />

              {visibleHistory.map((entry) => (
                <LapRow
                  key={entry.lapNum}
                  kind={entryKind(entry)}
                  lapNum={entry.lapNum}
                  time={formatLapTimeOrDash(entry.lapTime)}
                  delta={entry.delta}
                  paceLossBars={paceLossBars}
                  showDelta={showDelta}
                />
              ))}
            </div>
          )}

          {showsFooter && (
            <div className={styles.footer}>
              <span className={styles.footerLabel}>
                {showDelta
                  ? `AVG VALID (${count} ${count === 1 ? 'LAP' : 'LAPS'})`
                  : `AVG (${count})`}
              </span>

              <StatChip>
                <FixedDigits text={formatLapTimeOrDash(average)} />
              </StatChip>
            </div>
          )}
        </div>
      </div>
    </WidgetPanel>
  );
});
