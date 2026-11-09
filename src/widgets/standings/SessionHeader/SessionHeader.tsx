import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';
import { Users } from 'lucide-react';

import { formatIRating } from '@shared/lib/driver';
import { resolveSessionLaps } from '@shared/lib/telemetry-format';
import { computeClassSof } from '@shared/lib/driver';
import {
  buildLapProgress,
  drawsClassHeaders,
} from '@widgets/standings/standings-utils';
import {
  isLapLimitedSession,
  resolveSessionColorKey,
  type SessionColorKey,
} from '@shared/lib/timer-utils';

import { StatChip, type StatChipTone } from '@shared/ui/StatChip/StatChip';
import { SessionClock } from '@widgets/standings/SessionClock/SessionClock';
import styles from './SessionHeader.module.scss';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useCarsStore } from '@entities/cars/cars-context';
import { useSessionStore } from '@entities/session/session-context';
import { usePlayerPositionStore } from '@entities/player/player-position-context';
import { useStandingsWidgetStore } from '@widgets/standings/standings.store';
import type { StandingsWidgetSettings } from '../settings-schema';

// The session's own color, filled, with the type written near-black on it.
const SESSION_TYPE_TONE: Record<SessionColorKey, StatChipTone> = {
  practice: 'info',
  qualify: 'special',
  race: 'positive',
  other: 'muted',
};

/**
 * The bar over the rows: the session and its field at the left, the track in
 * the middle, the laps and the clock at the right.
 */
export const SessionHeader = observer(() => {
  const { driverIdentities, leaderLap } = useBackendComputedStore();
  const playerPosition = usePlayerPositionStore();
  const { sessionInfo, session } = useSessionStore();
  const { leaderBestLapTime } = useCarsStore();
  const standingsWidget = useStandingsWidgetStore();

  const settings = useWidgetSettings<StandingsWidgetSettings>('standings');

  if (!settings.showSessionHeader) {
    return null;
  }

  const overallSof = computeClassSof(driverIdentities);

  // Per-class headers own the SOF in those view modes.
  const showSof =
    settings.showSOF &&
    !drawsClassHeaders(
      settings.viewMode,
      standingsWidget.allClassGroups.length
    );

  const sessions = sessionInfo?.sessions;
  const currentSession = sessions?.[sessionInfo?.currentSessionNum ?? 0];
  const trackName = sessionInfo?.trackDisplayName ?? '';

  const shownLap =
    settings.lapCounter === 'session' ? leaderLap : playerPosition.playerLap;

  const totalLaps = currentSession?.sessionLaps
    ? resolveSessionLaps(
        currentSession.sessionLaps,
        session?.session_time_remain ?? null,
        shownLap,
        leaderBestLapTime
      )
    : null;

  // A timed race has its remaining laps estimated from the leader's best lap —
  // shown as "~", and never allowed to announce a final lap.
  const isLapLimited = isLapLimitedSession(
    currentSession?.sessionLaps,
    currentSession?.sessionType
  );
  const lapProgress = settings.showLapProgress
    ? buildLapProgress(shownLap, totalLaps, !isLapLimited)
    : null;

  // "12/~16": the laps run in the value's white, the total quieter behind it.
  const lapsSplit = lapProgress?.value.indexOf('/') ?? -1;
  const lapsDone =
    lapsSplit < 0 ? lapProgress?.value : lapProgress?.value.slice(0, lapsSplit);
  const lapsTotal =
    lapsSplit < 0 ? null : (lapProgress?.value.slice(lapsSplit) ?? null);

  return (
    <div className={styles.sessionHeader}>
      <div className={styles.sessionLeft}>
        {currentSession && (
          <StatChip
            lead={(
              currentSession.sessionTypeLabel ?? currentSession.sessionType
            ).toUpperCase()}
            leadVariant="solid"
            size="md"
            tone={
              SESSION_TYPE_TONE[
                resolveSessionColorKey(currentSession.sessionType)
              ]
            }
          />
        )}

        {settings.showTotalDrivers && (
          <StatChip icon={Users} leadVariant="solid" tone="info" emphasized>
            {driverIdentities.length}
          </StatChip>
        )}

        {showSof && (
          <StatChip lead="SOF" leadVariant="solid" tone="accent" emphasized>
            {formatIRating(overallSof, settings.abbreviateSof)}
          </StatChip>
        )}
      </div>

      <div className={styles.trackName}>{trackName}</div>

      <div className={styles.sessionRight}>
        {lapProgress && (
          <StatChip
            lead="LAPS"
            leadVariant="solid"
            tone={lapProgress.isFinalLap ? 'accent' : 'positive'}
            emphasized
          >
            <span
              className={[
                styles.lapsValue,
                isLapLimited ? '' : styles.lapsMuted,
                lapProgress.isFinalLap ? styles.lapsFinal : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ minWidth: `${lapProgress.widthChars}ch` }}
            >
              {lapsDone}
              {lapsTotal !== null && (
                <span className={styles.lapsTotal}>{lapsTotal}</span>
              )}
            </span>
          </StatChip>
        )}

        <SessionClock />
      </div>
    </div>
  );
});
