import { observer } from 'mobx-react-lite';

import { telemetryStore, computedStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useAutoSizeWidget } from '../../../hooks/useAutoSizeWidget';
import { formatLapTime } from '../../../utils/telemetry-format';
import { LapTimesWidget } from './LapTimesWidget';

const formatDeltaVsBest = (
  lapTime: number | null,
  bestTime: number | null
): string => {
  if (lapTime === null || lapTime <= 0 || bestTime === null || bestTime <= 0)
    return '—';
  const delta = lapTime - bestTime;
  if (Math.abs(delta) < 0.001) return '—';
  return (delta >= 0 ? '+' : '') + delta.toFixed(3);
};

export const LapTimesWidgetContainer = observer(() => {
  const lap = telemetryStore.lapTiming;
  const carIdxData = telemetryStore.carIdx;
  const standings = computedStore.standings?.entries ?? [];
  const settings = widgetSettingsStore.getLapTimesSettings();

  const widgetRef = useAutoSizeWidget('lap-times');

  const currentLap = lap?.lap_current_lap_time ?? null;
  const lastLap = lap?.lap_last_lap_time ?? null;
  const bestLap = lap?.lap_best_lap_time ?? null;

  const playerClassId = standings.find((e) => e.isPlayer)?.carClassId;
  const classEntries =
    playerClassId !== undefined
      ? standings.filter((e) => e.carClassId === playerClassId)
      : [];

  const allBestTimes = carIdxData?.car_idx_best_lap_time ?? [];

  const classBestTimes = classEntries
    .map((e) => allBestTimes[e.carIdx])
    .filter((t): t is number => t !== undefined && t > 0);

  const timesToUse =
    classBestTimes.length > 0
      ? classBestTimes
      : allBestTimes.filter((t) => t > 0);

  const p1Time = timesToUse.length > 0 ? Math.min(...timesToUse) : null;

  return (
    <LapTimesWidget
      ref={widgetRef}
      currentLapTime={formatLapTime(currentLap)}
      lastLapTime={formatLapTime(lastLap)}
      lastLapDelta={formatDeltaVsBest(lastLap, bestLap)}
      bestLapTime={formatLapTime(bestLap)}
      p1LapTime={formatLapTime(p1Time)}
      p1Delta={formatDeltaVsBest(p1Time, bestLap)}
      settings={settings}
    />
  );
});
