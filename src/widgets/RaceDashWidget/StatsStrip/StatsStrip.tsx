import { observer } from 'mobx-react-lite';

import { resolveSessionLaps } from '@utils/formatters/telemetry-format';
import { RpmValue } from '../RpmValue/RpmValue';
import { SpeedReadout } from '../SpeedReadout/SpeedReadout';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import {
  useCarsStore,
  usePlayerStore,
  useSessionStore,
  useStandingsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './StatsStrip.module.scss';

interface StatsStripProps {
  expanded: boolean;
}

export const StatsStrip = observer(({ expanded }: StatsStripProps) => {
  const player = usePlayerStore();
  const { sessionInfo, session } = useSessionStore();
  const { leaderBestLapTime } = useCarsStore();
  const standingsWidget = useStandingsWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  const currentLap = player.lapTiming?.lap;
  const position = standingsWidget.playerPosition(settings.useLivePositions);

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

      <div
        className={
          expanded
            ? `${styles.divider} ${styles.dividerExpanded}`
            : styles.divider
        }
      />

      <div
        className={
          expanded ? `${styles.column} ${styles.columnExpanded}` : styles.column
        }
      >
        <div className={styles.row}>
          <span className={styles.label}>RPM</span>
          <RpmValue />
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Lap</span>
          <span className={styles.value}>{lapText}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Pos</span>
          <span className={styles.value}>
            {position != null ? `P${position}` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
});
