import { observer } from 'mobx-react-lite';

import { WidgetLabel } from '@ui/shared/WidgetLabel/WidgetLabel';
import { NO_TIME_DATA_PLACEHOLDER } from '@utils/telemetry-format';
import type { FuelWidgetSettings } from '@/types/widget-settings';
import { computeNextStopForecast, formatCountdown } from '../fuel-utils';
import { ReservedSlot } from '@ui/shared/ReservedSlot/ReservedSlot';
import styles from './FuelNextStop.module.scss';
import {
  useBackendComputedStore,
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const NO_LAP_PLACEHOLDER = '--';

/**
 * Caption over one reading, inside `sp(sm)` of padding top and bottom — the
 * shape `.nextStop` and its two children add up to at design scale.
 */
const NEXT_STOP_HEIGHT_PX = 52;

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

  // No forecast yet means no laps run yet, not a block the driver switched
  // off — it arrives mid-stint and would push everything under it down. The
  // room stays reserved so the widget keeps the height it was placed at.
  if (forecast === null) {
    return (
      <ReservedSlot height={NEXT_STOP_HEIGHT_PX} label="Next pit window" />
    );
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
