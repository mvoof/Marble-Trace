import { observer } from 'mobx-react-lite';
import { Wrench, Thermometer } from 'lucide-react';

import { formatTemp, tempUnit } from '@utils/formatters/telemetry-format';
import { parseWeekendTemp } from '@utils/widget/standings-utils';
import { getAirTempColor, getTrackTempColor } from '@utils/widget/widget-utils';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import styles from './SessionFooter.module.scss';
import {
  useBackendComputedStore,
  useTelemetryStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const SessionFooter = observer(() => {
  const { pitStops } = useBackendComputedStore();
  const telemetry = useTelemetryStore();
  const { weekendInfo, environment } = telemetry;
  const { unitSystem } = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  const showWeather = settings.showWeather;
  const showPitStops = settings.showPitStops;

  if (!showWeather && !showPitStops) {
    return null;
  }

  const playerPitStops = pitStops?.playerStops ?? 0;

  const airCelsius =
    environment?.air_temp ?? parseWeekendTemp(weekendInfo?.TrackAirTemp);

  const trkCelsius =
    environment?.track_temp ?? parseWeekendTemp(weekendInfo?.TrackSurfaceTemp);

  const tUnit = tempUnit(unitSystem);

  const airStr =
    airCelsius !== null
      ? `${formatTemp(airCelsius, unitSystem)}${tUnit}`
      : null;

  const trkStr =
    trkCelsius !== null
      ? `${formatTemp(trkCelsius, unitSystem)}${tUnit}`
      : null;

  return (
    <div className={styles.sessionFooter}>
      <div className={styles.footerLeft}>
        {showPitStops && (
          <span className={styles.statPill}>
            <Wrench size={11} color="#9ca3af" />

            <span className={styles.statLabel}>PIT</span>

            <span className={styles.statValue}>{playerPitStops}</span>
          </span>
        )}
      </div>

      <div className={styles.footerRight}>
        {showWeather && airCelsius !== null && airStr && (
          <span className={styles.statPill}>
            <Thermometer size={11} color={getAirTempColor(airCelsius)} />

            <span className={styles.statLabel}>AIR</span>

            <span className={styles.statValue}>{airStr}</span>
          </span>
        )}

        {showWeather && trkCelsius !== null && trkStr && (
          <span className={styles.statPill}>
            <Thermometer size={11} color={getTrackTempColor(trkCelsius)} />

            <span className={styles.statLabel}>TRK</span>

            <span className={styles.statValue}>{trkStr}</span>
          </span>
        )}
      </div>
    </div>
  );
});
