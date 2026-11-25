import { observer } from 'mobx-react-lite';
import { Gauge, Repeat, Users } from 'lucide-react';

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
import type { SessionBarSettings } from '@entities/session/session-bar-settings';
import { cx } from '@shared/lib/class-names';

// The session's own color, filled, with the type written near-black on it.
const SESSION_TYPE_TONE: Record<SessionColorKey, StatChipTone> = {
  practice: 'info',
  qualify: 'special',
  race: 'positive',
  other: 'muted',
};

interface SessionHeaderProps {
  settings: SessionBarSettings;
  showTrackName?: boolean;
  hasClassHeaders?: boolean;
}

/**
 * The bar over the rows: the session and its field at the left, the track in
 * the middle, the laps and the clock at the right.
 */
export const SessionHeader = observer(
  ({
    settings,
    showTrackName = false,
    hasClassHeaders = false,
  }: SessionHeaderProps) => {
    const {
      headerChipStyle: chipStyle,
      headerChipLabelMode,
      showSessionType,
      showTotalDrivers,
      abbreviateSof,
      lapCounter,
      showLapProgress,
      showSessionTime,
    } = settings;
    const useIcons = headerChipLabelMode === 'icon';
    const showSof = settings.showSOF && !hasClassHeaders;
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

    const hasTrackName = showTrackName && trackName.length > 0;

    if (
      !(showSessionType && currentSession) &&
      !showTotalDrivers &&
      !showSof &&
      !hasTrackName &&
      !lapProgress &&
      !showSessionTime
    ) {
      return null;
    }

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
        className={cx(styles.sessionHeader, !hasTrackName && styles.compact)}
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
              lead="DRIVERS"
              labelIcon={useIcons ? Users : undefined}
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
              labelIcon={useIcons ? Gauge : undefined}
              look="reading"
              tone="accent"
            >
              {formatIRating(overallSof, abbreviateSof)}
            </StatChip>
          )}
        </div>

        {hasTrackName && <div className={styles.trackName}>{trackName}</div>}

        <div className={styles.sessionRight}>
          {lapProgress && (
            <StatChip
              presentation={lapProgress.isFinalLap ? 'semantic' : chipStyle}
              lead="LAPS"
              labelIcon={useIcons ? Repeat : undefined}
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

          {showSessionTime && (
            <SessionClock chipStyle={chipStyle} useIcon={useIcons} />
          )}
        </div>
      </div>
    );
  }
);
