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
 * The icon points outward, so it is flipped about the middle of its own body,
 * which sits `ARROW_BASE_RADIUS` out from the centre and is `ARROW_HEIGHT`
 * tall.
 *
 * The flip goes on a wrapping `<g>`, never on the icon itself. The icon is a
 * nested `<svg>`, and transforming one of those is an SVG 2 feature: the CEF
 * that OBS ships drops it silently, whether it arrives as CSS or as an
 * attribute. The arrow then kept the direction it was drawn in and pointed
 * away from the car on a stream screen, while its position — which comes from
 * `x`/`y` and the rotation of the group above — stayed correct, and every
 * ordinary browser drew the whole thing right. A `<g>` transform is SVG 1.1
 * and is understood everywhere; the compass ring turns on one already.
 */
const ARROW_FLIP = `rotate(180 0 ${-ARROW_BASE_RADIUS + ARROW_HEIGHT / 2})`;

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
      <g transform={ARROW_FLIP}>
        <WindArrowIcon
          x="-14"
          y={-ARROW_BASE_RADIUS}
          width="28"
          height={ARROW_HEIGHT}
          style={{ color: arrowColor }}
        />
      </g>
    </g>
  );
});
