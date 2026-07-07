import { observer } from 'mobx-react-lite';
import { formatSpeed, speedUnit } from '@utils/formatters/telemetry-format';
import styles from './SpeedDisplay.module.scss';
import { usePlayerStore, useUnitsStore } from '@store/root-store-context';

export const SpeedDisplay = observer(() => {
  const telemetry = usePlayerStore();
  const units = useUnitsStore();

  const speed = telemetry.carDynamics?.speed ?? 0;
  const sys = units.unitSystem;

  return (
    <div className={styles.group}>
      <span className={styles.value}>{formatSpeed(speed, sys)}</span>
      <span className={styles.label}>{speedUnit(sys)}</span>
    </div>
  );
});
