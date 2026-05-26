import { observer } from 'mobx-react-lite';
import {
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
  const { lapTiming } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { reference } =
    widgetSettings.getSettings<SectorMatrixWidgetSettings>('sector-matrix');

  const lastLap = lapTiming?.lap_last_lap_time ?? null;
  const bestLap = lapTiming?.lap_best_lap_time ?? null;

  const lastDelta =
    lastLap !== null && bestLap !== null && bestLap > 0
      ? lastLap - bestLap
      : null;

  return (
    <div className={styles.root}>
      <div className={styles.entry}>
        <span className={styles.tag}>LAST</span>

        <span className={styles.time}>{formatLapTime(lastLap)}</span>

        {lastDelta !== null && (
          <>
            <span
              className={`${styles.delta} ${DELTA_CLASS[getDeltaState(lastDelta)]}`}
            >
              {formatDelta(lastDelta)}
            </span>

            <ReferenceBadge reference={reference} />
          </>
        )}
      </div>

      <div className={styles.entry}>
        <span className={styles.tag}>BEST</span>

        <span className={`${styles.time} ${styles.bestTime}`}>
          {formatLapTime(bestLap)}
        </span>
      </div>
    </div>
  );
});
