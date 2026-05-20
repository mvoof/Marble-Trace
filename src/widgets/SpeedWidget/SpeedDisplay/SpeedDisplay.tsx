import { observer } from 'mobx-react-lite';
import { telemetryStore } from '@store/iracing/telemetry.store';
import { unitsStore } from '@store/units.store';
import { formatSpeed, speedUnit } from '@utils/formatters/telemetry-format';
import styles from './SpeedDisplay.module.scss';

export const SpeedDisplay = observer(() => {
  const speed = telemetryStore.carDynamics?.speed ?? 0;
  const sys = unitsStore.system;

  return (
    <div className={styles.group}>
      <span className={styles.value}>{formatSpeed(speed, sys)}</span>
      <span className={styles.label}>{speedUnit(sys)}</span>
    </div>
  );
});
