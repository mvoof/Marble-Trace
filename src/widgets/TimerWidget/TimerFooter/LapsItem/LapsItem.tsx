import { observer } from 'mobx-react-lite';

import { resolveSessionLaps } from '@utils/formatters/telemetry-format';
import { formatLapCount } from '@utils/widget/timer-utils';

import styles from './LapsItem.module.scss';
import type { TimerWidgetSettings } from '@/types/widget-settings';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const LapsItem = observer(() => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { showLaps } = widgetSettings.getSettings<TimerWidgetSettings>('timer');

  if (!showLaps) {
    return null;
  }

  const session = telemetry.session;
  const sessions = telemetry.sessionInfo?.SessionInfo?.Sessions ?? [];
  const driverInfo = telemetry.driverInfo;
  const carIdx = telemetry.carIdx;

  const sessionNum = session?.session_num ?? null;
  const currentSession =
    sessionNum !== null ? (sessions[sessionNum] ?? null) : null;
  const remain = session?.session_time_remain ?? null;

  const playerCarIdx = driverInfo?.DriverCarIdx ?? null;
  const currentLap =
    playerCarIdx !== null ? (carIdx?.car_idx_lap[playerCarIdx] ?? null) : null;

  const totalLaps =
    sessionNum !== null
      ? resolveSessionLaps(
          currentSession?.SessionLaps,
          remain,
          currentLap,
          telemetry.leaderBestLapTime
        )
      : null;

  return (
    <span className={styles.footerItem}>
      {formatLapCount(currentLap, totalLaps)}
    </span>
  );
});
