import { observer } from 'mobx-react-lite';

import { speedUnit } from '@shared/lib/telemetry-format';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { useLiveParts } from '@shared/ui/live/live-parts';
import { usePlayerStore } from '@entities/player/player-context';
import { useUnitsStore } from '@entities/app-settings/units-context';

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

  const parts = useLiveParts<'value'>();

  const rowRef = useReactiveDomWrite<HTMLDivElement>(
    (_element, scheduleWrite) => {
      const speedMs = player.carDynamics?.speed ?? 0;
      const speedText = Math.round(speedMs * units.speedFactor).toString();

      scheduleWrite(() => {
        parts.text('value', speedText);
      });
    },
    [player, units, parts]
  );

  return (
    <div ref={rowRef} className={`${styles.row} ${styles.rowLimiter}`}>
      <span ref={parts.ref('value')} className={styles.flatValue} />

      <span className={styles.label}>LIM</span>

      {/* Read once, so it keeps out of the way at the foot of the column. */}
      {withUnit && (
        <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
      )}
    </div>
  );
});
