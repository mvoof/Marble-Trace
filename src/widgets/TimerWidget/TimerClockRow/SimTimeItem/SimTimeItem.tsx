import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { formatSimTime } from '@utils/widget/timer-utils';

import styles from './SimTimeItem.module.scss';

export const SimTimeItem = observer(() => {
  const { showSimTime } = widgetSettingsStore.getTimerSettings();
  const rawSimTime = telemetryStore.session?.session_time_of_day ?? null;
  const simTime = rawSimTime !== null ? formatSimTime(rawSimTime) : null;

  if (!showSimTime || simTime === null) {
    return null;
  }

  return (
    <span className={styles.clockItem}>
      <span className={styles.clockLabel}>SIM</span>
      {simTime}
    </span>
  );
});
