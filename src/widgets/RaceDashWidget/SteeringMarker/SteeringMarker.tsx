import { observer } from 'mobx-react-lite';

import {
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import {
  RIM_MARKER_RADIUS,
  RING_SIZE,
  rimArcPath,
} from '../RingBadge/ring-geometry';

import styles from './SteeringMarker.module.scss';

const MARKER_SPAN_DEG = 16;
const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * Steering angle as a short arc segment sliding along the badge's rim — the
 * same curved language as the RPM band, so it belongs to the ring instead of
 * sitting on top of it. Rides outside the RPM arc and never crosses it.
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
  const markerDeg = -rawAngle * RADIANS_TO_DEGREES;
  const path = rimArcPath(markerDeg, MARKER_SPAN_DEG, RIM_MARKER_RADIUS);

  return (
    <svg
      className={styles.root}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      aria-hidden="true"
    >
      <path className={styles.segment} d={path} />
    </svg>
  );
});
