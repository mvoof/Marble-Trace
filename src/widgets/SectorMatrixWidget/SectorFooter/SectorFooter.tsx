import { observer } from 'mobx-react-lite';
import {
  useLapStore,
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import { formatDelta, getDeltaState } from '@utils/widget/delta-utils';
import type { SectorMatrixWidgetSettings } from '@/types/widget-settings';
import { ReferenceBadge } from '@/components/shared/ReferenceBadge/ReferenceBadge';
import styles from './SectorFooter.module.scss';

const DELTA_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

export const SectorFooter = observer(() => {
  const lapStore = useLapStore();
  const widgetSettings = useWidgetSettingsStore();

  const { reference } =
    widgetSettings.getSettings<SectorMatrixWidgetSettings>('sector-matrix');

  const { lapTiming } = useTelemetryStore();
  const lastEntry = lapStore.history[0] ?? null;
  const delta = lastEntry?.deltas[reference] ?? null;
  const lastLapTime = lastEntry?.lapTime ?? null;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;

  return (
    <div className={styles.root}>
      <div className={styles.entry}>
        <span className={styles.tag}>LAST</span>

        <span className={styles.time}>{formatLapTime(lastLapTime)}</span>

        {delta !== null && (
          <>
            <span
              className={`${styles.delta} ${DELTA_CLASS[getDeltaState(delta)]}`}
            >
              {formatDelta(delta)}
            </span>

            <ReferenceBadge reference={reference} />
          </>
        )}
      </div>

      <div className={styles.entry}>
        <span className={styles.tag}>BEST</span>

        <span className={`${styles.time} ${styles.bestTime}`}>
          {formatLapTime(bestLapTime)}
        </span>
      </div>
    </div>
  );
});
