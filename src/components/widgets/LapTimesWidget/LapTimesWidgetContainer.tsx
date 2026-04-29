import { observer } from 'mobx-react-lite';

import { telemetryStore, computedStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useAutoSizeWidget } from '../../../hooks/useAutoSizeWidget';
import { formatLapTime } from '../../../utils/telemetry-format';
import { LapTimesWidget } from './LapTimesWidget';

const formatDelta = (delta: number | null): string => {
  if (delta === null) return '—';
  if (Math.abs(delta) < 0.001) return '—';
  return (delta >= 0 ? '+' : '') + delta.toFixed(3);
};

const getDeltaColor = (delta: number | null): string | undefined => {
  if (delta === null) return undefined;
  if (delta < -0.001) return '#22c55e'; // Green
  if (delta > 0.001) return '#ef4444'; // Red
  return '#fbbf24'; // Amber
};

export const LapTimesWidgetContainer = observer(() => {
  const lap = telemetryStore.lapTiming;
  const carIdxData = telemetryStore.carIdx;
  const standings = computedStore.standings?.entries ?? [];
  const lapDelta = computedStore.lapDelta;
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

  // Live delta to player's best lap
  const liveDelta = lapDelta?.personalBestTotal ?? null;

  // Deltas vs current (projected) lap
  // Δ = T_current - T_target
  // T_current = T_best + liveDelta
  // Δ_target = (T_best + liveDelta) - T_target = liveDelta + (T_best - T_target)

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
    <LapTimesWidget
      ref={widgetRef}
      currentLapTime={formatLapTime(currentLap)}
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
