import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { getGameDelta } from '@utils/widget/delta-utils';
import type {
  DeltaWidgetSettings,
  LapTimePosition,
} from '@/types/widget-settings';
import { DeltaLive } from './DeltaLive/DeltaLive';
import { LapFlash } from './LapFlash/LapFlash';
import styles from './DeltaWidget.module.scss';

const FLASH_POSITION_CLASS: Record<LapTimePosition, string> = {
  none: '',
  top: styles.flashTop,
  bottom: styles.flashBottom,
  left: styles.flashLeft,
  right: styles.flashRight,
};

export const DeltaWidget = observer(() => {
  const { lapTiming } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { lapTimePosition, flashDuration, reference } =
    widgetSettings.getSettings<DeltaWidgetSettings>('delta');

  const lapNum = lapTiming?.lap ?? null;
  const lastLapTime = lapTiming?.lap_last_lap_time ?? null;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;

  const lapTimingRef = useRef(lapTiming);
  lapTimingRef.current = lapTiming;

  const referenceRef = useRef(reference);
  referenceRef.current = reference;

  const [flashKey, setFlashKey] = useState(0);
  const [flashDelta, setFlashDelta] = useState(0);
  const prevLastLapTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastLapTime === null || lastLapTime <= 0) return;
    if (prevLastLapTimeRef.current === lastLapTime) return;

    prevLastLapTimeRef.current = lastLapTime;

    setFlashDelta(getGameDelta(lapTimingRef.current, referenceRef.current));
    setFlashKey((k) => k + 1);
  }, [lastLapTime]);

  const isNewBest = lastLapTime !== null && lastLapTime === bestLapTime;

  const showFlash =
    lapTimePosition !== 'none' &&
    flashKey > 0 &&
    lastLapTime !== null &&
    lastLapTime > 0;

  return (
    <div className={styles.root}>
      {showFlash && lastLapTime !== null && (
        <div
          className={`${styles.flash} ${FLASH_POSITION_CLASS[lapTimePosition]}`}
        >
          <LapFlash
            key={flashKey}
            lapNum={(lapNum ?? 1) - 1}
            lapTime={lastLapTime}
            delta={flashDelta}
            isBest={isNewBest}
            duration={flashDuration}
            deltaAbove={lapTimePosition === 'top'}
          />
        </div>
      )}

      <WidgetPanel minWidth={0} gap={0}>
        <DeltaLive />
      </WidgetPanel>
    </div>
  );
});
