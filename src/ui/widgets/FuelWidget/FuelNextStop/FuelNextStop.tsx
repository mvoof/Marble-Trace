import { observer } from 'mobx-react-lite';

import { WidgetLabel } from '@ui/shared/WidgetLabel/WidgetLabel';
import { NO_TIME_DATA_PLACEHOLDER } from '@utils/telemetry-format';
import type { FuelWidgetSettings } from '@/types/widget-settings';
import { computeNextStopForecast, formatCountdown } from '../fuel-utils';
import styles from './FuelNextStop.module.scss';
import {
  useBackendComputedStore,
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const NO_LAP_PLACEHOLDER = '--';

export const FuelNextStop = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { lapTiming } = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<FuelWidgetSettings>('fuel');

  if (!settings.showNextStopForecast) {
    return null;
  }

  const bestLap = lapTiming?.lap_best_lap_time ?? null;
  const lastLap = lapTiming?.lap_last_lap_time ?? null;
  const lapTimeSec = bestLap !== null && bestLap > 0 ? bestLap : lastLap;

  const forecast = computeNextStopForecast({
    lapsRemaining: fuel?.lapsRemaining ?? null,
    pitWindowStart: fuel?.pitWindowStart ?? null,
    pitWindowEnd: fuel?.pitWindowEnd ?? null,
    pitWarningLaps: settings.pitWarningLaps,
    lapTimeSec,
  });

  if (forecast === null) {
    return null;
  }

  const lapText =
    forecast.targetLap !== null
      ? `LAP ${forecast.targetLap}`
      : `LAP ${NO_LAP_PLACEHOLDER}`;

  // The countdown is the one reading here that is not derivable from the rest
  // of the widget — the laps to the window are just LAPS LEFT shifted by the
  // warning margin, so only the absolute lap range and the clock are shown.
  const countdownText =
    forecast.secondsUntil !== null
      ? formatCountdown(forecast.secondsUntil)
      : NO_TIME_DATA_PLACEHOLDER;

  const countdownClass =
    forecast.secondsUntil !== null ? styles.countdown : styles.countdownEmpty;

  return (
    <div className={styles.nextStop}>
      <WidgetLabel className={styles.label}>NEXT PIT WINDOW</WidgetLabel>

      <span className={styles.window}>
        {lapText}

        {forecast.windowEndLap !== null && (
          <span className={styles.lapRangeEnd}>–{forecast.windowEndLap}</span>
        )}

        <span className={styles.separator}>·</span>

        <span className={countdownClass}>{countdownText}</span>
      </span>
    </div>
  );
});
