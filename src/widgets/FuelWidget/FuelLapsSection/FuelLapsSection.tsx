import { observer } from 'mobx-react-lite';

import { FUEL_THRESHOLDS } from '@utils/constants/fuel-constants';
import { formatFuel } from '@utils/formatters/telemetry-format';
import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';
import type { FuelWidgetSettings } from '@/types/widget-settings';
import { computeFuelHistoryStats } from '../fuel-utils';
import styles from './FuelLapsSection.module.scss';
import {
  useBackendComputedStore,
  usePlayerStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  NO_FUEL_DATA_PLACEHOLDER,
  NO_LAPS_REMAINING_DATA_PLACEHOLDER,
} from '@utils/constants/data-placeholders';

const NO_LAPS = '—';

const computeLaps = (fuelLevel: number, consumptionPerLap: number): string => {
  if (consumptionPerLap <= 0) {
    return NO_LAPS;
  }

  return (fuelLevel / consumptionPerLap).toFixed(1);
};

export const FuelLapsSection = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { carStatus } = usePlayerStore();
  const { unitSystem } = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<FuelWidgetSettings>('fuel');

  const lapsRemaining = fuel?.lapsRemaining ?? null;
  const shortage = fuel?.shortage ?? null;
  const avgPerLap = fuel?.avgPerLap ?? null;
  const history = fuel?.lapFuelHistory ?? [];
  const fuelLevel = carStatus?.fuel_level ?? 0;

  const laps = (val: number | null): string =>
    val !== null && fuelLevel > 0 ? computeLaps(fuelLevel, val) : NO_LAPS;

  const { last, avg10, min, max } = computeFuelHistoryStats(history);

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

  const shortageText =
    shortage !== null
      ? `${shortage >= 0 ? '+' : ''}${formatFuel(shortage, unitSystem)}`
      : NO_FUEL_DATA_PLACEHOLDER;

  const shortageClass =
    shortage !== null && shortage >= 0 ? styles.sideValueSafe : '';
  const avgText =
    avgPerLap !== null
      ? formatFuel(avgPerLap, unitSystem)
      : NO_FUEL_DATA_PLACEHOLDER;

  return (
    <div className={styles.grid}>
      {/* Row 1: LAPS TO EMPTY label — full width */}
      <span className={styles.label}>LAPS TO EMPTY</span>

      {/* Row 2: 4 laps cells — middle 2 have no bottom border */}
      <span className={`${styles.cell} ${styles.cell1}`}>{laps(last)}</span>
      <span className={`${styles.cell} ${styles.cell2}`}>{laps(avg10)}</span>
      <span className={`${styles.cell} ${styles.cell3}`}>{laps(min)}</span>
      <span className={`${styles.cell} ${styles.cell4}`}>{laps(max)}</span>

      {/* Row 3: AVG/LAP | main laps value (spans cols 2-3) | AT FINISH */}
      <div className={styles.sideLeft}>
        <WidgetLabel className={styles.sideLabel}>AVG / LAP</WidgetLabel>
        <WidgetValue className={styles.sideValue} value={avgText} />
      </div>

      <WidgetValue
        className={`${styles.mainValue} ${lapsValueClass()}`}
        value={
          lapsRemaining !== null
            ? lapsRemaining.toFixed(1)
            : NO_LAPS_REMAINING_DATA_PLACEHOLDER
        }
      />

      <div className={styles.sideRight}>
        <WidgetLabel className={styles.sideLabel}>FINISH</WidgetLabel>
        <WidgetValue
          className={`${styles.sideValue} ${shortageClass}`}
          value={shortageText}
        />
      </div>
    </div>
  );
});
