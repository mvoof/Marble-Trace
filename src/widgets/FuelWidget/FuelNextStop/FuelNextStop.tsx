import { observer } from 'mobx-react-lite';

import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';
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

  return (
    <div className={styles.nextStop}>
      <div className={styles.headerRow}>
        <WidgetLabel className={styles.label}>NEXT PIT WINDOW</WidgetLabel>
        <WidgetValue className={styles.lap} value={lapText} />
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailCell}>
          <WidgetLabel className={styles.detailLabel}>IN LAPS</WidgetLabel>
          <WidgetValue
            className={styles.detailValue}
            value={forecast.lapsUntil.toFixed(1)}
          />
        </div>

        {forecast.secondsUntil !== null && (
          <div className={styles.detailCell}>
            <WidgetLabel className={styles.detailLabel}>IN TIME</WidgetLabel>
            <WidgetValue
              className={styles.detailValue}
              value={formatCountdown(forecast.secondsUntil)}
            />
          </div>
        )}
      </div>
    </div>
  );
});
