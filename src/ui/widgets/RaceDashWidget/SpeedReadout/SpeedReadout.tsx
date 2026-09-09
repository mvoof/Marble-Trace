import { observer } from 'mobx-react-lite';

import { formatSpeed, speedUnit } from '@utils/telemetry-format';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import { usePlayerStore, useUnitsStore } from '@store/root-store-context';

import styles from './SpeedReadout.module.scss';

/**
 * The speed, which changes on every physics tick and is one number — the case
 * the reactive-DOM primitive exists for. See `docs/rendering.md`.
 */
export const SpeedReadout = observer(() => {
  const player = usePlayerStore();
  const units = useUnitsStore();

  const valueRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const speedText = formatSpeed(
        // oxlint-disable-next-line no-restricted-properties
        player.carDynamics?.speed ?? 0,
        units.unitSystem
      );

      scheduleWrite(() => {
        element.textContent = speedText;
      });
    },
    [player, units]
  );

  return (
    <div className={styles.root}>
      <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>

      <span ref={valueRef} className={styles.value} />
    </div>
  );
});
