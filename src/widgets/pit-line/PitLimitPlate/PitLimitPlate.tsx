import { observer } from 'mobx-react-lite';

import { parsePitSpeedLimitMs, speedUnit } from '@shared/lib/telemetry-format';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { usePlayerStore } from '@entities/player/player-context';
import { useSessionStore } from '@entities/session/session-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { usePitServiceWidgetStore } from '@features/pit-service/pit-service-context';

import styles from './PitLimitPlate.module.scss';

/**
 * The pit speed limit, as the plate by the lane shows it, above the bars. Only
 * while the driver is the one holding the car to it: the limiter does that job
 * on its own, and once the speed is over the gauge has a louder thing to say.
 *
 * It keeps its place while it is not shown, so the bars under it do not jump
 * every time the speed crosses the limit. The speed moves every tick, so the
 * plate is written straight to the DOM. See `docs/rendering.md`.
 */
interface PitLimitPlateProps {
  withUnit: boolean;
}

export const PitLimitPlate = observer(({ withUnit }: PitLimitPlateProps) => {
  const player = usePlayerStore();
  const sessionStore = useSessionStore();
  const units = useUnitsStore();
  const pitService = usePitServiceWidgetStore();

  const plateRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      // oxlint-disable-next-line no-restricted-properties
      const speedMs = player.carDynamics?.speed ?? 0;
      const limitMs = parsePitSpeedLimitMs(
        sessionStore.sessionInfo?.trackPitSpeedLimit
      );

      const hasLimit = limitMs > 0;
      const isDriverHolding =
        !pitService.isLimiterOn && !pitService.isPitLimitReleased;
      const isShown = hasLimit && isDriverHolding && speedMs <= limitMs;

      // Written even while hidden, so the plate keeps the height it shows at.
      const limitText = hasLimit
        ? Math.round(limitMs * units.speedFactor).toString()
        : '';

      scheduleWrite(() => {
        element.classList.toggle(styles.plateHidden, !isShown);

        const value = element.querySelector(`.${styles.value}`);

        if (value instanceof HTMLElement) {
          value.textContent = limitText;
        }
      });
    },
    [player, sessionStore, units, pitService]
  );

  return (
    <div ref={plateRef} className={`${styles.plate} ${styles.plateHidden}`}>
      <span className={styles.value} />

      {withUnit && (
        <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
      )}
    </div>
  );
});
