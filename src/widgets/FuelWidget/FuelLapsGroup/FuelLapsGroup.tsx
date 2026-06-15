import { observer } from 'mobx-react-lite';

import { FUEL_THRESHOLDS } from '@utils/constants/fuel-constants';
import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';
import type { FuelWidgetSettings } from '@/types/widget-settings';
import styles from './FuelLapsGroup.module.scss';
import {
  useBackendComputedStore,
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { NO_LAPS_REMAINING_DATA_PLACEHOLDER } from '@utils/constants/data-placeholders';

const HISTORY_WINDOW = 10;
const NO_LAPS = '—';

const computeLaps = (fuelLevel: number, consumptionPerLap: number): string => {
  if (consumptionPerLap <= 0) {
    return NO_LAPS;
  }

  return (fuelLevel / consumptionPerLap).toFixed(1);
};

export const FuelLapsGroup = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { carStatus } = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<FuelWidgetSettings>('fuel');

  const lapsRemaining = fuel?.lapsRemaining ?? null;
  const shortage = fuel?.shortage ?? null;
  const history = fuel?.lapFuelHistory ?? [];
  const fuelLevel = carStatus?.fuel_level ?? 0;

  const statusClass = (): string => {
    if (lapsRemaining !== null && lapsRemaining <= settings.pitWarningLaps) {
      return styles.danger;
    }

    if (shortage !== null && shortage >= 0) {
      return styles.safe;
    }

    return styles.warning;
  };

  const lapsValueClass = (): string => {
    if (lapsRemaining === null) {
      return '';
    }

    if (
      lapsRemaining >
      settings.pitWarningLaps + FUEL_THRESHOLDS.LAPS_LEFT_GREEN_BUFFER
    ) {
      return styles.valueSafe;
    }

    if (lapsRemaining <= settings.pitWarningLaps) {
      return styles.valueDanger;
    }

    return styles.valueWarning;
  };

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

  const lapsValues = [laps(last), laps(avg10), laps(min), laps(max)];

  return (
    <div className={`${styles.group} ${statusClass()}`}>
      <span className={styles.sectionLabel}>LAPS TO EMPTY</span>

      <div className={styles.subRow}>
        {lapsValues.map((val, index) => (
          <span key={index} className={styles.subCell}>
            {val}
          </span>
        ))}
      </div>

      <WidgetValue
        className={`${styles.mainValue} ${lapsValueClass()}`}
        value={
          lapsRemaining !== null
            ? lapsRemaining.toFixed(1)
            : NO_LAPS_REMAINING_DATA_PLACEHOLDER
        }
      />
    </div>
  );
});
