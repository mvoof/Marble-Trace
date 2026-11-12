import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip } from '@shared/ui/StatChip/StatChip';
import { EMPTY_VALUE } from '@shared/lib/telemetry-format';
import { computeNextStopForecast, formatCountdown } from '../fuel-utils';
import styles from './FuelNextStop.module.scss';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { usePlayerStore } from '@entities/player/player-context';
import type { FuelWidgetSettings } from '../settings-schema';

/** The footer bar: the laps the next window spans and the time until it opens. */
export const FuelNextStop = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { lapTiming } = usePlayerStore();
  const { appSettings } = useAppSettingsStore();

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
    pitWarningLaps: appSettings.fuelPitWarningLaps,
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
        <StatChip
          lead="LAP"
          look="reading"
          tone="positive"
          className={styles.chip}
        >
          {forecast.targetLap ?? EMPTY_VALUE}

          {forecast.windowEndLap !== null && (
            <span className={styles.lapRangeEnd}>–{forecast.windowEndLap}</span>
          )}
        </StatChip>

        <StatChip
          lead="EST"
          look="reading"
          tone="accent"
          className={`${styles.chip} ${hasCountdown ? styles.countdown : styles.countdownEmpty}`}
        >
          <FixedDigits
            text={
              forecast.secondsUntil !== null
                ? formatCountdown(forecast.secondsUntil)
                : EMPTY_VALUE
            }
          />
        </StatChip>
      </div>
    </div>
  );
});
