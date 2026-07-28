import { observer } from 'mobx-react-lite';

import { FUEL_THRESHOLDS } from '@utils/constants/fuel-constants';
import { formatFuel } from '@utils/formatters/telemetry-format';
import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';
import type { FuelWidgetSettings } from '@/types/widget-settings';
import {
  useBackendComputedStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  NO_FUEL_DATA_PLACEHOLDER,
  NO_LAPS_REMAINING_DATA_PLACEHOLDER,
} from '@utils/constants/data-placeholders';
import { getVisibleFuelStatKeys } from '../../fuel-utils';
import styles from './FuelSummaryRow.module.scss';

// Below this the laps row has too few cells for the side/main cells to mirror
// its column edges, so the summary keeps its own proportions instead.
const MIN_MIRRORED_STAT_COLUMNS = 3;

export const FuelSummaryRow = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { unitSystem } = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<FuelWidgetSettings>('fuel');
  const statColumnCount = getVisibleFuelStatKeys(settings).length;
  const isStandalone = statColumnCount === 0;
  const isMirrored = statColumnCount >= MIN_MIRRORED_STAT_COLUMNS;

  const lapsRemaining = fuel?.lapsRemaining ?? null;
  const shortage = fuel?.shortage ?? null;
  const avgPerLap = fuel?.avgPerLap ?? null;

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

  const gridClasses = [styles.grid, isMirrored ? '' : styles.gridFree];

  if (isStandalone) {
    gridClasses.push(styles.gridStandalone);
  }

  const gridStyle = isMirrored
    ? { gridTemplateColumns: `repeat(${statColumnCount}, 1fr)` }
    : undefined;

  return (
    <div className={gridClasses.join(' ')} style={gridStyle}>
      <div
        className={`${styles.sideLeft} ${isMirrored ? styles.sideLeftAligned : ''}`}
      >
        <WidgetLabel className={styles.sideLabel}>AVG / LAP</WidgetLabel>
        <WidgetValue className={styles.sideValue} value={avgText} />
      </div>

      <div className={`${styles.main} ${isMirrored ? styles.mainAligned : ''}`}>
        {isStandalone && (
          <WidgetLabel className={styles.mainLabel}>LAPS TO EMPTY</WidgetLabel>
        )}

        <WidgetValue
          className={`${styles.mainValue} ${lapsValueClass()}`}
          value={
            lapsRemaining !== null
              ? lapsRemaining.toFixed(1)
              : NO_LAPS_REMAINING_DATA_PLACEHOLDER
          }
        />
      </div>

      <div
        className={`${styles.sideRight} ${isMirrored ? styles.sideRightAligned : ''}`}
      >
        <WidgetLabel className={styles.sideLabel}>FINISH</WidgetLabel>
        <WidgetValue
          className={`${styles.sideValue} ${shortageClass}`}
          value={shortageText}
        />
      </div>
    </div>
  );
});
