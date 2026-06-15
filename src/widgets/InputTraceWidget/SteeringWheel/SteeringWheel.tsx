import { observer } from 'mobx-react-lite';
import {
  usePlayerStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { InputTraceSettings } from '@/types/widget-settings';
import Logo from '@assets/logo.svg?react';
import styles from './SteeringWheel.module.scss';

const WheelCenter = observer(() => {
  const telemetry = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();
  const units = useUnitsStore();

  const settings =
    widgetSettings.getSettings<InputTraceSettings>('input-trace');
  const rawAngle = telemetry.carDynamics?.steering_wheel_angle ?? 0;
  const angleDegrees = Math.round(rawAngle * (180 / Math.PI));
  const gear = telemetry.carDynamics?.gear ?? 0;
  const speed = telemetry.carDynamics?.speed ?? 0;
  const gearLabel = gear === 0 ? 'N' : gear === -1 ? 'R' : String(gear);

  switch (settings.steeringCenterDisplay) {
    case 'gear':
      return <span className={styles.centerText}>{gearLabel}</span>;

    case 'speed':
      return (
        <span className={styles.centerText}>
          {Math.round(speed * units.speedFactor)}
        </span>
      );

    case 'angle':
      return (
        <span className={`${styles.centerText} ${styles.centerAngle}`}>
          <span className={styles.centerNum}>{angleDegrees}</span>
          <span className={styles.centerUnit}>°</span>
        </span>
      );

    case 'speed-gear':
      return (
        <div className={styles.speedGear}>
          <span className={styles.speedGearSpeed}>
            {Math.round(speed * units.speedFactor)}
          </span>
          <div className={styles.speedGearDivider} />
          <span className={styles.speedGearGear}>{gearLabel}</span>
        </div>
      );

    default:
      return (
        <div className={styles.logoWrapper}>
          <Logo className={styles.logo} />
        </div>
      );
  }
});

export const SteeringWheel = observer(() => {
  const telemetry = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<InputTraceSettings>('input-trace');

  if (!settings.showSteering) {
    return null;
  }

  const rawAngle = telemetry.carDynamics?.steering_wheel_angle ?? 0;

  return (
    <div className={styles.container}>
      <div className={styles.dial}>
        <div className={styles.groove} />

        <div
          className={styles.rotator}
          style={{ transform: `rotate(${-rawAngle}rad)` }}
        >
          <div className={styles.indicatorMarker} />
        </div>

        <div className={styles.centerPad}>
          <WheelCenter />
        </div>
      </div>
    </div>
  );
});
