import { observer } from 'mobx-react-lite';
import { Users } from 'lucide-react';

import { computeClassSof, formatIRating } from '@shared/lib/driver';
import { resolveSessionLaps } from '@shared/lib/telemetry-format';
import { buildLapProgress } from './session-bars-format';
import {
  isLapLimitedSession,
  resolveSessionColorKey,
  type SessionColorKey,
} from '@shared/lib/timer-utils';

import { StatChip, type StatChipTone } from '@shared/ui/StatChip/StatChip';
import { SessionClock } from './SessionClock';
import styles from './SessionHeader.module.scss';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useCarsStore } from '@entities/cars/cars-context';
import { useSessionStore } from '@entities/session/session-context';
import { usePlayerPositionStore } from '@entities/player/player-position-context';
import type {
  StatChipPresentation,
  LapCounter,
} from '@shared/contracts/widget-choices';
import { cx } from '@shared/lib/class-names';

// The session's own color, filled, with the type written near-black on it.
const SESSION_TYPE_TONE: Record<SessionColorKey, StatChipTone> = {
  practice: 'info',
  qualify: 'special',
  race: 'positive',
  other: 'muted',
};

interface SessionHeaderProps {
  chipStyle: StatChipPresentation;
  showSessionType: boolean;
  showTrackName: boolean;
  showTotalDrivers: boolean;
  showSof: boolean;
  abbreviateSof: boolean;
  lapCounter: LapCounter;
  showLapProgress: boolean;
  showSessionTime: boolean;
}

/**
 * The bar over the rows: the session and its field at the left, the track in
 * the middle, the laps and the clock at the right.
 */
export const SessionHeader = observer(
  ({
    chipStyle,
    showSessionType,
    showTrackName,
    showTotalDrivers,
    showSof,
    abbreviateSof,
    lapCounter,
    showLapProgress,
    showSessionTime,
  }: SessionHeaderProps) => {
    const { driverIdentities, leaderLap } = useBackendComputedStore();
    const playerPosition = usePlayerPositionStore();
    const { sessionInfo, session, currentSession } = useSessionStore();
    const { leaderBestLapTime } = useCarsStore();
    const overallSof = computeClassSof(driverIdentities);

    const trackName = sessionInfo?.trackDisplayName ?? '';

    const shownLap =
      lapCounter === 'session' ? leaderLap : playerPosition.playerLap;

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
    const lapProgress = showLapProgress
      ? buildLapProgress(shownLap, totalLaps, !isLapLimited)
      : null;

    // "12/~16": the laps run in the value's white, the total quieter behind it.
    const lapsSplit = lapProgress?.value.indexOf('/') ?? -1;
    const lapsDone =
      lapsSplit < 0
        ? lapProgress?.value
        : lapProgress?.value.slice(0, lapsSplit);
    const lapsTotal =
      lapsSplit < 0 ? null : (lapProgress?.value.slice(lapsSplit) ?? null);

    return (
      <div
        className={cx(styles.sessionHeader, !showTrackName && styles.compact)}
      >
        <div className={styles.sessionLeft}>
          {showSessionType && currentSession && (
            <StatChip
              presentation={chipStyle}
              lead={(
                currentSession.sessionTypeLabel ?? currentSession.sessionType
              ).toUpperCase()}
              look="state"
              size="md"
              tone={
                SESSION_TYPE_TONE[
                  resolveSessionColorKey(currentSession.sessionType)
                ]
              }
            />
          )}

          {showTotalDrivers && (
            <StatChip
              presentation={chipStyle}
              icon={Users}
              look="reading"
              tone="info"
            >
              {driverIdentities.length}
            </StatChip>
          )}

          {showSof && (
            <StatChip
              presentation={chipStyle}
              lead="SOF"
              look="reading"
              tone="accent"
            >
              {formatIRating(overallSof, abbreviateSof)}
            </StatChip>
          )}
        </div>

        {showTrackName && <div className={styles.trackName}>{trackName}</div>}

        <div className={styles.sessionRight}>
          {lapProgress && (
            <StatChip
              presentation={lapProgress.isFinalLap ? 'semantic' : chipStyle}
              lead="LAPS"
              look="reading"
              tone={lapProgress.isFinalLap ? 'accent' : 'positive'}
            >
              <span
                className={cx(
                  styles.lapsValue,
                  isLapLimited ? '' : styles.lapsMuted,
                  lapProgress.isFinalLap ? styles.lapsFinal : ''
                )}
                style={{ minWidth: `${lapProgress.widthChars}ch` }}
              >
                {lapsDone}
                {lapsTotal !== null && (
                  <span className={styles.lapsTotal}>{lapsTotal}</span>
                )}
              </span>
            </StatChip>
          )}

          {showSessionTime && <SessionClock chipStyle={chipStyle} />}
        </div>
      </div>
    );
  }
);
