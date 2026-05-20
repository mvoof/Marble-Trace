import { observer } from 'mobx-react-lite';
import { Users } from 'lucide-react';

import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { computedStore } from '../../../../store/iracing/computed.store';
import { unitsStore } from '../../../../store/units.store';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import { formatIRating, NEAR_DQ_INCIDENT_THRESHOLD } from '../../widget-utils';
import { formatTemp, tempUnit } from '../../../../utils/telemetry-format';
import { computeClassSof } from '../standings-utils';

import styles from './SessionHeader.module.scss';

const parseWeekendTemp = (
  tempStr: string | null | undefined
): number | null => {
  if (tempStr == null) {
    return null;
  }

  const num = parseFloat(tempStr);

  return isNaN(num) ? null : num;
};

export const SessionHeader = observer(() => {
  const settings = widgetSettingsStore.getStandingsSettings();
  const sessionInfo = telemetryStore.sessionInfo?.SessionInfo;
  const weekendInfo = telemetryStore.weekendInfo;
  const driverEntries = computedStore.standings?.entries ?? [];
  const overallSof = computeClassSof(driverEntries);
  const playerIncidents =
    driverEntries.find((entry) => entry.isPlayer)?.incidents ?? 0;
  const playerPitStops = computedStore.pitStops?.playerStops ?? 0;

  const sessions = sessionInfo?.Sessions;
  const currentSession = sessions?.[sessionInfo?.CurrentSessionNum ?? 0];
  const trackName = weekendInfo?.TrackDisplayName ?? '';

  const leaderLap =
    driverEntries.length > 0
      ? Math.max(...driverEntries.map((entry) => entry.lap))
      : null;

  const env = telemetryStore.environment;
  const airCelsius =
    env?.air_temp ?? parseWeekendTemp(weekendInfo?.TrackAirTemp);
  const trkCelsius =
    env?.track_temp ?? parseWeekendTemp(weekendInfo?.TrackSurfaceTemp);

  const sys = unitsStore.system;
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
