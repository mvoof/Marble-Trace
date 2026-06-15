import { observer } from 'mobx-react-lite';

import { formatFuel } from '@utils/formatters/telemetry-format';
import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';

import styles from './PitWarningStrategy.module.scss';
import {
  useBackendComputedStore,
  useSessionStore,
  useUnitsStore,
} from '@store/root-store-context';

export const PitWarningStrategy = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { sessionInfo } = useSessionStore();
  const { unitSystem } = useUnitsStore();

  const fuelMax = sessionInfo?.driverCarFuelMaxLtr ?? null;
  const fuelToAddWithBuffer = fuel?.fuelToAddWithBuffer ?? null;

  const isMultiStop =
    fuelMax !== null &&
    fuelToAddWithBuffer !== null &&
    fuelToAddWithBuffer > fuelMax;

  return (
    <div className={styles.pitWarningStrategySlot}>
      {isMultiStop && fuelMax !== null && fuelToAddWithBuffer !== null && (
        <div className={styles.pitWarningStrategy}>
          <div className={styles.strategyRow}>
            <WidgetLabel className={styles.strategyLabel}>STOPS</WidgetLabel>

            <WidgetValue
              className={styles.strategyValue}
              value={Math.ceil(fuelToAddWithBuffer / fuelMax)}
            />
          </div>

          <div className={styles.strategyDivider} />

          <div className={styles.strategyRow}>
            <WidgetLabel className={styles.strategyLabel}>
              REC. FILL
            </WidgetLabel>

            <WidgetValue
              className={styles.strategyValue}
              value={formatFuel(
                fuelToAddWithBuffer / Math.ceil(fuelToAddWithBuffer / fuelMax),
                unitSystem
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
});
