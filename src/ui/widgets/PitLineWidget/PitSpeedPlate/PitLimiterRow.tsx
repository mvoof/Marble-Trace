import { observer } from 'mobx-react-lite';

import { speedUnit } from '@utils/telemetry-format';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import { usePlayerStore, useUnitsStore } from '@store/root-store-context';

import styles from './PitSpeedPlate.module.scss';

/**
 * With the limiter engaged the sim holds the speed for the driver, so the row
 * stops being a gauge: there is nothing to measure against the limit any more,
 * and the speed alone is what is left to read. It still moves every tick and is
 * written straight to its span.
 */
interface PitLimiterRowProps {
  withUnit: boolean;
}

export const PitLimiterRow = observer(({ withUnit }: PitLimiterRowProps) => {
  const player = usePlayerStore();
  const units = useUnitsStore();

  const rowRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      // oxlint-disable-next-line no-restricted-properties
      const speedMs = player.carDynamics?.speed ?? 0;
      const speedText = Math.round(speedMs * units.speedFactor).toString();

      scheduleWrite(() => {
        const value = element.querySelector(`.${styles.flatValue}`);

        if (value instanceof HTMLElement) {
          value.textContent = speedText;
        }
      });
    },
    [player, units]
  );

  return (
    <div ref={rowRef} className={`${styles.row} ${styles.rowLimiter}`}>
      <span className={styles.flatValue} />

      <span className={styles.label}>LIM</span>

      {/* Read once, so it keeps out of the way at the foot of the column. */}
      {withUnit && (
        <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
      )}
    </div>
  );
});
