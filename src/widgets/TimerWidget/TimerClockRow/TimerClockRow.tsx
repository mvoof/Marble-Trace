import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { formatSimTime } from '@utils/widget/timer-utils';
import { useWallClock } from '@hooks/widget/useWallClock';

import styles from './TimerClockRow.module.scss';

export const TimerClockRow = observer(() => {
  const wallClock = useWallClock();
  const { showWallClock, showSimTime } = widgetSettingsStore.getTimerSettings();
  const rawSimTime = telemetryStore.session?.session_time_of_day ?? null;
  const simTime = rawSimTime !== null ? formatSimTime(rawSimTime) : null;

  return (
    <div className={styles.clockRow}>
      {showWallClock && (
        <span className={styles.clockItem}>
          <span className={styles.clockLabel}>PC</span>
          {wallClock.time}
        </span>
      )}

      {showSimTime && simTime !== null && (
        <span className={styles.clockItem}>
          <span className={styles.clockLabel}>SIM</span>
          {simTime}
        </span>
      )}
    </div>
  );
});
