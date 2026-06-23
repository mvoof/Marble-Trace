import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { NoDataPlaceholder } from '@/components/shared/NoDataPlaceholder/NoDataPlaceholder';
import {
  useBackendComputedStore,
  usePlayerStore,
  useSimStore,
} from '@store/root-store-context';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import { formatDelta, getDeltaState } from '@utils/widget/delta-utils';
import { LapRow } from './LapRow/LapRow';
import styles from './LapLogWidget.module.scss';

const HISTORY_SHOW_SIZE = 8;

export const LapLogWidget = observer(() => {
  const { lapHistory, lastCompletedLap: _lastCompleted } =
    useBackendComputedStore();
  const { lapTiming } = usePlayerStore();
  const sim = useSimStore();

  const lapNum = lapTiming?.lap ?? null;
  const currentLapTime = lapTiming?.lap_current_lap_time ?? 0;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;

  const visibleHistory = lapHistory.slice(0, HISTORY_SHOW_SIZE);

  const hasData = sim.isConnected && lapTiming != null;

  return (
    <WidgetPanel direction="column" gap={0} minWidth={0}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>LAP HISTORY</span>

        <div className={styles.headerBest}>
          <span className={styles.headerBestLabel}>BEST</span>

          <span className={styles.headerBestTime}>
            {formatLapTime(bestLapTime)}
          </span>
        </div>
      </div>

      {!hasData ? (
        <NoDataPlaceholder />
      ) : (
        <>
          <LapRow
            lapLabel={`L${lapNum ?? '--'}`}
            time={formatLapTime(currentLapTime)}
            isLive
          />

          {visibleHistory.map((entry) => (
            <LapRow
              key={entry.lapNum}
              lapLabel={`L${entry.lapNum}`}
              time={
                entry.lapTime !== null ? formatLapTime(entry.lapTime) : null
              }
              deltaLabel={entry.isBest ? '★ BEST' : formatDelta(entry.delta)}
              deltaVariant={
                entry.isBest
                  ? 'best'
                  : entry.delta !== null
                    ? getDeltaState(entry.delta)
                    : undefined
              }
              isBest={entry.isBest}
            />
          ))}
        </>
      )}
    </WidgetPanel>
  );
});
