import { observer } from 'mobx-react-lite';

import { formatSimTime } from '@utils/widget/timer-utils';

import styles from './SimTimeItem.module.scss';
import type { TimerWidgetSettings } from '@/types/widget-settings';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const SimTimeItem = observer(() => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { showSimTime } =
    widgetSettings.getSettings<TimerWidgetSettings>('timer');
  const rawSimTime = telemetry.session?.session_time_of_day ?? null;
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
