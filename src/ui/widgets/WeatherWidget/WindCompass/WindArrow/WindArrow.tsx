import { observer } from 'mobx-react-lite';

import WindArrowIcon from '@assets/wind-arrow.svg?react';
import {
  getWindColor,
  parseWeekendFloat,
  radsToBearing,
} from '@utils/weather-utils';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import {
  useEnvironmentStore,
  usePlayerStore,
  useSessionStore,
} from '@store/root-store-context';

import styles from './WindArrow.module.scss';

const RADIANS_TO_DEGREES = 180 / Math.PI;

const FULL_TURN_DEGREES = 360;

/** The custom property the arrow turns on; the group rotates by it in CSS. */
const WIND_BEARING_PROPERTY = '--wind-bearing';

const ARROW_BASE_RADIUS = 105;
const ARROW_HEIGHT = 55;

/**
 * Points at the wind relative to the car. The bearing follows the car's heading,
 * a hot field that changes on every physics tick, so it goes to the DOM through
 * the reactive-DOM primitive and wakes React not at all; only the wind's own
 * speed, which arrives once a second, re-renders the arrow — for its colour.
 */
export const WindArrow = observer(function WindArrow() {
  const sessionStore = useSessionStore();
  const environmentStore = useEnvironmentStore();
  const player = usePlayerStore();

  const windVelMps =
    environmentStore.environment?.windVel ??
    parseWeekendFloat(sessionStore.sessionInfo?.trackWindVel);
  const arrowColor = getWindColor(windVelMps);

  const groupRef = useReactiveDomWrite<SVGGElement>(
    (element, scheduleWrite) => {
      const carYawDeg = (player.carDynamics?.yaw ?? 0) * RADIANS_TO_DEGREES;
      const windDirRad =
        environmentStore.environment?.windDir ??
        parseWeekendFloat(sessionStore.sessionInfo?.trackWindDir);
      const windBearing = windDirRad !== null ? radsToBearing(windDirRad) : 0;
      const relativeBearing =
        (((windBearing - carYawDeg) % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) %
        FULL_TURN_DEGREES;

      scheduleWrite(() => {
        element.style.setProperty(
          WIND_BEARING_PROPERTY,
          `${relativeBearing}deg`
        );
      });
    },
    [player, environmentStore, sessionStore]
  );

  return (
    <g ref={groupRef} className={styles.windArrowGroup} pointerEvents="none">
      <WindArrowIcon
        x="-14"
        y={-ARROW_BASE_RADIUS}
        width="28"
        height={ARROW_HEIGHT}
        className={styles.windArrowIcon}
        style={{ color: arrowColor }}
      />
    </g>
  );
});
