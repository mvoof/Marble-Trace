import { observer } from 'mobx-react-lite';

import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { PitWarningHeader } from './PitWarningHeader/PitWarningHeader';
import { PitWarningStrategy } from './PitWarningStrategy/PitWarningStrategy';
import { PitWarningAmount } from './PitWarningAmount/PitWarningAmount';

import styles from './FuelPitWarning.module.scss';

export const FuelPitWarning = observer(() => {
  const fuel = computedStore.fuel;
  const settings = widgetSettingsStore.getFuelSettings();

  const lapsRemaining = fuel?.lapsRemaining ?? null;
  const shortage = fuel?.shortage ?? null;
  const isVisible =
    lapsRemaining !== null && lapsRemaining <= settings.pitWarningLaps;

  if (!isVisible) {
    return null;
  }

  const isShort = shortage !== null && shortage < 0;

  return (
    <div
      className={`${styles.pitWarning} ${isShort ? styles.pitWarningUrgent : ''}`}
    >
      <PitWarningHeader />

      <div className={styles.pitWarningBody}>
        <div className={styles.pitWarningMainRow}>
          <PitWarningStrategy />
          <PitWarningAmount />
        </div>
      </div>
    </div>
  );
});
