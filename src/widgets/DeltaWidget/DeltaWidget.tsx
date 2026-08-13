import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  useAppSettingsStore,
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { getDeltaToPreviousBest } from '@utils/delta-utils';
import type { DeltaWidgetSettings } from '@/types/widget-settings';
import { DeltaLive } from './DeltaLive/DeltaLive';
import { LapFlash } from './LapFlash/LapFlash';
import styles from './DeltaWidget.module.scss';

export const DeltaWidget = observer(() => {
  const lapStore = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();
  const { dragMode } = useAppSettingsStore();

  const { showLapFlash, flashDuration } =
    widgetSettings.getSettings<DeltaWidgetSettings>('delta');

  const lap = lapStore.lastCompletedLap;
  const lapNum = lap?.lapNum ?? null;

  const [currentFlashLapNum, setCurrentFlashLapNum] = useState<number | null>(
    null
  );

  useEffect(() => {
    if (lapNum !== null) {
      setCurrentFlashLapNum(lapNum);

      const timer = setTimeout(() => {
        setCurrentFlashLapNum(null);
      }, flashDuration * 1000);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [lapNum, flashDuration]);

  const showFlash =
    !dragMode &&
    showLapFlash &&
    lap !== null &&
    currentFlashLapNum === lap.lapNum;

  const historyEntry = lap
    ? lapStore.lapHistory.find((entry) => entry.lapNum === lap.lapNum)
    : null;
  const flashLapTime =
    historyEntry?.lapTime && historyEntry.lapTime > 0
      ? historyEntry.lapTime
      : 0;
  const flashIsBest = historyEntry?.isBest ?? false;
  const flashPersonalDelta =
    lap && flashLapTime > 0
      ? getDeltaToPreviousBest(lapStore.lapHistory, lap.lapNum, flashLapTime)
      : null;

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
            lapTime={flashLapTime}
            isBest={flashIsBest}
            personalDelta={flashPersonalDelta}
            duration={flashDuration}
          />
        </div>
      )}
    </div>
  );
});
