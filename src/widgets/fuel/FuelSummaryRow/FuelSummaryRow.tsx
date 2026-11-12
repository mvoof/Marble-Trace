import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { formatFuel, EMPTY_VALUE } from '@shared/lib/telemetry-format';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import {
  type FuelLapsStatus,
  fuelUnitShort,
  getSummaryAvgLabel,
} from '../fuel-utils';
import { useFuelLapsStatus } from '../use-fuel-status';
import styles from './FuelSummaryRow.module.scss';

const LAPS_STATUS_CLASSES: Record<FuelLapsStatus, string> = {
  safe: styles.lapsSafe,
  warning: styles.lapsWarning,
  danger: styles.lapsDanger,
};

/**
 * Spare fuel reads green; a shortfall turns red only once the tank is in its
 * last laps — far from the stop it is the plan, not an alarm.
 */
const resolveShortageClass = (
  shortage: number | null,
  lapsStatus: FuelLapsStatus | null
): string => {
  if (shortage === null) {
    return '';
  }

  if (shortage >= 0) {
    return styles.sideValueSafe;
  }

  return lapsStatus === 'danger' ? styles.sideValueDanger : '';
};

/**
 * The three figures the strategy stands on: the average behind it, the laps it
 * gives, and what the tank holds against the finish.
 */
export const FuelSummaryRow = observer(() => {
  const { fuel } = useBackendComputedStore();
  const { unitSystem } = useUnitsStore();
  const lapsStatus = useFuelLapsStatus();
  const { appSettings } = useAppSettingsStore();

  const lapsRemaining = fuel?.lapsRemaining ?? null;
  const shortage = fuel?.shortage ?? null;
  const avgPerLap = fuel?.avgPerLap ?? null;
  const unit = fuelUnitShort(unitSystem);

  const lapsClass = lapsStatus !== null ? LAPS_STATUS_CLASSES[lapsStatus] : '';

  // A sign on both sides keeps the figure one length as it crosses zero.
  const shortageText =
    shortage !== null
      ? `${shortage >= 0 ? '+' : ''}${formatFuel(shortage, unitSystem)}`
      : EMPTY_VALUE;

  const isShort = shortage !== null && shortage < 0;
  const shortageClass = resolveShortageClass(shortage, lapsStatus);

  return (
    <div className={`${styles.grid} ${lapsClass}`}>
      <div className={styles.side}>
        <span className={styles.sideLabel}>
          {getSummaryAvgLabel(appSettings.fuelAvgWindow)}
        </span>

        <FixedDigits
          className={styles.sideValue}
          text={
            avgPerLap !== null ? formatFuel(avgPerLap, unitSystem) : EMPTY_VALUE
          }
        />

        <span className={styles.sideUnit}>{unit}/lap</span>
      </div>

      <div className={styles.main}>
        <span className={styles.mainLabel}>LAPS LEFT</span>

        <span className={styles.lapsBox}>
          <FixedDigits
            className={styles.lapsValue}
            text={
              lapsRemaining !== null ? lapsRemaining.toFixed(1) : EMPTY_VALUE
            }
          />
        </span>
      </div>

      <div className={styles.side}>
        <span className={styles.sideLabel}>FINISH</span>

        <FixedDigits
          className={`${styles.sideValue} ${shortageClass}`}
          text={shortageText}
        />

        <span className={styles.sideUnitDim}>
          {unit} {isShort ? 'need' : 'spare'}
        </span>
      </div>
    </div>
  );
});
