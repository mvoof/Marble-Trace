import { observer } from 'mobx-react-lite';
import {
  useAppSettingsStore,
  useLapStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { DeltaWidgetSettings } from '@/types/widget-settings';
import { DeltaLive } from './DeltaLive/DeltaLive';
import { LapFlash } from './LapFlash/LapFlash';
import styles from './DeltaWidget.module.scss';

const PREVIEW_LAP_TIME = 83.456;
const PREVIEW_DELTA = -0.234;

export const DeltaWidget = observer(() => {
  const lapStore = useLapStore();
  const widgetSettings = useWidgetSettingsStore();
  const { dragMode } = useAppSettingsStore();

  const { showLapFlash, flashDuration, reference } =
    widgetSettings.getSettings<DeltaWidgetSettings>('delta');

  const lap = lapStore.lastCompletedLap;

  const showFlash = showLapFlash && (lap !== null || dragMode);

  const flashKey = dragMode ? 'preview' : String(lap?.lapNum ?? 0);
  const flashLapTime = lap?.lapTime ?? PREVIEW_LAP_TIME;
  const flashDelta = lap?.deltas[reference] ?? PREVIEW_DELTA;
  const flashIsBest = lapStore.isLastLapBest;

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
          delta={flashDelta}
          isBest={flashIsBest}
          duration={flashDuration}
          preview={dragMode}
        />
      )}
    </div>
  );
});
