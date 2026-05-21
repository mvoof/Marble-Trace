import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { formatSimDate } from '@utils/widget/timer-utils';

import styles from './SimDateItem.module.scss';

export const SimDateItem = observer(() => {
  const { showSimDate } = widgetSettingsStore.getTimerSettings();
  const rawSimDate =
    telemetryStore.sessionInfo?.WeekendInfo?.WeekendOptions?.Date ?? null;
  const simDate = rawSimDate !== null ? formatSimDate(rawSimDate) : null;

  if (!showSimDate || simDate === null) {
    return null;
  }

  return (
    <span className={styles.clockItem}>
      <span className={styles.clockLabel}>SIM</span>
      {simDate}
    </span>
  );
});
