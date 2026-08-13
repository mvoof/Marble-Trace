import { observer } from 'mobx-react-lite';
import { Trophy, Users, TriangleAlert } from 'lucide-react';

import { formatIRating, isNearIncidentLimit } from '@utils/widget/widget-utils';
import { resolveSessionLaps } from '@utils/formatters/telemetry-format';
import { computeClassSof } from '@utils/widget/standings-utils';
import {
  resolveSessionColorKey,
  type SessionColorKey,
} from '@utils/widget/timer-utils';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { SessionClock } from '@widgets/StandingsWidget/SessionClock/SessionClock';
import { StatPill } from '@/components/shared/StatPill/StatPill';
import styles from './SessionHeader.module.scss';
import {
  useBackendComputedStore,
  useCarsStore,
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const SESSION_TYPE_CLASS: Record<SessionColorKey, string> = {
  practice: styles.sessionTypePractice,
  qualify: styles.sessionTypeQualify,
  race: styles.sessionTypeRace,
  other: styles.sessionTypeOther,
};

export const SessionHeader = observer(() => {
  const { standings } = useBackendComputedStore();
  const { sessionInfo, session } = useSessionStore();
  const { leaderBestLapTime } = useCarsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  if (!settings.showSessionHeader) {
    return null;
  }

  const sessionInfoData = sessionInfo;
  const driverEntries = standings?.entries ?? [];
  const overallSof = computeClassSof(driverEntries);

  const playerIncidents =
    driverEntries.find((entry) => entry.isPlayer)?.incidents ?? 0;

  // Null in practice and most hosted sessions, where incidents are uncapped.
  const incidentLimit = sessionInfo?.incidentLimit ?? null;
  const isNearLimit = isNearIncidentLimit(playerIncidents, incidentLimit);

  const sessions = sessionInfoData?.sessions;
  const currentSession = sessions?.[sessionInfoData?.currentSessionNum ?? 0];
  const trackName = sessionInfo?.trackDisplayName ?? '';

  const leaderLap =
    driverEntries.length > 0
      ? Math.max(...driverEntries.map((entry) => entry.lap))
      : null;

  const totalLaps = currentSession?.sessionLaps
    ? resolveSessionLaps(
        currentSession.sessionLaps,
        session?.session_time_remain ?? null,
        leaderLap,
        leaderBestLapTime
      )
    : null;

  return (
    <div className={styles.sessionHeader}>
      <div className={styles.sessionLeft}>
        {trackName && <span className={styles.trackName}>{trackName}</span>}

        {currentSession && (
          <span
            className={`${styles.sessionType} ${SESSION_TYPE_CLASS[resolveSessionColorKey(currentSession.sessionType)]}`}
          >
            {(
              currentSession.sessionTypeLabel ?? currentSession.sessionType
            ).toUpperCase()}
          </span>
        )}

        {leaderLap !== null && (
          <span className={styles.sessionLaps}>
            {totalLaps && totalLaps.toLowerCase() !== 'unlimited'
              ? `LAP: ${leaderLap}/${totalLaps}`
              : `LAP: ${leaderLap}`}
          </span>
        )}

        <SessionClock />
      </div>

      <div className={styles.sessionRight}>
        {settings.showSOF && (
          <StatPill icon={Trophy} iconTone="accent" label="SOF">
            {formatIRating(overallSof)}
          </StatPill>
        )}

        {settings.showTotalDrivers && (
          <StatPill icon={Users}>{driverEntries.length}</StatPill>
        )}

        {settings.showIncidentsBadge && (
          <StatPill
            icon={TriangleAlert}
            iconTone={isNearLimit ? 'danger' : 'warning'}
            label="INC"
            valueDanger={isNearLimit}
            pulse={isNearLimit}
          >
            {incidentLimit === null
              ? `${playerIncidents}x`
              : `${playerIncidents}/${incidentLimit}x`}
          </StatPill>
        )}
      </div>
    </div>
  );
});
