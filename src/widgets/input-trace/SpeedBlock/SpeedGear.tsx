import { observer } from 'mobx-react-lite';

import { usePlayerStore } from '@entities/player/player-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import {
  formatGear,
  formatSpeed,
  speedUnit,
} from '@shared/lib/telemetry-format';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';

import styles from './SpeedGear.module.scss';

/**
 * The car's speed and gear, for when the wheel and its hub are hidden. Both
 * move on every physics tick, so the markup is rendered once and the two
 * numbers are written into it. See `docs/rendering.md`.
 */
export const SpeedGear = observer(() => {
  const player = usePlayerStore();
  const units = useUnitsStore();

  const rootRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      // oxlint-disable-next-line no-restricted-properties
      const carDynamics = player.carDynamics;
      const speedText = formatSpeed(carDynamics?.speed ?? 0, units.unitSystem);
      const gearText = formatGear(carDynamics?.gear ?? 0);

      scheduleWrite(() => {
        const speed = element.querySelector(`.${styles.speedValue}`);
        const gear = element.querySelector(`.${styles.gear}`);

        if (speed instanceof HTMLElement) {
          speed.textContent = speedText;
        }

        if (gear instanceof HTMLElement) {
          gear.textContent = gearText;
        }
      });
    },
    [player, units]
  );

  return (
    <div ref={rootRef} className={styles.speedGear}>
      <div className={styles.speed}>
        <span className={styles.speedValue} />
        <span className={styles.speedUnit}>{speedUnit(units.unitSystem)}</span>
      </div>

      <span className={styles.gear} />
    </div>
  );
});
