import { observer } from 'mobx-react-lite';

import { FUEL_THRESHOLDS } from '@utils/constants/fuel-constants';
import { formatFuel } from '@utils/formatters/telemetry-format';

import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';
import type { FuelWidgetSettings } from '@/types/widget-settings';
import styles from './FuelMainSection.module.scss';
import {
  useBackendComputedStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  NO_FUEL_DATA_PLACEHOLDER,
  NO_LAPS_REMAINING_DATA_PLACEHOLDER,
} from '@utils/constants/data-placeholders';

export const FuelMainSection = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { unitSystem } = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<FuelWidgetSettings>('fuel');

  const lapsRemaining = fuel?.lapsRemaining ?? null;
  const shortage = fuel?.shortage ?? null;
  const avgPerLap = fuel?.avgPerLap ?? null;

  const centerClass = (): string => {
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
    <div className={styles.mainSection}>
      <div className={styles.sideCard}>
        <WidgetLabel className={styles.sideLabel}>AVG / LAP</WidgetLabel>
        <WidgetValue className={styles.sideValue} value={avgText} />
      </div>

      <div className={`${styles.centerCard} ${centerClass()}`}>
        <WidgetValue
          className={`${styles.lapsValue} ${lapsValueClass()}`}
          value={
            lapsRemaining !== null
              ? lapsRemaining.toFixed(1)
              : NO_LAPS_REMAINING_DATA_PLACEHOLDER
          }
        />
      </div>

      <div className={`${styles.sideCard} ${styles.sideCardRight}`}>
        <WidgetLabel className={styles.sideLabel}>AT FINISH</WidgetLabel>
        <WidgetValue
          className={`${styles.sideValue} ${shortageClass}`}
          value={shortageText}
        />
      </div>
    </div>
  );
});
