import { observer } from 'mobx-react-lite';

import { PitWarningHeader } from './PitWarningHeader/PitWarningHeader';
import { PitWarningStrategy } from './PitWarningStrategy/PitWarningStrategy';
import { PitWarningAmount } from './PitWarningAmount/PitWarningAmount';

import styles from './FuelPitWarning.module.scss';
import {
  useComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const FuelPitWarning = observer(() => {
  const computed = useComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const fuel = computed.fuel;
  const settings = widgetSettings.getFuelSettings();

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
