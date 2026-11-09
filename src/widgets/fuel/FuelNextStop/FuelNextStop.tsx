import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip } from '@shared/ui/StatChip/StatChip';
import { NO_TIME_DATA_PLACEHOLDER } from '@shared/lib/telemetry-format';
import { computeNextStopForecast, formatCountdown } from '../fuel-utils';
import styles from './FuelNextStop.module.scss';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { usePlayerStore } from '@entities/player/player-context';
import type { FuelWidgetSettings } from '../settings-schema';

const NO_LAP_PLACEHOLDER = '--';

/** The footer bar: the laps the next window spans and the time until it opens. */
export const FuelNextStop = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { lapTiming } = usePlayerStore();

  const settings = useWidgetSettings<FuelWidgetSettings>('fuel');

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

  // The countdown is the one reading here that is not derivable from the rest
  // of the widget — the laps to the window are just LAPS LEFT shifted by the
  // warning margin, so only the absolute lap range and the clock are shown.
  const hasCountdown = forecast.secondsUntil !== null;

  return (
    <div className={styles.nextStop}>
      <span className={styles.label}>NEXT PIT</span>

      <div className={styles.chips}>
        <StatChip lead="LAP" tone="positive" className={styles.chip}>
          {forecast.targetLap ?? NO_LAP_PLACEHOLDER}

          {forecast.windowEndLap !== null && (
            <span className={styles.lapRangeEnd}>–{forecast.windowEndLap}</span>
          )}
        </StatChip>

        <StatChip
          lead="EST"
          tone="accent"
          className={`${styles.chip} ${hasCountdown ? styles.countdown : styles.countdownEmpty}`}
        >
          <FixedDigits
            text={
              forecast.secondsUntil !== null
                ? formatCountdown(forecast.secondsUntil)
                : NO_TIME_DATA_PLACEHOLDER
            }
          />
        </StatChip>
      </div>
    </div>
  );
});
