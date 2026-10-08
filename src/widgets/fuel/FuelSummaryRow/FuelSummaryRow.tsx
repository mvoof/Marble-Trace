import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { formatFuel } from '@shared/lib/telemetry-format';
import { WidgetLabel } from '@shared/ui/WidgetLabel/WidgetLabel';
import { WidgetValue } from '@shared/ui/WidgetValue/WidgetValue';
import type { FuelWidgetSettings } from '@shared/contracts/widget-settings';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import {
  NO_FUEL_DATA_PLACEHOLDER,
  NO_LAPS_REMAINING_DATA_PLACEHOLDER,
} from '@shared/lib/telemetry-format';
import {
  type FuelLapsStatus,
  getSummaryAvgLabel,
  resolveLapsStatus,
} from '../fuel-utils';
import styles from './FuelSummaryRow.module.scss';

const LAPS_STATUS_CLASSES: Record<FuelLapsStatus, string> = {
  safe: styles.valueSafe,
  warning: styles.valueWarning,
  danger: styles.valueDanger,
};

export const FuelSummaryRow = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { unitSystem } = useUnitsStore();

  const settings = useWidgetSettings<FuelWidgetSettings>('fuel');

  const lapsRemaining = fuel?.lapsRemaining ?? null;
  const shortage = fuel?.shortage ?? null;
  const avgPerLap = fuel?.avgPerLap ?? null;

  const lapsStatus = resolveLapsStatus(lapsRemaining, settings.pitWarningLaps);
  const lapsValueClass =
    lapsStatus !== null ? LAPS_STATUS_CLASSES[lapsStatus] : '';

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
      <div className={styles.sideLeft}>
        <WidgetValue className={styles.sideValue} value={avgText} />
        <WidgetLabel className={styles.sideLabel}>
          {getSummaryAvgLabel(settings.fuelAvgWindow)}
        </WidgetLabel>
      </div>

      <div className={styles.main}>
        <WidgetValue
          className={`${styles.mainValue} ${lapsValueClass}`}
          value={
            lapsRemaining !== null
              ? lapsRemaining.toFixed(1)
              : NO_LAPS_REMAINING_DATA_PLACEHOLDER
          }
        />

        <WidgetLabel className={styles.mainLabel}>LAPS LEFT</WidgetLabel>
      </div>

      <div className={styles.sideRight}>
        <WidgetValue
          className={`${styles.sideValue} ${shortageClass}`}
          value={shortageText}
        />

        <WidgetLabel className={styles.sideLabel}>FINISH</WidgetLabel>
      </div>
    </div>
  );
});
