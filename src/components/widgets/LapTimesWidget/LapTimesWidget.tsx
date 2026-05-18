import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { computedStore } from '../../../store/iracing/computed.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { formatLapTime } from '../../../utils/telemetry-format';
import { LapTimesList } from './LapTimesList/LapTimesList';

const formatDelta = (delta: number | null): string => {
  if (delta === null) return '+-.---';
  if (Math.abs(delta) < 0.001) return '+-.---';

  return (delta >= 0 ? '+' : '') + delta.toFixed(3);
};

const getDeltaColor = (delta: number | null): string | undefined => {
  if (delta === null) return undefined;
  if (delta < -0.001) return '#22c55e';
  if (delta > 0.001) return '#ef4444';

  return '#fbbf24';
};

export const LapTimesWidget = observer(() => {
  const lap = telemetryStore.lapTiming;
  const carIdxData = telemetryStore.carIdx;
  const standings = computedStore.standings?.entries ?? [];
  const lapDelta = computedStore.lapDelta;
  const settings = widgetSettingsStore.getLapTimesSettings();

  const currentLap = lap?.lap_current_lap_time ?? null;
  const lastLap = lap?.lap_last_lap_time ?? null;
  const bestLap = lap?.lap_best_lap_time ?? null;

  const playerClassId = standings.find((entry) => entry.isPlayer)?.carClassId;
  const classEntries =
    playerClassId !== undefined
      ? standings.filter((entry) => entry.carClassId === playerClassId)
      : [];

  const allBestTimes = carIdxData?.car_idx_best_lap_time ?? [];

  const classBestTimes = classEntries.reduce<number[]>((acc, entry) => {
    const bestTime = allBestTimes[entry.carIdx];

    if (bestTime !== undefined && bestTime > 0) {
      acc.push(bestTime);
    }

    return acc;
  }, []);

  const timesToUse =
    classBestTimes.length > 0
      ? classBestTimes
      : allBestTimes.filter((time) => time > 0);

  const p1Time = timesToUse.length > 0 ? Math.min(...timesToUse) : null;
  const liveDelta = lapDelta?.personalBestTotal ?? null;

  const predictedLap =
    bestLap !== null && bestLap > 0 && liveDelta !== null
      ? bestLap + liveDelta
      : null;

  const bestDelta = liveDelta;

  const lastDelta =
    liveDelta !== null && bestLap !== null && lastLap !== null
      ? liveDelta + (bestLap - lastLap)
      : null;

  const p1Delta =
    liveDelta !== null && bestLap !== null && p1Time !== null
      ? liveDelta + (bestLap - p1Time)
      : null;

  return (
    <LapTimesList
      currentLapTime={formatLapTime(currentLap)}
      predictedLapTime={formatLapTime(predictedLap)}
      lastLapTime={formatLapTime(lastLap)}
      lastDelta={formatDelta(lastDelta)}
      lastDeltaColor={getDeltaColor(lastDelta)}
      bestLapTime={formatLapTime(bestLap)}
      bestDelta={formatDelta(bestDelta)}
      bestDeltaColor={getDeltaColor(bestDelta)}
      p1LapTime={formatLapTime(p1Time)}
      p1Delta={formatDelta(p1Delta)}
      p1DeltaColor={getDeltaColor(p1Delta)}
      settings={settings}
    />
  );
});
