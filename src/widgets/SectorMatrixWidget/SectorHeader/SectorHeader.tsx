import { observer } from 'mobx-react-lite';
import {
  useTelemetryStore,
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import { getSectorColor } from '@utils/widget/sector-utils';
import type { SectorMatrixWidgetSettings } from '@/types/widget-settings';
import styles from './SectorHeader.module.scss';

interface Props {
  sectorCount: number;
}

export const SectorHeader = observer(({ sectorCount }: Props) => {
  const { lapTiming } = useTelemetryStore();
  const { lapDelta } = useBackendComputedStore();

  const widgetSettings = useWidgetSettingsStore();

  const { reference, showPredicted } =
    widgetSettings.getSettings<SectorMatrixWidgetSettings>('sector-matrix');

  const lapNum = lapTiming?.lap ?? null;

  const currentLapTime = lapTiming?.lap_current_lap_time ?? 0;
  const lapDistPct = lapTiming?.lap_dist_pct ?? 0;

  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;

  const liveDelta =
    reference === 'session_best'
      ? (lapDelta?.sessionBestTotal ?? null)
      : (lapDelta?.personalBestTotal ?? null);

  const predictedTime =
    bestLapTime !== null && bestLapTime > 0 && liveDelta !== null
      ? bestLapTime + liveDelta
      : null;

  const currentSectorIdx = lapDelta?.currentSectorIdx ?? 0;

  return (
    <div className={styles.root}>
      <div className={styles.topRow}>
        <div className={styles.lapInfo}>
          <span className={styles.lapTag}>▶ L{lapNum ?? '--'}</span>

          <span className={styles.lapTime}>
            {formatLapTime(currentLapTime)}
          </span>
        </div>

        {showPredicted && (
          <div className={styles.predInfo}>
            <span className={styles.predLabel}>PRED</span>

            <span className={styles.predTime}>
              {formatLapTime(predictedTime)}
            </span>
          </div>
        )}
      </div>

      <div className={styles.progressBar}>
        {Array.from({ length: sectorCount - 1 }, (_, idx) => (
          <div
            key={idx}
            className={styles.sectorTick}
            style={{ left: `${((idx + 1) / sectorCount) * 100}%` }}
          />
        ))}

        <div
          className={styles.progressFill}
          style={{
            width: `${lapDistPct * 100}%`,
            background: getSectorColor(currentSectorIdx),
          }}
        />
      </div>

      <div className={styles.progressMeta}>
        <span>{Math.round(lapDistPct * 100)}% LAP</span>

        <span>
          S{currentSectorIdx + 1}/{sectorCount}
        </span>
      </div>
    </div>
  );
});
