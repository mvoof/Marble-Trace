import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { formatLapTime } from '../../../utils/telemetry-format';
import { LapTimesWidget } from './LapTimesWidget';

export const LapTimesWidgetContainer = observer(() => {
  const lap = telemetryStore.lapTiming;

  const currentLapTime = formatLapTime(lap?.lap_current_lap_time ?? null);
  const lastLapTime = formatLapTime(lap?.lap_last_lap_time ?? null);
  const bestLapTime = formatLapTime(lap?.lap_best_lap_time ?? null);
  const hasBestLap = (lap?.lap_best_lap_time ?? 0) > 0;

  return (
    <LapTimesWidget
      currentLapTime={currentLapTime}
      lastLapTime={lastLapTime}
      bestLapTime={bestLapTime}
      hasBestLap={hasBestLap}
    />
  );
});
