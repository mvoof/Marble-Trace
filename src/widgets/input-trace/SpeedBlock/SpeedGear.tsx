import { observer } from 'mobx-react-lite';

import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { targetSpeedColor } from '@entities/corner-speeds/target-speed';
import { usePlayerStore } from '@entities/player/player-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import {
  formatGear,
  formatSpeed,
  speedUnit,
} from '@shared/lib/telemetry-format';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';

import styles from './SpeedGear.module.scss';
import type { InputTraceSettings } from '../settings-schema';

/**
 * The car's speed and gear, a block of their own whether the wheel is shown
 * or not. Both move on every physics tick, so the markup is rendered once and
 * the two numbers are written into it. See `docs/rendering.md`.
 *
 * With the target colour on, the speed takes the on-target or over-target
 * colour against the lit corner target, written with the number.
 */
export const SpeedGear = observer(() => {
  const player = usePlayerStore();
  const units = useUnitsStore();
  const backendComputed = useBackendComputedStore();

  const settings = useWidgetSettings<InputTraceSettings>('input-trace');

  const rootRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      // oxlint-disable-next-line no-restricted-properties
      const carDynamics = player.carDynamics;
      const speed = carDynamics?.speed ?? 0;
      const speedText = formatSpeed(speed, units.unitSystem);
      const gearText = formatGear(carDynamics?.gear ?? 0);

      const speedColor = settings.showSpeedTargetColor
        ? targetSpeedColor(speed, backendComputed.cornerSpeeds, {
            onTarget: settings.speedOnTargetColor,
            over: settings.speedOverTargetColor,
          })
        : '';

      scheduleWrite(() => {
        const speed = element.querySelector(`.${styles.speedValue}`);
        const gear = element.querySelector(`.${styles.gear}`);

        if (speed instanceof HTMLElement) {
          speed.textContent = speedText;
          speed.style.color = speedColor;
        }

        if (gear instanceof HTMLElement) {
          gear.textContent = gearText;
        }
      });
    },
    [player, units, backendComputed, settings]
  );

  if (!settings.showSpeedGear) {
    return null;
  }

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
