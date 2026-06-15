import { observer } from 'mobx-react-lite';

import { formatFuel } from '@utils/formatters/telemetry-format';
import {
  useBackendComputedStore,
  useUnitsStore,
} from '@store/root-store-context';
import { NO_FUEL_DATA_PLACEHOLDER } from '@utils/constants/data-placeholders';
import { FuelStatsCell } from './FuelStatsCell/FuelStatsCell';
import styles from './FuelStatsRow.module.scss';

const HISTORY_WINDOW = 10;

export const FuelStatsRow = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { unitSystem } = useUnitsStore();

  const history = fuel?.lapFuelHistory ?? [];

  const fmt = (val: number | null): string =>
    val !== null ? formatFuel(val, unitSystem) : NO_FUEL_DATA_PLACEHOLDER;

  const last = history.length > 0 ? history[history.length - 1] : null;

  const window10 = history.slice(-HISTORY_WINDOW);
  const avg10 =
    window10.length > 0
      ? window10.reduce((sum, v) => sum + v, 0) / window10.length
      : null;

  const min = history.length > 0 ? Math.min(...history) : null;
  const max = history.length > 0 ? Math.max(...history) : null;

  return (
    <div className={styles.statsRow}>
      <FuelStatsCell label="LAST" consumption={fmt(last)} />
      <FuelStatsCell label="AVG 10" consumption={fmt(avg10)} />
      <FuelStatsCell label="MIN" consumption={fmt(min)} />
      <FuelStatsCell label="MAX" consumption={fmt(max)} />
    </div>
  );
});
