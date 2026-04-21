import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
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

  const lastLap = lap?.lap_last_lap_time ?? null;
  const bestLap = lap?.lap_best_lap_time ?? null;

  const allBestTimes = carIdxData?.car_idx_best_lap_time ?? [];
  const validTimes = allBestTimes.filter((t) => t > 0);
  const p1Time = validTimes.length > 0 ? Math.min(...validTimes) : null;

  return (
    <LapTimesWidget
      lastLapTime={formatLapTime(lastLap)}
      lastLapDelta={formatDeltaVsBest(lastLap, bestLap)}
      bestLapTime={formatLapTime(bestLap)}
      p1LapTime={formatLapTime(p1Time)}
      p1Delta={formatDeltaVsBest(p1Time, bestLap)}
    />
  );
});
