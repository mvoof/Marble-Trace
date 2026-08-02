import { observer } from 'mobx-react-lite';

import {
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { steeringAngleDeg, wrapToHalfTurn } from '@utils/widget/steering-angle';
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
 */
export const SteeringMarker = observer(() => {
  const { carDynamics } = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  if (!settings.showSteeringMarker) {
    return null;
  }

  const rawAngle = carDynamics?.steering_wheel_angle ?? 0;
  // Wheel left means the marker travels left, i.e. counter-clockwise, so the
  // sign flips against the clockwise-positive SVG sweep.
  const travelDeg = -steeringAngleDeg(rawAngle);
  // The dot laps the rim, the trail keeps the direction it was wound in.
  const dot = rimPoint(wrapToHalfTurn(travelDeg), RIM_MARKER_RADIUS);
  const trailDeg = Math.min(Math.max(travelDeg, -MAX_TRAIL_DEG), MAX_TRAIL_DEG);

  return (
    <svg
      className={styles.root}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      aria-hidden="true"
    >
      {Math.abs(trailDeg) > MIN_VISIBLE_TRAIL_DEG && (
        <path
          className={styles.trail}
          d={rimTrailPath(trailDeg, RIM_MARKER_RADIUS)}
          stroke={settings.steeringTrailColor}
          strokeOpacity={TRAIL_OPACITY}
        />
      )}

      <circle
        className={styles.dot}
        cx={dot.x.toFixed(3)}
        cy={dot.y.toFixed(3)}
        r={DOT_RADIUS}
      />
    </svg>
  );
});
