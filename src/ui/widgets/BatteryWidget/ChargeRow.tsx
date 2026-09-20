import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@store/root-store-context';
import { FixedDigits } from '@ui/widgets/TimerWidget/FixedDigits/FixedDigits';
import { ChargeBar } from './ChargeBar';
import { chargeLevel, formatChargePct } from './battery-utils';
import styles from './BatteryWidget.module.scss';

const DIVIDER_CLASS = {
  full: styles.chargeDividerFull,
  low: styles.chargeDividerLow,
  critical: styles.chargeDividerCritical,
} as const;

/**
 * The charge readout: the label sits over the bar it names, and the percentage
 * stands beside the pair, against the full height of both — the number is the
 * thing read from a distance, the bar the thing glanced at.
 */
export const ChargeRow = observer(() => {
  const { carStatus } = usePlayerStore();

  const charge = carStatus?.energy_ers_battery_pct ?? null;
  const level = chargeLevel(Math.min(Math.max(charge ?? 0, 0), 1));

  return (
    <div className={styles.chargeRow}>
      <div className={styles.chargeMeter}>
        <div className={styles.label}>BAT</div>
        <ChargeBar />
      </div>

      <div className={`${styles.chargeDivider} ${DIVIDER_CLASS[level]}`} />

      <div className={styles.chargeValue}>
        <FixedDigits text={formatChargePct(charge)} />
        <span className={styles.chargeUnit}>%</span>
      </div>
    </div>
  );
});
