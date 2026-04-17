import { Users } from 'lucide-react';
import { formatIRating } from '../../widget-utils';
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

export const SessionHeader = ({
  settings,
  sessionInfo,
  weekendInfo,
  driverEntries,
  overallSof,
}: SessionHeaderProps) => {
  const sessions = sessionInfo?.Sessions;
  const currentSession = sessions?.[sessionInfo?.CurrentSessionNum ?? 0];
  const trackName = weekendInfo?.TrackDisplayName ?? '';

  return (
    <div className={styles.sessionHeader}>
      <div className={styles.sessionLeft}>
        {trackName && <span>{trackName}</span>}

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

        {settings.showWeather && weekendInfo?.TrackAirTemp && (
          <span>Air: {weekendInfo.TrackAirTemp}</span>
        )}

        {settings.showWeather && weekendInfo?.TrackSurfaceTemp && (
          <span>Trk: {weekendInfo.TrackSurfaceTemp}</span>
        )}

        {settings.showSOF && (
          <span className={styles.sofValue}>
            SOF: {formatIRating(overallSof)}
          </span>
        )}
      </div>
    </div>
  );
};
