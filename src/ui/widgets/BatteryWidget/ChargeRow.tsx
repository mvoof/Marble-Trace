import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@store/root-store-context';
import { FixedDigits } from '@ui/widgets/TimerWidget/FixedDigits/FixedDigits';
import { formatChargePct } from './battery-utils';
import styles from './BatteryWidget.module.scss';

/** The state of charge as a number. The bar below it is a separate cell. */
export const ChargeRow = observer(() => {
  const { carStatus } = usePlayerStore();

  const charge = carStatus?.energy_ers_battery_pct ?? null;

  return (
    <div className={styles.chargeRow}>
      <div className={styles.label}>BAT</div>
      <div className={styles.spacer} />
      <div className={styles.chargeValue}>
        <FixedDigits text={formatChargePct(charge)} />
        <span className={styles.chargeUnit}>%</span>
      </div>
    </div>
  );
});
