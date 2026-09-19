import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@store/root-store-context';
import {
  CHARGE_CRITICAL_PCT,
  CHARGE_LOW_PCT,
  chargeBarMarks,
} from './battery-utils';
import styles from './BatteryWidget.module.scss';

const fillClass = (charge: number): string => {
  if (charge < CHARGE_CRITICAL_PCT) {
    return styles.barFillCritical;
  }

  if (charge < CHARGE_LOW_PCT) {
    return styles.barFillLow;
  }

  return styles.barFillFull;
};

const MARKS = chargeBarMarks();

/**
 * The charge as a length, divided into tenths. Read by shape rather than by
 * digit, which is what a driver actually does with it mid-corner — the marks
 * turn "most of the way along" into "seven tenths" without printing a number.
 *
 * The marks sit above the fill rather than under it, so the divisions stay
 * legible whatever the charge, and they are centred with the track open above
 * and below them so they read as scoring on the bar and not as a fence across
 * it.
 */
export const ChargeBar = observer(() => {
  const { carStatus } = usePlayerStore();

  const charge = carStatus?.energy_ers_battery_pct ?? 0;
  const clamped = Math.min(Math.max(charge, 0), 1);

  return (
    <div className={styles.bar}>
      <div
        className={`${styles.barFill} ${fillClass(clamped)}`}
        style={{ width: `${clamped * 100}%` }}
      />

      {MARKS.map((at) => (
        <div
          className={styles.barMark}
          key={at}
          style={{ left: `${at * 100}%` }}
        />
      ))}
    </div>
  );
});
