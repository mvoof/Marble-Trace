import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { formatSimDate } from '../../../utils/widget/timer-utils';
import { useWallClock } from '../../../hooks/widget/useWallClock';

import styles from './TimerDateRow.module.scss';

export const TimerDateRow = observer(() => {
  const wallClock = useWallClock();
  const { showPcDate, showSimDate } = widgetSettingsStore.getTimerSettings();
  const rawSimDate =
    telemetryStore.sessionInfo?.WeekendInfo?.WeekendOptions?.Date ?? null;
  const simDate = rawSimDate !== null ? formatSimDate(rawSimDate) : null;

  return (
    <div className={styles.clockRow}>
      {showPcDate && (
        <span className={styles.clockItem}>
          <span className={styles.clockLabel}>DATE</span>
          {wallClock.date}
        </span>
      )}

      {showSimDate && simDate !== null && (
        <span className={styles.clockItem}>
          <span className={styles.clockLabel}>SIM</span>
          {simDate}
        </span>
      )}
    </div>
  );
});
