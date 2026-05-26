import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import {
  useLapStore,
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import {
  formatDelta,
  getDeltaState,
  getGameDelta,
} from '@utils/widget/delta-utils';
import type { LapLogWidgetSettings } from '@/types/widget-settings';
import { LapRow } from './LapRow/LapRow';
import styles from './LapLogWidget.module.scss';

// TODO: use style class and variables
const DELTA_COLORS = {
  ahead: '#22c55e',
  behind: '#ef4444',
  neutral: '#fbbf24',
};

const HISTORY_SHOW_SIZE = 8;

export const LapLogWidget = observer(() => {
  const lapStore = useLapStore();
  const { lapTiming } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { reference } =
    widgetSettings.getSettings<LapLogWidgetSettings>('lap-log');

  const lapNum = lapTiming?.lap ?? null;
  const currentLapTime = lapTiming?.lap_current_lap_time ?? 0;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;
  const liveDelta = getGameDelta(lapTiming, reference);

  const visibleHistory = lapStore.history.slice(0, HISTORY_SHOW_SIZE);

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

      <LapRow
        lapLabel={`L${lapNum ?? '--'}`}
        time={formatLapTime(currentLapTime)}
        deltaLabel={formatDelta(liveDelta)}
        deltaColor={DELTA_COLORS[getDeltaState(liveDelta)]}
        isLive
        reference={reference}
      />

      {visibleHistory.map((entry) => {
        const delta = entry.deltas[reference];

        return (
          <LapRow
            key={entry.lapNum}
            lapLabel={`L${entry.lapNum}`}
            time={formatLapTime(entry.lapTime)}
            deltaLabel={entry.isBest ? '★ BEST' : formatDelta(delta)}
            deltaColor={
              entry.isBest
                ? 'rgba(192, 132, 252, 0.85)' // TODO: use style class and variables
                : delta !== null
                  ? DELTA_COLORS[getDeltaState(delta)]
                  : undefined
            }
            isBest={entry.isBest}
            reference={reference}
          />
        );
      })}
    </WidgetPanel>
  );
});
