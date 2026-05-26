import { observer } from 'mobx-react-lite';
import {
  useTelemetryStore,
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  formatSectorTime,
  formatSectorDelta,
  getDeltaState,
} from '@utils/widget/delta-utils';
import type { SectorMatrixWidgetSettings } from '@/types/widget-settings';
import styles from './SectorGrid.module.scss';

interface Props {
  sectorCount: number;
}

const colsForCount = (count: number): number => {
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 12) return 3;
  if (count <= 20) return 4;

  return 5;
};

export const SectorGrid = observer(({ sectorCount }: Props) => {
  const { lapTiming } = useTelemetryStore();
  const { lapDelta } = useBackendComputedStore();

  const widgetSettings = useWidgetSettingsStore();

  const { reference } =
    widgetSettings.getSettings<SectorMatrixWidgetSettings>('sector-matrix');

  const currentSectorIdx = lapDelta?.currentSectorIdx ?? 0;
  const sectorTimes = lapDelta?.sectorTimes ?? [];

  const sectorDeltas =
    reference === 'session_best'
      ? (lapDelta?.sessionBestSectors ?? [])
      : (lapDelta?.personalBestSectors ?? []);

  const currentLapTime = lapTiming?.lap_current_lap_time ?? 0;

  const cols = colsForCount(sectorCount);

  return (
    <div
      className={styles.grid}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {Array.from({ length: sectorCount }, (_, idx) => {
        const sectorTime = sectorTimes[idx] ?? null;

        const isDone =
          idx < currentSectorIdx || (sectorTime !== null && sectorTime > 0);

        const isCurrent = idx === currentSectorIdx && !isDone;
        const isFuture = idx > currentSectorIdx;

        const delta = sectorDeltas[idx] ?? null;

        let displayTime: string;

        if (isDone) {
          displayTime = formatSectorTime(sectorTime);
        } else if (isCurrent) {
          const completedSectorSum = sectorTimes
            .slice(0, idx)
            .reduce<number>((acc, t) => acc + (t ?? 0), 0);

          const elapsed = currentLapTime - completedSectorSum;

          displayTime = elapsed.toFixed(3);
        } else {
          displayTime = '--.---';
        }

        const deltaState = getDeltaState(delta);

        return (
          <div
            key={idx}
            className={`${styles.chip} ${isCurrent ? styles.chipCurrent : ''} ${isFuture ? styles.chipFuture : ''}`}
          >
            <div className={styles.chipTop}>
              <span
                className={`${styles.sectorLabel} ${isCurrent ? styles.labelCurrent : isFuture ? styles.labelFuture : styles.labelDone}`}
              >
                S{idx + 1}
              </span>

              {!isFuture && (
                <span
                  className={styles.sectorDelta}
                  style={{
                    color: isCurrent
                      ? 'var(--sector-dim)'
                      : deltaState === 'ahead'
                        ? 'var(--sector-ahead)'
                        : deltaState === 'behind'
                          ? 'var(--sector-behind)'
                          : 'var(--sector-neutral)',
                  }}
                >
                  {isCurrent ? 'LIVE' : formatSectorDelta(delta)}
                </span>
              )}
            </div>

            <div
              className={styles.chipTime}
              style={{ color: isFuture ? 'var(--sector-dim)' : undefined }}
            >
              {displayTime}
            </div>
          </div>
        );
      })}
    </div>
  );
});
