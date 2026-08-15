import { observer } from 'mobx-react-lite';

import type { InvisibleDashWidgetSettings } from '@/types/widget-settings';
import { resolveSessionLaps } from '@utils/telemetry-format';
import {
  useCarsStore,
  usePlayerStore,
  useSessionStore,
  useStandingsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import type { BackdropStyle } from '../invisible-dash-utils';

import styles from './RaceCluster.module.scss';

const EMPTY_VALUE = '—';

interface RaceClusterProps {
  /** Absent when the wash is painted on the whole strip instead. */
  backdrop?: BackdropStyle;
}

export const RaceCluster = observer(({ backdrop }: RaceClusterProps) => {
  const player = usePlayerStore();
  const { sessionInfo, session } = useSessionStore();
  const { leaderBestLapTime } = useCarsStore();
  const standingsWidget = useStandingsWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<InvisibleDashWidgetSettings>('invisible-dash');

  if (!settings.showPosition && !settings.showLap) {
    return null;
  }

  const { position, total } = standingsWidget.playerPositionInfo(
    settings.useLivePositions,
    settings.classPositionInMulticlass
  );

  const currentLap = player.lapTiming?.lap;
  const currentSession =
    sessionInfo?.sessions?.[sessionInfo?.currentSessionNum ?? 0];
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

  return (
    <div className={styles.root} style={backdrop}>
      {settings.showPosition && (
        <div className={styles.row}>
          <span className={styles.caption}>Pos</span>
          <span className={styles.value}>
            {position != null ? `P${position}` : EMPTY_VALUE}
          </span>
          {total != null && <span className={styles.den}>/{total}</span>}
        </div>
      )}

      {settings.showLap && (
        <div className={styles.row}>
          <span className={styles.caption}>Lap</span>
          <span className={styles.value}>{currentLap ?? EMPTY_VALUE}</span>
          {!isUnlimited && <span className={styles.den}>/{totalLapsStr}</span>}
        </div>
      )}
    </div>
  );
});
