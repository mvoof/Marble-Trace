import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { positionBandColor } from '../race-dash-utils';
import { resolveSessionLaps } from '@utils/telemetry-format';
import { RpmValue } from '../RpmValue/RpmValue';
import { SpeedReadout } from '../SpeedReadout/SpeedReadout';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import {
  useCarsStore,
  usePlayerStore,
  useSessionStore,
  useStandingsWidgetStore,
} from '@store/root-store-context';

import styles from './StatsStrip.module.scss';

export const StatsStrip = observer(() => {
  const player = usePlayerStore();
  const { sessionInfo, session } = useSessionStore();
  const { leaderBestLapTime } = useCarsStore();
  const standingsWidget = useStandingsWidgetStore();

  const settings = useWidgetSettings<RaceDashWidgetSettings>('race-dash');

  const currentLap = player.lapTiming?.lap;
  const { position } = standingsWidget.playerPositionInfo(
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
