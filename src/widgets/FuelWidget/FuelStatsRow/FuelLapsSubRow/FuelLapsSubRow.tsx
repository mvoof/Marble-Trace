import { observer } from 'mobx-react-lite';

import {
  useBackendComputedStore,
  usePlayerStore,
} from '@store/root-store-context';
import styles from './FuelLapsSubRow.module.scss';

const HISTORY_WINDOW = 10;
const NO_LAPS = '—';

const computeLaps = (fuelLevel: number, consumptionPerLap: number): string => {
  if (consumptionPerLap <= 0) {
    return NO_LAPS;
  }

  return (fuelLevel / consumptionPerLap).toFixed(1);
};

export const FuelLapsSubRow = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { carStatus } = usePlayerStore();

  const history = fuel?.lapFuelHistory ?? [];
  const fuelLevel = carStatus?.fuel_level ?? 0;

  const laps = (val: number | null): string =>
    val !== null && fuelLevel > 0 ? computeLaps(fuelLevel, val) : NO_LAPS;

  const last = history.length > 0 ? history[history.length - 1] : null;

  const window10 = history.slice(-HISTORY_WINDOW);
  const avg10 =
    window10.length > 0
      ? window10.reduce((sum, v) => sum + v, 0) / window10.length
      : null;

  const min = history.length > 0 ? Math.min(...history) : null;
  const max = history.length > 0 ? Math.max(...history) : null;

  const values = [laps(last), laps(avg10), laps(min), laps(max)];

  return (
    <div className={styles.wrapper}>
      <span className={styles.sectionLabel}>LAPS TO EMPTY</span>

      <div className={styles.subRow}>
        {values.map((val, index) => (
          <span key={index} className={styles.cell}>
            {val}
          </span>
        ))}
      </div>
    </div>
  );
});
