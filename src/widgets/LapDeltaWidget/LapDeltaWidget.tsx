import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import {
  useBackendComputedStore,
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type {
  LapDeltaWidgetSettings,
  LapTimePosition,
} from '@/types/widget-settings';
import { DeltaLive } from './DeltaLive/DeltaLive';
import { LapFlash } from './LapFlash/LapFlash';
import styles from './LapDeltaWidget.module.scss';

interface CompletedLap {
  lapNum: number;
  lapTime: number;
  delta: number;
  isBest: boolean;
  completedAt: number;
}

const FLASH_POSITION_CLASS: Record<LapTimePosition, string> = {
  none: '',
  top: styles.flashTop,
  bottom: styles.flashBottom,
  left: styles.flashLeft,
  right: styles.flashRight,
};

export const LapDeltaWidget = observer(() => {
  const { lapTiming } = useTelemetryStore();
  const { lapDelta } = useBackendComputedStore();

  const widgetSettings = useWidgetSettingsStore();

  const { reference, lapTimePosition, flashDuration } =
    widgetSettings.getSettings<LapDeltaWidgetSettings>('lap-delta');

  const completedLapRef = useRef<CompletedLap | null>(null);

  const prevLapRef = useRef<number | null>(null);
  const prevBestRef = useRef<number | null>(null);

  const lapNum = lapTiming?.lap ?? null;

  const lastLapTime = lapTiming?.lap_last_lap_time ?? null;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;

  useEffect(() => {
    if (lapNum === null || lastLapTime === null) return;

    if (prevLapRef.current !== null && lapNum > prevLapRef.current) {
      const prevBest = prevBestRef.current;
      const isNewBest = prevBest !== null && lastLapTime < prevBest;

      const delta =
        reference === 'session_best'
          ? (lapDelta?.sessionBestTotal ?? 0)
          : lastLapTime - (prevBest ?? lastLapTime);

      completedLapRef.current = {
        lapNum: lapNum - 1,
        lapTime: lastLapTime,
        delta,
        isBest: isNewBest,
        completedAt: performance.now(),
      };
    }

    prevLapRef.current = lapNum;
    prevBestRef.current = bestLapTime;
  }, [lapNum, lastLapTime, bestLapTime, lapDelta, reference]);

  const completed = completedLapRef.current;

  const showFlash =
    lapTimePosition !== 'none' &&
    completed !== null &&
    performance.now() - completed.completedAt < flashDuration * 1000;

  return (
    <div className={styles.root}>
      {showFlash && completed && (
        <div
          className={`${styles.flash} ${FLASH_POSITION_CLASS[lapTimePosition]}`}
        >
          <LapFlash
            lapNum={completed.lapNum}
            lapTime={completed.lapTime}
            delta={completed.delta}
            isBest={completed.isBest}
            duration={flashDuration}
          />
        </div>
      )}

      <WidgetPanel minWidth={0} gap={0}>
        <DeltaLive />
      </WidgetPanel>
    </div>
  );
});
