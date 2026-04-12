import { observer } from 'mobx-react-lite';

import { unitsStore } from '../../../../store/units.store';
import { CAR_LENGTH, getBarPillColor } from '../../../../utils/radar-constants';

import styles from './RadarBar.module.scss';

/** Minimum visible pill height to prevent invisible slivers */
const MIN_PILL_PERCENT = 8;

interface RadarBarProps {
  /** Whether spotter indicates a car on this side */
  active: boolean;
  /** Longitudinal offset of opponent (+ ahead, - behind, 0 = exactly alongside) */
  dist: number;
  /** Which side this bar represents */
  side: 'left' | 'right';
}

export const RadarBar = observer(({ active, dist, side }: RadarBarProps) => {
  const { formatDistance, distanceUnit } = unitsStore;

  if (!active) {
    return <div className={styles.bar} />;
  }

  // Pill position: 0% = our front bumper (top), 100% = our rear bumper (bottom)
  const topPercent = (100 * -dist) / CAR_LENGTH;
  const bottomPercent = (100 * (CAR_LENGTH - dist)) / CAR_LENGTH;

  let clampedTop = Math.max(0, Math.min(100, topPercent));
  const clampedBottom = Math.max(0, Math.min(100, bottomPercent));
  let heightPercent = clampedBottom - clampedTop;

  if (heightPercent < MIN_PILL_PERCENT) {
    heightPercent = MIN_PILL_PERCENT;

    if (topPercent >= 100) clampedTop = 100 - MIN_PILL_PERCENT;
    if (bottomPercent <= 0) clampedTop = 0;
  }

  const absDist = Math.abs(dist);
  const color = getBarPillColor(absDist);
  const rotation = side === 'left' ? '-90deg' : '90deg';

  return (
    <div className={styles.bar}>
      <div
        className={styles.pill}
        style={{
          top: `${clampedTop}%`,
          height: `${heightPercent}%`,
          backgroundColor: color,
        }}
      >
        <span
          className={styles.pillText}
          style={{ transform: `rotate(${rotation})` }}
        >
          {dist > 0 ? '+' : dist < 0 ? '-' : ''}
          {formatDistance(Math.abs(dist))}
          {distanceUnit}
        </span>
      </div>
    </div>
  );
});
