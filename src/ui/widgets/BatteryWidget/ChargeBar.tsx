import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@store/root-store-context';
import {
  FALLBACK_CHARGE_BAR_CELLS,
  chargeLevel,
  litChargeCells,
} from './battery-utils';
import { useChargeCellCount } from './useChargeCellCount';
import styles from './BatteryWidget.module.scss';

const CELL_CLASS = {
  full: styles.cellFull,
  low: styles.cellLow,
  critical: styles.cellCritical,
} as const;

/**
 * The charge as a row of cells, each one slanted along the direction of travel.
 * The eye counts cells where it would have to measure a bar, and the slant is
 * what keeps a row of them from reading as a barcode. How many there are is
 * measured from the bar itself, so the cells stay square at any widget width.
 */
export const ChargeBar = observer(() => {
  const { carStatus } = usePlayerStore();
  const { ref, count } = useChargeCellCount(FALLBACK_CHARGE_BAR_CELLS);

  const charge = carStatus?.energy_ers_battery_pct ?? 0;
  const clamped = Math.min(Math.max(charge, 0), 1);
  const lit = litChargeCells(clamped, count);
  const litClass = CELL_CLASS[chargeLevel(clamped)];

  return (
    <div className={styles.bar} ref={ref}>
      {Array.from({ length: count }, (_unused, at) => (
        <div
          className={`${styles.cell} ${at < lit ? litClass : styles.cellEmpty}`}
          key={at}
        />
      ))}
    </div>
  );
});
