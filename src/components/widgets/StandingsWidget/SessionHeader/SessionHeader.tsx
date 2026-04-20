import { observer } from 'mobx-react-lite';
import { Users } from 'lucide-react';
import { formatIRating } from '../../widget-utils';
import { unitsStore } from '../../../../store/units.store';
import type { DriverEntry } from '../types';
import type { widgetSettingsStore } from '../../../../store/widget-settings.store';
import type { SessionInfoData, WeekendInfo } from '../../../../types/bindings';

import styles from './SessionHeader.module.scss';

interface SessionHeaderProps {
  settings: ReturnType<typeof widgetSettingsStore.getStandingsSettings>;
  sessionInfo: SessionInfoData | null | undefined;
  weekendInfo: WeekendInfo | null | undefined;
  driverEntries: DriverEntry[];
  overallSof: number;
}

const parseIRacingTemp = (
  tempStr: string | null | undefined
): number | null => {
  if (!tempStr) return null;
  const match = tempStr.match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
};

export const SessionHeader = observer(
  ({
    settings,
    sessionInfo,
    weekendInfo,
    driverEntries,
    overallSof,
  }: SessionHeaderProps) => {
    const sessions = sessionInfo?.Sessions;
    const currentSession = sessions?.[sessionInfo?.CurrentSessionNum ?? 0];
    const trackName = weekendInfo?.TrackDisplayName ?? '';

    const airCelsius = parseIRacingTemp(weekendInfo?.TrackAirTemp);
    const trkCelsius = parseIRacingTemp(weekendInfo?.TrackSurfaceTemp);
    const tempUnit = unitsStore.tempUnit;
    const airStr =
      airCelsius !== null
        ? `${unitsStore.formatTemp(airCelsius)}${tempUnit}`
        : null;
    const trkStr =
      trkCelsius !== null
        ? `${unitsStore.formatTemp(trkCelsius)}${tempUnit}`
        : null;

    return (
      <div className={styles.sessionHeader}>
        <div className={styles.sessionLeft}>
          {trackName && <span className={styles.trackName}>{trackName}</span>}

          {currentSession && (
            <span>{currentSession.SessionType?.toUpperCase()}</span>
          )}

          {currentSession?.SessionLaps && (
            <span>Laps: {currentSession.SessionLaps}</span>
          )}
        </div>

        <div className={styles.sessionRight}>
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
        </div>
      </div>
    );
  }
);
