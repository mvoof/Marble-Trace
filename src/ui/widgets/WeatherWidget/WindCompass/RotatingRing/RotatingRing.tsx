import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import { usePlayerStore } from '@store/root-store-context';

import styles from './RotatingRing.module.scss';

const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * The custom property the whole compass turns on. The group rotates by it and
 * the cardinal labels counter-rotate by it, so one write turns the ring and
 * keeps the letters upright.
 */
const COMPASS_YAW_PROPERTY = '--compass-yaw';

interface RotatingRingProps {
  /**
   * The ring's geometry, created by a parent that does not re-render — nothing
   * inside it changes with the heading.
   */
  children: ReactNode;
}

/**
 * Turns the compass with the car's heading, a hot field that changes on every
 * physics tick. The rotation goes to the DOM through the reactive-DOM primitive,
 * so the heading wakes React not at all: this component renders once, and its
 * children are the same element objects for as long as it is mounted.
 */
export const RotatingRing = observer(function RotatingRing({
  children,
}: RotatingRingProps) {
  const player = usePlayerStore();

  const groupRef = useReactiveDomWrite<SVGGElement>(
    (element, scheduleWrite) => {
      const carYawDeg = (player.carDynamics?.yaw ?? 0) * RADIANS_TO_DEGREES;

      scheduleWrite(() => {
        element.style.setProperty(COMPASS_YAW_PROPERTY, `${-carYawDeg}deg`);
      });
    },
    [player]
  );

  return (
    <g ref={groupRef} className={styles.rotatingGroup} pointerEvents="none">
      {children}
    </g>
  );
});
