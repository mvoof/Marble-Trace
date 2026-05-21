import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { formatPosition } from '@utils/widget/timer-utils';

import styles from './PositionItem.module.scss';

export const PositionItem = observer(() => {
  const { showPosition } = widgetSettingsStore.getTimerSettings();

  if (!showPosition) {
    return null;
  }

  const lap = telemetryStore.lapTiming;
  const driverInfo = telemetryStore.driverInfo;

  const position = lap?.player_car_position ?? null;
  const totalDrivers = driverInfo?.Drivers?.length ?? null;

  return (
    <span className={styles.footerItem}>
      {formatPosition(position, totalDrivers)}
    </span>
  );
});
