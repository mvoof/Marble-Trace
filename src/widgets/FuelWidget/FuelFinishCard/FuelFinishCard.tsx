import { observer } from 'mobx-react-lite';

import { FUEL_THRESHOLDS } from '@utils/constants/fuel-constants';

import { UnitLabelText } from '@/components/shared/UnitLabelText/UnitLabelText';
import { UnitValueText } from '@/components/shared/UnitValueText/UnitValueText';
import type { FuelWidgetSettings } from '@/types/widget-settings';
import styles from './FuelFinishCard.module.scss';
import {
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { NO_LAPS_REMAINING_DATA_PLACEHOLDER } from '@/utils/constants/data-placeholders';

export const FuelFinishCard = observer(() => {
  const { fuel } = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<FuelWidgetSettings>('fuel');

  const lapsRemaining = fuel?.lapsRemaining ?? null;
  const shortage = fuel?.shortage ?? null;

  const finishCardClass = (): string => {
    if (lapsRemaining !== null && lapsRemaining <= settings.pitWarningLaps) {
      return styles.finishDanger;
    }

    if (shortage !== null && shortage >= 0) {
      return styles.finishSafe;
    }

    return '';
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

  return (
    <div className={`${styles.finishCard} ${finishCardClass()}`}>
      <UnitLabelText className={styles.finishLabel}>LAPS LEFT</UnitLabelText>

      <UnitValueText
        className={`${styles.finishValue} ${lapsValueClass()}`}
        value={
          lapsRemaining !== null
            ? lapsRemaining.toFixed(1)
            : NO_LAPS_REMAINING_DATA_PLACEHOLDER
        }
      />
    </div>
  );
});
