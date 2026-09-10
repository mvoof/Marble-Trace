import { observer } from 'mobx-react-lite';

import { parsePitSpeedLimitMs, speedUnit } from '@utils/telemetry-format';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import {
  usePlayerStore,
  useSessionStore,
  useUnitsStore,
} from '@store/root-store-context';

import styles from './PitSpeedPlate.module.scss';

const NO_LIMIT_TEXT = '—';

/**
 * With the limiter engaged the sim holds the speed, so the row stops being a
 * gauge and simply names both numbers. The speed half of the pair still moves
 * every tick and is written straight to its span.
 */
interface PitLimiterRowProps {
  withUnit: boolean;
}

export const PitLimiterRow = observer(({ withUnit }: PitLimiterRowProps) => {
  const player = usePlayerStore();
  const sessionStore = useSessionStore();
  const units = useUnitsStore();

  const rowRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      // oxlint-disable-next-line no-restricted-properties
      const speedMs = player.carDynamics?.speed ?? 0;
      const limitMs = parsePitSpeedLimitMs(
        sessionStore.sessionInfo?.trackPitSpeedLimit
      );
      const factor = units.speedFactor;

      const limitText =
        limitMs > 0 ? Math.round(limitMs * factor).toString() : NO_LIMIT_TEXT;
      const pairText = `${Math.round(speedMs * factor)}/${limitText}`;

      scheduleWrite(() => {
        const value = element.querySelector(`.${styles.value}`);

        if (value instanceof HTMLElement) {
          value.textContent = pairText;
        }
      });
    },
    [player, sessionStore, units]
  );

  return (
    <div ref={rowRef} className={`${styles.row} ${styles.rowLimiter}`}>
      <span className={styles.label}>LIM</span>

      <span className={styles.readout}>
        <span className={`${styles.value} ${styles.valueWide}`} />

        {withUnit && (
          <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
        )}
      </span>
    </div>
  );
});
