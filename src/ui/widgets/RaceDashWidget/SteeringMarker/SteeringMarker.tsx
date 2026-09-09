import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { usePlayerStore } from '@store/root-store-context';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { steeringAngleDeg, wrapToHalfTurn } from '@utils/car-signals';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import {
  RIM_MARKER_RADIUS,
  RING_SIZE,
  rimPoint,
  rimTrailPath,
} from '../RingBadge/ring-geometry';

import styles from './SteeringMarker.module.scss';

// Just short of a full turn: the trail winds with the wheel, and one SVG arc
// cannot close a complete circle — its ends would land on the same point and
// degenerate to an empty path. Past a full turn the trail simply stays a
// closed ring, the way further winding is invisible on a real rim too.
const MAX_TRAIL_DEG = 359.5;
// Fills the free rim band exactly: the band is 7 design px, so the dot's own
// diameter is its full thickness — any larger and it would clip the badge edge
// or the RPM arc.
const DOT_RADIUS = 3.5;
const MIN_VISIBLE_TRAIL_DEG = 1;
// The trail is context, not a value — it stays far below the dot in weight
// whatever color the user picks for it.
const TRAIL_OPACITY = 0.22;

/**
 * Steering angle as a dot orbiting the badge one-to-one with the driver's
 * hands: 90° of wheel is 90° of orbit, exactly like the marker taped to the
 * top of a real rim, which is also why it laps the badge on wheels with more
 * than one turn of lock. A faint trail back to 12 o'clock shows how far into
 * the current turn the wheel is.
 *
 * The angle changes on every physics tick, so the dot and the trail are written
 * straight to their SVG attributes. See `docs/rendering.md`.
 */
export const SteeringMarker = observer(() => {
  const player = usePlayerStore();

  const settings = useWidgetSettings<RaceDashWidgetSettings>('race-dash');

  const rootRef = useReactiveDomWrite<SVGSVGElement>(
    (element, scheduleWrite) => {
      // oxlint-disable-next-line no-restricted-properties
      const rawAngle = player.carDynamics?.steering_wheel_angle ?? 0;
      // Wheel left means the marker travels left, i.e. counter-clockwise, so
      // the sign flips against the clockwise-positive SVG sweep.
      const travelDeg = -steeringAngleDeg(rawAngle);
      // The dot laps the rim, the trail keeps the direction it was wound in.
      const dot = rimPoint(wrapToHalfTurn(travelDeg), RIM_MARKER_RADIUS);
      const trailDeg = Math.min(
        Math.max(travelDeg, -MAX_TRAIL_DEG),
        MAX_TRAIL_DEG
      );

      const hasTrail = Math.abs(trailDeg) > MIN_VISIBLE_TRAIL_DEG;
      const trailPath = hasTrail
        ? rimTrailPath(trailDeg, RIM_MARKER_RADIUS)
        : '';

      scheduleWrite(() => {
        const trail = element.querySelector(`.${styles.trail}`);

        if (trail instanceof SVGPathElement) {
          trail.setAttribute('d', trailPath);
          trail.style.display = hasTrail ? '' : 'none';
        }

        const marker = element.querySelector(`.${styles.dot}`);

        if (marker instanceof SVGCircleElement) {
          marker.setAttribute('cx', dot.x.toFixed(3));
          marker.setAttribute('cy', dot.y.toFixed(3));
        }
      });
    },
    [player]
  );

  if (!settings.showSteeringMarker) {
    return null;
  }

  return (
    <svg
      ref={rootRef}
      className={styles.root}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      aria-hidden="true"
    >
      <path
        className={styles.trail}
        stroke={settings.steeringTrailColor}
        strokeOpacity={TRAIL_OPACITY}
      />

      <circle className={styles.dot} r={DOT_RADIUS} />
    </svg>
  );
});
