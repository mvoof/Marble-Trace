import { observer } from 'mobx-react-lite';

import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';
import { formatFuel } from '@utils/formatters/telemetry-format';
import type { FuelWidgetSettings } from '@/types/widget-settings';
import {
  computeNextStopForecast,
  formatCountdown,
  type FuelLapsStatus,
  resolveLapsStatus,
} from '../fuel-utils';
import styles from './FuelNextStop.module.scss';
import {
  useBackendComputedStore,
  usePlayerStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const NO_LAP_PLACEHOLDER = '--';

const LAPS_STATUS_CLASSES: Record<FuelLapsStatus, string> = {
  safe: styles.valueSafe,
  warning: styles.valueWarning,
  danger: styles.valueDanger,
};

export const FuelNextStop = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { lapTiming } = usePlayerStore();
  const { unitSystem } = useUnitsStore();
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

  // Before the window opens there is often nothing to add yet — an empty cell
  // would only take space from the two counters that do have an answer.
  const fuelToAdd = fuel?.fuelToAddWithBuffer ?? null;
  const hasFuelToAdd = fuelToAdd !== null && fuelToAdd > 0;

  const lapsStatus = resolveLapsStatus(
    fuel?.lapsRemaining ?? null,
    settings.pitWarningLaps
  );

  const lapsClass = lapsStatus !== null ? LAPS_STATUS_CLASSES[lapsStatus] : '';

  return (
    <div className={styles.nextStop}>
      <div className={styles.headerRow}>
        <WidgetLabel className={styles.label}>NEXT PIT WINDOW</WidgetLabel>

        <span className={styles.lap}>
          {lapText}

          {forecast.windowEndLap !== null && (
            <span className={styles.lapRangeEnd}>–{forecast.windowEndLap}</span>
          )}
        </span>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailCell}>
          <WidgetValue
            className={`${styles.detailValue} ${lapsClass}`}
            value={forecast.lapsUntil.toFixed(1)}
          />

          <WidgetLabel className={styles.detailLabel}>IN LAPS</WidgetLabel>
        </div>

        {forecast.secondsUntil !== null && (
          <div className={styles.detailCell}>
            <WidgetValue
              className={styles.detailValue}
              value={formatCountdown(forecast.secondsUntil)}
            />

            <WidgetLabel className={styles.detailLabel}>IN TIME</WidgetLabel>
          </div>
        )}

        {hasFuelToAdd && (
          <div className={styles.detailCell}>
            <WidgetValue
              className={styles.detailValue}
              value={formatFuel(fuelToAdd, unitSystem)}
            />

            <WidgetLabel className={styles.detailLabel}>ADD</WidgetLabel>
          </div>
        )}
      </div>
    </div>
  );
});
