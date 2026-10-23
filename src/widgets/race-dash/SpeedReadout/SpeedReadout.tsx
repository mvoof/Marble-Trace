import { observer } from 'mobx-react-lite';

import { formatSpeed, speedUnit } from '@shared/lib/telemetry-format';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { targetSpeedColor } from '@entities/corner-speeds/target-speed';
import { usePlayerStore } from '@entities/player/player-context';
import { useUnitsStore } from '@entities/app-settings/units-context';

import styles from './SpeedReadout.module.scss';
import type { RaceDashWidgetSettings } from '../settings-schema';

/**
 * The speed, which changes on every physics tick and is one number — the case
 * the reactive-DOM primitive exists for. See `docs/rendering.md`.
 *
 * With the target colour on, the speed takes the on-target or over-target
 * colour against the lit corner target, written with the number.
 */
export const SpeedReadout = observer(() => {
  const player = usePlayerStore();
  const units = useUnitsStore();
  const backendComputed = useBackendComputedStore();

  const settings = useWidgetSettings<RaceDashWidgetSettings>('race-dash');

  const valueRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      // oxlint-disable-next-line no-restricted-properties
      const speed = player.carDynamics?.speed ?? 0;
      const speedText = formatSpeed(speed, units.unitSystem);

      const speedColor = settings.showSpeedTargetColor
        ? targetSpeedColor(speed, backendComputed.cornerSpeeds, {
            onTarget: settings.speedOnTargetColor,
            over: settings.speedOverTargetColor,
          })
        : '';

      scheduleWrite(() => {
        element.textContent = speedText;
        element.style.color = speedColor;
      });
    },
    [player, units, backendComputed, settings]
  );

  return (
    <div className={styles.root}>
      <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>

      <span ref={valueRef} className={styles.value} />
    </div>
  );
});
