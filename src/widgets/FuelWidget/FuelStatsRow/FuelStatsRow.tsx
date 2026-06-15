import { observer } from 'mobx-react-lite';

import { formatFuel } from '@utils/formatters/telemetry-format';
import {
  useBackendComputedStore,
  useUnitsStore,
} from '@store/root-store-context';
import { NO_FUEL_DATA_PLACEHOLDER } from '@utils/constants/data-placeholders';
import { computeFuelHistoryStats } from '../fuel-utils';
import { FuelStatsCell } from './FuelStatsCell/FuelStatsCell';
import styles from './FuelStatsRow.module.scss';

export const FuelStatsRow = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { unitSystem } = useUnitsStore();

  const history = fuel?.lapFuelHistory ?? [];

  const fmt = (val: number | null): string =>
    val !== null ? formatFuel(val, unitSystem) : NO_FUEL_DATA_PLACEHOLDER;

  const { last, avg10, min, max } = computeFuelHistoryStats(history);

  return (
    <div className={styles.statsRow}>
      <FuelStatsCell label="LAST" consumption={fmt(last)} />
      <FuelStatsCell label="AVG 10" consumption={fmt(avg10)} />
      <FuelStatsCell label="MIN" consumption={fmt(min)} />
      <FuelStatsCell label="MAX" consumption={fmt(max)} />
    </div>
  );
});
