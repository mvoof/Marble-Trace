import { observer } from 'mobx-react-lite';
import { Wrench, Thermometer, Droplet, CloudRain } from 'lucide-react';

import { formatTemp, tempUnit } from '@utils/formatters/telemetry-format';
import { parseWeekendTemp } from '@utils/widget/standings-utils';
import { getAirTempColor, getTrackTempColor } from '@utils/widget/widget-utils';
import { getTrackWetnessInfo } from '@utils/widget/weather-utils';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import styles from './SessionFooter.module.scss';
import {
  useBackendComputedStore,
  useEnvironmentStore,
  useSessionStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const SessionFooter = observer(() => {
  const { pitStops } = useBackendComputedStore();
  const { sessionInfo } = useSessionStore();
  const { environment } = useEnvironmentStore();
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
    environment?.air_temp ?? parseWeekendTemp(sessionInfo?.trackAirTemp);

  const trkCelsius =
    environment?.track_temp ?? parseWeekendTemp(sessionInfo?.trackSurfaceTemp);

  const tUnit = tempUnit(unitSystem);

  const airStr =
    airCelsius !== null
      ? `${formatTemp(airCelsius, unitSystem)}${tUnit}`
      : null;

  const trkStr =
    trkCelsius !== null
      ? `${formatTemp(trkCelsius, unitSystem)}${tUnit}`
      : null;

  const wetnessInfo = getTrackWetnessInfo(environment?.track_wetness);

  return (
    <div className={styles.sessionFooter}>
      <div className={styles.footerLeft}>
        {showPitStops && (
          <span className={styles.statPill}>
            <Wrench
              size={11}
              color="currentColor"
              className={styles.iconMuted}
            />

            <span className={styles.statLabel}>PIT</span>

            <span className={styles.statValue}>{playerPitStops}</span>
          </span>
        )}
      </div>

      <div className={styles.footerRight}>
        {showWeather && airCelsius !== null && airStr && (
          <span className={styles.statPill}>
            <Thermometer
              size={11}
              color={getAirTempColor(airCelsius)}
              className={styles.iconColored}
            />

            <span className={styles.statLabel}>AIR</span>

            <span className={styles.statValue}>{airStr}</span>
          </span>
        )}

        {showWeather && trkCelsius !== null && trkStr && (
          <span className={styles.statPill}>
            <Thermometer
              size={11}
              color={getTrackTempColor(trkCelsius)}
              className={styles.iconColored}
            />

            <span className={styles.statLabel}>TRK</span>

            <span className={styles.statValue}>{trkStr}</span>
          </span>
        )}

        {showWeather && wetnessInfo && (
          <span className={styles.statPill}>
            {wetnessInfo.isWet ? (
              <CloudRain
                size={11}
                color={wetnessInfo.color}
                className={styles.iconColored}
              />
            ) : (
              <Droplet
                size={11}
                color={wetnessInfo.color}
                className={styles.iconColored}
              />
            )}

            <span className={styles.statLabel}>TRACK</span>

            <span className={styles.statValue}>{wetnessInfo.label}</span>
          </span>
        )}
      </div>
    </div>
  );
});
