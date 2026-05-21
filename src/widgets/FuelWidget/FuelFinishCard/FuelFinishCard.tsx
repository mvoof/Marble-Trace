import { observer } from 'mobx-react-lite';

import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { FUEL_THRESHOLDS } from '@utils/constants/fuel-constants';

import { UnitLabelText } from '@/components/shared/primitives/UnitLabelText/UnitLabelText';
import styles from './FuelFinishCard.module.scss';

export const FuelFinishCard = observer(() => {
  const fuel = computedStore.fuel;
  const settings = widgetSettingsStore.getFuelSettings();

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

      <span className={`${styles.finishValue} ${lapsValueClass()}`}>
        {lapsRemaining !== null ? lapsRemaining.toFixed(1) : '--.-'}
      </span>
    </div>
  );
});
