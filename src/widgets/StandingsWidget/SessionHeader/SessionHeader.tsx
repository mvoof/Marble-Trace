import { observer } from 'mobx-react-lite';
import {
  Trophy,
  Users,
  TriangleAlert,
  Wrench,
  Thermometer,
} from 'lucide-react';

import {
  formatIRating,
  NEAR_DQ_INCIDENT_THRESHOLD,
  getAirTempColor,
  getTrackTempColor,
} from '@utils/widget/widget-utils';
import {
  formatTemp,
  tempUnit,
  resolveSessionLaps,
} from '@utils/formatters/telemetry-format';
import {
  computeClassSof,
  parseWeekendTemp,
} from '@utils/widget/standings-utils';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import styles from './SessionHeader.module.scss';
import {
  useBackendComputedStore,
  useTelemetryStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const SessionHeader = observer(() => {
  const { standings, pitStops } = useBackendComputedStore();
  const telemetry = useTelemetryStore();

  const { sessionInfo, weekendInfo, environment } = telemetry;

  const { unitSystem } = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  if (!settings.showSessionHeader) {
    return null;
  }

  const sessionInfoData = sessionInfo?.SessionInfo;
  const driverEntries = standings?.entries ?? [];
  const overallSof = computeClassSof(driverEntries);

  const playerIncidents =
    driverEntries.find((entry) => entry.isPlayer)?.incidents ?? 0;

  const playerPitStops = pitStops?.playerStops ?? 0;
  const sessions = sessionInfoData?.Sessions;
  const currentSession = sessions?.[sessionInfoData?.CurrentSessionNum ?? 0];
  const trackName = weekendInfo?.TrackDisplayName ?? '';

  const leaderLap =
    driverEntries.length > 0
      ? Math.max(...driverEntries.map((entry) => entry.lap))
      : null;

  const totalLaps = currentSession?.SessionLaps
    ? resolveSessionLaps(
        currentSession.SessionLaps,
        telemetry.session?.session_time_remain ?? null,
        leaderLap,
        telemetry.leaderBestLapTime
      )
    : null;

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
    <div className={styles.sessionHeader}>
      <div className={styles.sessionLeft}>
        {trackName && <span className={styles.trackName}>{trackName}</span>}

        {currentSession && (
          <span className={styles.sessionType}>
            {currentSession.SessionType?.toUpperCase()}
          </span>
        )}

        {leaderLap !== null && (
          <span className={styles.sessionLaps}>
            {totalLaps && totalLaps.toLowerCase() !== 'unlimited'
              ? `LAP: ${leaderLap}/${totalLaps}`
              : `LAP: ${leaderLap}`}
          </span>
        )}
      </div>

      <div className={styles.sessionRight}>
        {settings.showSOF && (
          <span className={styles.statPill}>
            <Trophy size={10} color="#eab308" />
            <span className={styles.statLabel}>SOF</span>
            <span className={styles.statValue}>
              {formatIRating(overallSof)}
            </span>
          </span>
        )}

        {settings.showTotalDrivers && (
          <span className={styles.statPill}>
            <Users size={10} color="#9ca3af" />
            <span className={styles.statValue}>{driverEntries.length}</span>
          </span>
        )}

        {settings.showIncidentsBadge && (
          <span
            className={`${styles.statPill} ${
              playerIncidents >= NEAR_DQ_INCIDENT_THRESHOLD
                ? styles.pulseWarning
                : ''
            }`}
          >
            <TriangleAlert
              size={10}
              color={
                playerIncidents >= NEAR_DQ_INCIDENT_THRESHOLD
                  ? '#ef4444'
                  : '#f59e0b'
              }
            />
            <span className={styles.statLabel}>INC</span>
            <span
              className={
                playerIncidents >= NEAR_DQ_INCIDENT_THRESHOLD
                  ? styles.valueDanger
                  : styles.statValue
              }
            >
              {playerIncidents}x
            </span>
          </span>
        )}

        {settings.showPitStops && (
          <span className={styles.statPill}>
            <Wrench size={10} color="#9ca3af" />
            <span className={styles.statLabel}>PIT</span>
            <span className={styles.statValue}>{playerPitStops}</span>
          </span>
        )}

        {settings.showWeather && airCelsius !== null && airStr && (
          <span className={styles.statPill}>
            <Thermometer size={10} color={getAirTempColor(airCelsius)} />
            <span className={styles.statLabel}>AIR</span>
            <span className={styles.statValue}>{airStr}</span>
          </span>
        )}

        {settings.showWeather && trkCelsius !== null && trkStr && (
          <span className={styles.statPill}>
            <Thermometer size={10} color={getTrackTempColor(trkCelsius)} />
            <span className={styles.statLabel}>TRK</span>
            <span className={styles.statValue}>{trkStr}</span>
          </span>
        )}
      </div>
    </div>
  );
});
