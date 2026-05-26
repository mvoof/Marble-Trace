import { observer } from 'mobx-react-lite';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import {
  formatDelta,
  getDeltaState,
  getGameDelta,
} from '@utils/widget/delta-utils';
import type { LapTimesWidgetSettings } from '@/types/widget-settings';
import styles from './RefsColumn.module.scss';

const DELTA_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

export const RefsColumn = observer(() => {
  const { lapTiming } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { reference, showPredicted } =
    widgetSettings.getSettings<LapTimesWidgetSettings>('lap-times');

  const currentLap = lapTiming?.lap_current_lap_time ?? null;
  const lastLap = lapTiming?.lap_last_lap_time ?? null;
  const bestLap = lapTiming?.lap_best_lap_time ?? null;

  const liveDelta = getGameDelta(lapTiming, reference);

  const lastDelta =
    lastLap !== null && bestLap !== null && bestLap > 0
      ? lastLap - bestLap
      : null;

  const predictedTime =
    bestLap !== null && bestLap > 0 ? bestLap + liveDelta : null;

  return (
    <div className={styles.rows}>
      <RefRow
        tag="CURR"
        time={formatLapTime(currentLap)}
        delta={liveDelta}
        current
      />

      <RefRow tag="LAST" time={formatLapTime(lastLap)} delta={lastDelta} />

      <RefRow tag="BEST" time={formatLapTime(bestLap)} star />
      {showPredicted && (
        <RefRow tag="PRED" time={formatLapTime(predictedTime)} predicted />
      )}
    </div>
  );
});

interface RefRowProps {
  tag: string;
  time: string;
  delta?: number | null;
  star?: boolean;
  predicted?: boolean;
  current?: boolean;
}

const RefRow = ({
  tag,
  time,
  delta,
  star,
  predicted,
  current,
}: RefRowProps) => (
  <div className={styles.row}>
    <span className={styles.tag}>{tag}</span>
    <span
      className={[
        styles.time,
        star ? styles.bestTime : '',
        predicted ? styles.predTime : '',
        current ? styles.currTime : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {time}
    </span>
    {star ? (
      <span className={styles.star}>★</span>
    ) : delta !== null && delta !== undefined && !predicted ? (
      <span className={`${styles.delta} ${DELTA_CLASS[getDeltaState(delta)]}`}>
        {formatDelta(delta)}
      </span>
    ) : (
      <span />
    )}
  </div>
);
