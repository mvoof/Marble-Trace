import { observer } from 'mobx-react-lite';
import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import styles from './RpmPanel.module.scss';

export const RpmPanel = observer(() => {
  const rpm = Math.round(telemetryStore.carDynamics?.rpm ?? 0);

  return (
    <div className={styles.rpmGroup}>
      <span className={styles.rpmValue}>{rpm}</span>
      <span className={styles.rpmLabel}>RPM</span>
    </div>
  );
});
