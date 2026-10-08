import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { positionBandColor } from '../race-dash-utils';
import { resolveSessionLaps } from '@shared/lib/telemetry-format';
import { RpmValue } from '../RpmValue/RpmValue';
import { SpeedReadout } from '../SpeedReadout/SpeedReadout';
import type { RaceDashWidgetSettings } from '@shared/contracts/widget-settings';
import { useCarsStore } from '@entities/cars/cars-context';
import { usePlayerStore } from '@entities/player/player-context';
import { useSessionStore } from '@entities/session/session-context';
import { usePlayerPositionStore } from '@entities/player/player-position-context';

import styles from './StatsStrip.module.scss';

export const StatsStrip = observer(() => {
  const player = usePlayerStore();
  const { sessionInfo, session } = useSessionStore();
  const { leaderBestLapTime } = useCarsStore();
  const playerPosition = usePlayerPositionStore();

  const settings = useWidgetSettings<RaceDashWidgetSettings>('race-dash');

  const currentLap = player.lapTiming?.lap;
  const { position } = playerPosition.playerPositionInfo(
    settings.useLivePositions,
    settings.classPositionInMulticlass
  );
  const positionColor = positionBandColor(position ?? null, settings);

  const sessions = sessionInfo?.sessions;
  const currentSession = sessions?.[sessionInfo?.currentSessionNum ?? 0];
  const totalLapsStr = currentSession?.sessionLaps
    ? resolveSessionLaps(
        currentSession.sessionLaps,
        session?.session_time_remain ?? null,
        currentLap ?? null,
        leaderBestLapTime
      )
    : null;
  const isUnlimited =
    !totalLapsStr || totalLapsStr.toLowerCase() === 'unlimited';

  const lapText =
    currentLap != null
      ? isUnlimited
        ? `${currentLap}`
        : `${currentLap}/${totalLapsStr}`
      : '—';

  return (
    <div className={styles.root}>
      <SpeedReadout />

      <div className={`${styles.divider} ${styles.dividerOne}`} />

      <span className={`${styles.caption} ${styles.captionRpm}`}>RPM</span>

      <div className={styles.valueRpm}>
        <RpmValue />
      </div>

      <div className={`${styles.divider} ${styles.dividerTwo}`} />

      <div className={styles.column}>
        <div className={styles.row}>
          <span className={styles.label}>Pos</span>
          <span
            className={styles.value}
            style={positionColor ? { color: positionColor } : undefined}
          >
            {position ?? '—'}
          </span>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Lap</span>
          <span className={styles.value}>{lapText}</span>
        </div>
      </div>
    </div>
  );
});
