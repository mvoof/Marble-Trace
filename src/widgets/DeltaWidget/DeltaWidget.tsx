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

const PREVIEW_LAP_TIME = 83.456;

export const DeltaWidget = observer(() => {
  const lapStore = useLapStore();
  const { lapTiming } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();
  const { dragMode } = useAppSettingsStore();

  const { showLapFlash, flashDuration } =
    widgetSettings.getSettings<DeltaWidgetSettings>('delta');

  const lap = lapStore.lastCompletedLap;

  const showFlash = showLapFlash && (lap !== null || dragMode);

  const flashKey = dragMode ? 'preview' : String(lap?.lapNum ?? 0);
  const rawLapTime = lapTiming?.lap_last_lap_time ?? 0;
  const flashLapTime = dragMode
    ? PREVIEW_LAP_TIME
    : rawLapTime > 0
      ? rawLapTime
      : 0;
  const flashIsBest =
    !dragMode &&
    rawLapTime > 0 &&
    rawLapTime === (lapTiming?.lap_best_lap_time ?? 0);

  return (
    <div className={styles.container}>
      <div className={styles.deltaWrapper}>
        <DeltaLive />
      </div>

      {showFlash && (
        <LapFlash
          key={flashKey}
          lapNum={lap?.lapNum ?? 0}
          lapTime={flashLapTime}
          isBest={flashIsBest}
          duration={flashDuration}
          preview={dragMode}
        />
      )}
    </div>
  );
});
