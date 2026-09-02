import { observer } from 'mobx-react-lite';
import { Flag, Trophy, Users } from 'lucide-react';

import { formatIRating } from '@utils/driver';
import { resolveSessionLaps } from '@utils/telemetry-format';
import { computeClassSof } from '@utils/driver';
import {
  buildLapProgress,
  drawsClassHeaders,
} from '@ui/widgets/StandingsWidget/standings-utils';
import {
  isLapLimitedSession,
  resolveSessionColorKey,
  type SessionColorKey,
} from '@utils/timer-utils';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { SessionClock } from '@ui/widgets/StandingsWidget/SessionClock/SessionClock';
import styles from './SessionHeader.module.scss';
import {
  useBackendComputedStore,
  useCarsStore,
  useSessionStore,
  useStandingsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

// Matches the icon size the footer's stat pills use.
const STAT_ICON_SIZE_PX = 11;

const SESSION_TYPE_CLASS: Record<SessionColorKey, string> = {
  practice: styles.sessionTypePractice,
  qualify: styles.sessionTypeQualify,
  race: styles.sessionTypeRace,
  other: styles.sessionTypeOther,
};

export const SessionHeader = observer(() => {
  const { driverEntries: driverEntriesFrame } = useBackendComputedStore();
  const { sessionInfo, session } = useSessionStore();
  const { leaderBestLapTime } = useCarsStore();
  const standingsWidget = useStandingsWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  if (!settings.showSessionHeader) {
    return null;
  }

  const sessionInfoData = sessionInfo;
  const driverEntries = driverEntriesFrame?.entries ?? [];
  const overallSof = computeClassSof(driverEntries);

  // Per-class headers own the SOF in those view modes.
  const showSof =
    settings.showSOF &&
    !drawsClassHeaders(
      settings.viewMode,
      standingsWidget.allClassGroups.length
    );

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

  // A timed race has its remaining laps estimated from the leader's best lap —
  // shown as "~", and never allowed to announce a final lap.
  const isLapLimited = isLapLimitedSession(currentSession?.sessionLaps);
  const lapProgress = buildLapProgress(leaderLap, totalLaps, !isLapLimited);

  return (
    <div className={styles.sessionHeader}>
      <div className={styles.sessionLeft}>
        {trackName && <span className={styles.trackName}>{trackName}</span>}

        {trackName && currentSession && (
          <span className={styles.divider} aria-hidden="true" />
        )}

        {currentSession && (
          <span
            className={`${styles.sessionType} ${SESSION_TYPE_CLASS[resolveSessionColorKey(currentSession.sessionType)]}`}
          >
            {(
              currentSession.sessionTypeLabel ?? currentSession.sessionType
            ).toUpperCase()}
          </span>
        )}

        {settings.showTotalDrivers && (
          <>
            <span className={styles.divider} aria-hidden="true" />

            <span className={styles.stat}>
              <Users size={STAT_ICON_SIZE_PX} className={styles.statIcon} />
              <span className={styles.statValue}>{driverEntries.length}</span>
            </span>
          </>
        )}

        {showSof && (
          <>
            <span className={styles.divider} aria-hidden="true" />

            <span className={styles.stat}>
              <Trophy
                size={STAT_ICON_SIZE_PX}
                className={`${styles.statIcon} ${styles.statIconAccent}`}
              />

              <span className={styles.statValue}>
                {formatIRating(overallSof)}
              </span>
            </span>
          </>
        )}
      </div>

      <div className={styles.sessionRight}>
        {lapProgress && (
          <span
            className={`${styles.laps} ${isLapLimited ? styles.lapsLead : styles.lapsMuted} ${lapProgress.isFinalLap ? styles.lapsFinal : ''}`}
          >
            <Flag size={STAT_ICON_SIZE_PX} className={styles.statIcon} />

            <span
              className={styles.lapsValue}
              style={{ minWidth: `${lapProgress.widthChars}ch` }}
            >
              {lapProgress.value}
            </span>
          </span>
        )}

        {lapProgress && settings.showSessionTime && (
          <span className={styles.divider} aria-hidden="true" />
        )}

        <SessionClock />
      </div>
    </div>
  );
});
