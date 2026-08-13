import { observer } from 'mobx-react-lite';

import { formatFuel } from '@utils/telemetry-format';
import {
  useBackendComputedStore,
  usePlayerStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  NO_FUEL_DATA_PLACEHOLDER,
  NO_LAPS_REMAINING_DATA_PLACEHOLDER,
} from '@utils/telemetry-format';
import type { FuelWidgetSettings } from '@/types/widget-settings';
import {
  computeFuelHistoryStats,
  computeLapsToEmpty,
  getFuelStatLabel,
  getVisibleFuelStatKeys,
} from '../fuel-utils';
import { FuelStatsCell } from './FuelStatsCell/FuelStatsCell';
import styles from './FuelStatsRow.module.scss';

export const FuelStatsRow = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { carStatus } = usePlayerStore();
  const { unitSystem } = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<FuelWidgetSettings>('fuel');
  const visibleKeys = getVisibleFuelStatKeys(settings);

  if (visibleKeys.length === 0) {
    return null;
  }

  const history = fuel?.lapFuelHistory ?? [];
  const fuelLevel = carStatus?.fuel_level ?? null;

  const stats = computeFuelHistoryStats(history);

  const formatConsumption = (value: number | null): string =>
    value !== null ? formatFuel(value, unitSystem) : NO_FUEL_DATA_PLACEHOLDER;

  const formatLaps = (value: number | null): string => {
    const laps = computeLapsToEmpty(fuelLevel, value);

    return laps !== null ? laps.toFixed(1) : NO_LAPS_REMAINING_DATA_PLACEHOLDER;
  };

  return (
    <div
      className={styles.statsRow}
      style={{ gridTemplateColumns: `repeat(${visibleKeys.length}, 1fr)` }}
    >
      {visibleKeys.map((key) => (
        <FuelStatsCell
          key={key}
          label={getFuelStatLabel(key)}
          consumption={formatConsumption(stats[key])}
          laps={formatLaps(stats[key])}
        />
      ))}
    </div>
  );
});
