import { observer } from 'mobx-react-lite';
import { Users } from 'lucide-react';

import {
  formatIRating,
  NEAR_DQ_INCIDENT_THRESHOLD,
} from '@utils/widget/widget-utils';
import { formatTemp, tempUnit } from '@utils/formatters/telemetry-format';
import {
  computeClassSof,
  parseWeekendTemp,
} from '@utils/widget/standings-utils';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import styles from './SessionHeader.module.scss';
import {
  useComputedStore,
  useTelemetryStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const SessionHeader = observer(() => {
  const computed = useComputedStore();
  const telemetry = useTelemetryStore();
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  if (!settings.showSessionHeader) {
    return null;
  }

  const sessionInfo = telemetry.sessionInfo?.SessionInfo;
  const weekendInfo = telemetry.weekendInfo;
  const driverEntries = computed.standings?.entries ?? [];
  const overallSof = computeClassSof(driverEntries);
  const playerIncidents =
    driverEntries.find((entry) => entry.isPlayer)?.incidents ?? 0;
  const playerPitStops = computed.pitStops?.playerStops ?? 0;

  const sessions = sessionInfo?.Sessions;
  const currentSession = sessions?.[sessionInfo?.CurrentSessionNum ?? 0];
  const trackName = weekendInfo?.TrackDisplayName ?? '';

  const leaderLap =
    driverEntries.length > 0
      ? Math.max(...driverEntries.map((entry) => entry.lap))
      : null;

  const env = telemetry.environment;
  const airCelsius =
    env?.air_temp ?? parseWeekendTemp(weekendInfo?.TrackAirTemp);
  const trkCelsius =
    env?.track_temp ?? parseWeekendTemp(weekendInfo?.TrackSurfaceTemp);

  const sys = units.system;
  const tUnit = tempUnit(sys);
  const airStr =
    airCelsius !== null ? `${formatTemp(airCelsius, sys)}${tUnit}` : null;
  const trkStr =
    trkCelsius !== null ? `${formatTemp(trkCelsius, sys)}${tUnit}` : null;

  return (
    <div className={styles.sessionHeader}>
      <div className={styles.sessionLeft}>
        {trackName && <span className={styles.trackName}>{trackName}</span>}

        {currentSession && (
          <span>{currentSession.SessionType?.toUpperCase()}</span>
        )}
      </div>

      <div className={styles.sessionRight}>
        {leaderLap !== null && (
          <span>
            LAP <span className={styles.lapValue}>{leaderLap}</span>
          </span>
        )}

        {settings.showTotalDrivers && (
          <span className={styles.sessionDriverCount}>
            <Users size={10} />
            <span className={styles.sessionDriverCountValue}>
              {driverEntries.length}
            </span>
          </span>
        )}

        {settings.showWeather && airStr && (
          <span>
            Air: <span className={styles.tempValue}>{airStr}</span>
          </span>
        )}

        {settings.showWeather && trkStr && (
          <span>
            Trk: <span className={styles.tempValue}>{trkStr}</span>
          </span>
        )}

        {settings.showSOF && (
          <span className={styles.sofValue}>
            SOF: {formatIRating(overallSof)}
          </span>
        )}

        {settings.showPitStops && (
          <span className={styles.pitStopsBadge}>
            PIT: <span className={styles.pitStopsValue}>{playerPitStops}</span>
          </span>
        )}

        {settings.showIncidentsBadge && (
          <span className={styles.incidentsBadge}>
            INC:{' '}
            <span
              className={
                playerIncidents >= NEAR_DQ_INCIDENT_THRESHOLD
                  ? styles.incidentsValueNearDQ
                  : styles.incidentsValue
              }
            >
              {playerIncidents}x
            </span>
          </span>
        )}
      </div>
    </div>
  );
});
