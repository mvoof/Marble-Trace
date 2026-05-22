import { observer } from 'mobx-react-lite';

import { formatSimDate } from '@utils/widget/timer-utils';

import styles from './SimDateItem.module.scss';
import type { TimerWidgetSettings } from '@/types/widget-settings';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const SimDateItem = observer(() => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { showSimDate } =
    widgetSettings.getSettings<TimerWidgetSettings>('timer');
  const rawSimDate =
    telemetry.sessionInfo?.WeekendInfo?.WeekendOptions?.Date ?? null;
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
