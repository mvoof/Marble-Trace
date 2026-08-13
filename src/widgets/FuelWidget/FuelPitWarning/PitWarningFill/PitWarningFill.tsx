import { observer } from 'mobx-react-lite';

import { formatFuel } from '@utils/telemetry-format';
import { WidgetLabel } from '@ui/shared/WidgetLabel/WidgetLabel';
import { WidgetValue } from '@ui/shared/WidgetValue/WidgetValue';
import { NO_FUEL_DATA_PLACEHOLDER } from '@utils/telemetry-format';
import {
  useBackendComputedStore,
  useSessionStore,
  useUnitsStore,
} from '@store/root-store-context';
import { computeRefuelPlan } from '../../fuel-utils';
import styles from './PitWarningFill.module.scss';

export const PitWarningFill = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { sessionInfo } = useSessionStore();
  const { unitSystem } = useUnitsStore();

  const fuelMax = sessionInfo?.driverCarFuelMaxLtr ?? null;
  const fuelToAdd = fuel?.fuelToAddWithBuffer ?? null;

  const plan = computeRefuelPlan(fuelToAdd, fuelMax);
  const isMultiStop = plan !== null && plan.stops > 1;

  return (
    <div className={styles.fill}>
      <div className={styles.mainRow}>
        <div className={styles.amountCell}>
          <WidgetValue
            className={styles.amount}
            unitClassName={styles.amountUnit}
            value={
              plan !== null
                ? formatFuel(plan.fillNow, unitSystem)
                : NO_FUEL_DATA_PLACEHOLDER
            }
          />

          <WidgetLabel className={styles.amountLabel}>FILL NOW</WidgetLabel>
        </div>

        {isMultiStop && (
          <span className={styles.stops}>
            <span className={styles.stopsCount}>{plan.stops}</span> STOPS
          </span>
        )}
      </div>

      <div className={styles.footer}>
        {isMultiStop && fuelToAdd !== null && (
          <>
            <span>TOTAL {formatFuel(fuelToAdd, unitSystem)}</span>

            <span className={styles.footerDot}>·</span>
          </>
        )}

        <span>+1 LAP BUFFER</span>
      </div>
    </div>
  );
});
