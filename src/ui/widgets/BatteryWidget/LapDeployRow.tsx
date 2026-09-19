import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@store/root-store-context';
import { FixedDigits } from '@ui/widgets/TimerWidget/FixedDigits/FixedDigits';
import { formatLapDeployMj } from './battery-utils';
import styles from './BatteryWidget.module.scss';

/** How much has gone from the battery to the MGU-K on this lap. */
export const LapDeployRow = observer(() => {
  const { carStatus } = usePlayerStore();

  const joules = carStatus?.energy_battery_to_mgu_k_lap ?? null;

  return (
    <div className={styles.lapDeployRow}>
      <div className={styles.label}>LAP</div>
      <div className={styles.spacer} />
      <div className={styles.lapDeployValue}>
        <FixedDigits text={formatLapDeployMj(joules)} />
        <span className={styles.powerUnit}> MJ</span>
      </div>
    </div>
  );
});
