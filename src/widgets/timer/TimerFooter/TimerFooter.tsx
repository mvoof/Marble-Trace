import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { resolveSessionLaps } from '@shared/lib/telemetry-format';
import {
  formatLapCount,
  formatPosition,
  isSessionEnded,
} from '@shared/lib/timer-utils';
import { useCarsStore } from '@entities/cars/cars-context';
import { useSessionStore } from '@entities/session/session-context';
import { usePlayerPositionStore } from '@entities/player/player-position-context';
import type { TimerWidgetSettings } from '@shared/contracts/widget-settings';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import styles from './TimerFooter.module.scss';

export const TimerFooter = observer(() => {
  const { session, sessionInfo } = useSessionStore();
  const { carIdx, leaderBestLapTime } = useCarsStore();
  const playerPosition = usePlayerPositionStore();

  const {
    showLaps,
    showPosition,
    useLivePositions,
    classPositionInMulticlass,
  } = useWidgetSettings<TimerWidgetSettings>('timer');

  if (!showLaps && !showPosition) {
    return null;
  }

  if (isSessionEnded(session?.session_state ?? null)) {
    return null;
  }

  const sessions = sessionInfo?.sessions ?? [];

  const sessionNum = session?.session_num ?? null;
  const currentSession =
    sessionNum !== null ? (sessions[sessionNum] ?? null) : null;
  const remain = session?.session_time_remain ?? null;
  const playerCarIdx = sessionInfo?.playerCarIdx ?? null;
  const currentLap =
    playerCarIdx !== null ? (carIdx?.car_idx_lap[playerCarIdx] ?? null) : null;
  const totalLaps =
    sessionNum !== null
      ? resolveSessionLaps(
          currentSession?.sessionLaps,
          remain,
          currentLap,
          leaderBestLapTime
        )
      : null;

  const { position, total: totalDrivers } = playerPosition.playerPositionInfo(
    useLivePositions,
    classPositionInMulticlass
  );

  return (
    <div className={styles.footer}>
      {showLaps && (
        <FixedDigits
          className={styles.footerItem}
          text={formatLapCount(currentLap, totalLaps)}
        />
      )}

      {showPosition && (
        <FixedDigits
          className={styles.footerItem}
          text={formatPosition(position, totalDrivers)}
        />
      )}
    </div>
  );
});
