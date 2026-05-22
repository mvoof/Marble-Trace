import { observer } from 'mobx-react-lite';

import { formatPosition } from '@utils/widget/timer-utils';

import styles from './PositionItem.module.scss';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const PositionItem = observer(() => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { showPosition } = widgetSettings.getTimerSettings();

  if (!showPosition) {
    return null;
  }

  const lap = telemetry.lapTiming;
  const driverInfo = telemetry.driverInfo;

  const position = lap?.player_car_position ?? null;
  const totalDrivers = driverInfo?.Drivers?.length ?? null;

  return (
    <span className={styles.footerItem}>
      {formatPosition(position, totalDrivers)}
    </span>
  );
});
