import { observer } from 'mobx-react-lite';

import { parsePitSpeedLimitMs, speedUnit } from '@shared/lib/telemetry-format';
import { useSessionStore } from '@entities/session/session-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { usePitServiceWidgetStore } from '@features/pit-service/pit-service-context';

import styles from './PitLimitPlate.module.scss';

/**
 * The pit speed limit, as the plate by the lane shows it, above the bars. Up
 * for as long as the driver is the one holding the car to it — the limiter off
 * and the limit still binding. Going over does not take it down: that is when
 * the number matters most.
 */
interface PitLimitPlateProps {
  withUnit: boolean;
}

export const PitLimitPlate = observer(({ withUnit }: PitLimitPlateProps) => {
  const sessionStore = useSessionStore();
  const units = useUnitsStore();
  const pitService = usePitServiceWidgetStore();

  const limitMs = parsePitSpeedLimitMs(
    sessionStore.sessionInfo?.trackPitSpeedLimit
  );

  const isShown =
    limitMs > 0 && !pitService.isLimiterOn && !pitService.isPitLimitReleased;

  if (!isShown) {
    return null;
  }

  return (
    <div className={styles.plate}>
      <span className={styles.value}>
        {Math.round(limitMs * units.speedFactor)}
      </span>

      {withUnit && (
        <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
      )}
    </div>
  );
});
