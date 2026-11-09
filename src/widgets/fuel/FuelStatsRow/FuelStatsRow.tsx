import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { formatFuel, EMPTY_VALUE } from '@shared/lib/telemetry-format';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { usePlayerStore } from '@entities/player/player-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import {
  computeLapsToEmpty,
  EMPTY_FUEL_HISTORY_STATS,
  type FuelStatKey,
  getFuelStatLabel,
  getVisibleFuelStatKeys,
} from '../fuel-utils';
import {
  FuelStatsCell,
  type FuelStatTone,
} from './FuelStatsCell/FuelStatsCell';
import styles from './FuelStatsRow.module.scss';
import type { FuelHistoryStats } from '@shared/contracts/generated/bindings';
import type { FuelWidgetSettings } from '../settings-schema';

/**
 * LAST against the history's own average — the same split the chart's bars
 * are colored by — and the best lap always in the good color.
 */
const resolveStatTone = (
  key: FuelStatKey,
  stats: FuelHistoryStats
): FuelStatTone => {
  if (key === 'min' && stats.min !== null) {
    return 'positive';
  }

  if (key !== 'last' || stats.last === null || stats.avg === null) {
    return 'neutral';
  }

  return stats.last > stats.avg ? 'danger' : 'positive';
};

export const FuelStatsRow = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { carStatus } = usePlayerStore();
  const { unitSystem } = useUnitsStore();

  const settings = useWidgetSettings<FuelWidgetSettings>('fuel');
  const visibleKeys = getVisibleFuelStatKeys(settings);

  if (visibleKeys.length === 0) {
    return null;
  }

  const fuelLevel = carStatus?.fuel_level ?? null;

  // Computed in `mt-computations/src/strategy/fuel.rs` alongside the average it is read
  // against, so the same history is not walked a second time here on every
  // frame — and so a remote screen gets the figures instead of recomputing
  // them per device.
  const stats = fuel?.historyStats ?? EMPTY_FUEL_HISTORY_STATS;

  const formatConsumption = (value: number | null): string =>
    value !== null ? formatFuel(value, unitSystem) : EMPTY_VALUE;

  const formatLaps = (value: number | null): string => {
    const laps = computeLapsToEmpty(fuelLevel, value);

    return laps !== null ? laps.toFixed(1) : EMPTY_VALUE;
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
          tone={resolveStatTone(key, stats)}
        />
      ))}
    </div>
  );
});
