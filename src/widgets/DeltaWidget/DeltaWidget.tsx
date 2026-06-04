import { observer } from 'mobx-react-lite';
import {
  useAppSettingsStore,
  useLapStore,
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { DeltaWidgetSettings } from '@/types/widget-settings';
import { DeltaLive } from './DeltaLive/DeltaLive';
import { LapFlash } from './LapFlash/LapFlash';
import styles from './DeltaWidget.module.scss';

export const DeltaWidget = observer(() => {
  const lapStore = useLapStore();
  const { lapTiming } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();
  const { dragMode } = useAppSettingsStore();

  const { showLapFlash, flashDuration } =
    widgetSettings.getSettings<DeltaWidgetSettings>('delta');

  const lap = lapStore.lastCompletedLap;

  const showFlash = !dragMode && showLapFlash && lap !== null;

  const rawLapTime = lapTiming?.lap_last_lap_time ?? 0;
  const flashLapTime = rawLapTime > 0 ? rawLapTime : 0;
  const flashIsBest =
    rawLapTime > 0 && rawLapTime === (lapTiming?.lap_best_lap_time ?? 0);

  return (
    <div className={styles.container}>
      {!showFlash && (
        <div className={styles.deltaWrapper}>
          <DeltaLive />
        </div>
      )}

      {showFlash && (
        <div className={styles.deltaWrapper}>
          <LapFlash
            key={String(lap.lapNum)}
            lapNum={lap.lapNum}
            lapTime={flashLapTime}
            isBest={flashIsBest}
            duration={flashDuration}
          />
        </div>
      )}
    </div>
  );
});
