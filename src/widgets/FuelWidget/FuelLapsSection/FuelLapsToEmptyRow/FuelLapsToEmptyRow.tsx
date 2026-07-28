import { observer } from 'mobx-react-lite';

import {
  useBackendComputedStore,
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { FuelWidgetSettings } from '@/types/widget-settings';
import {
  computeFuelHistoryStats,
  getVisibleFuelStatKeys,
} from '../../fuel-utils';
import styles from './FuelLapsToEmptyRow.module.scss';

const NO_LAPS = '—';

const computeLaps = (fuelLevel: number, consumptionPerLap: number): string => {
  if (consumptionPerLap <= 0) {
    return NO_LAPS;
  }

  return (fuelLevel / consumptionPerLap).toFixed(1);
};

export const FuelLapsToEmptyRow = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { carStatus } = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<FuelWidgetSettings>('fuel');
  const visibleKeys = getVisibleFuelStatKeys(settings);

  if (visibleKeys.length === 0) {
    return null;
  }

  const history = fuel?.lapFuelHistory ?? [];
  const fuelLevel = carStatus?.fuel_level ?? 0;
  const stats = computeFuelHistoryStats(history);

  const laps = (val: number | null): string =>
    val !== null && fuelLevel > 0 ? computeLaps(fuelLevel, val) : NO_LAPS;

  return (
    <div
      className={styles.grid}
      style={{ gridTemplateColumns: `repeat(${visibleKeys.length}, 1fr)` }}
    >
      <span className={styles.label}>LAPS TO EMPTY</span>

      {visibleKeys.map((key) => (
        <span key={key} className={styles.cell}>
          {laps(stats[key])}
        </span>
      ))}
    </div>
  );
});
