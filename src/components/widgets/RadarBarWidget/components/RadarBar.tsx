import { observer } from 'mobx-react-lite';

import { useUnits } from '../../../../hooks/useUnits';

import styles from '../RadarBarWidget.module.scss';

const COLORS = {
  danger: '#ff2a55',
  warning: '#eab308',
  safe: '#22c55e',
};

const CAR_H = 4.4;
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
  const { formatDistance, distanceUnit } = useUnits();

  if (!active) {
    return <div className={styles.bar} />;
  }

  // Pill position: 0% = our front bumper (top), 100% = our rear bumper (bottom)
  // Opponent car is also CAR_H long
  let topPercent = (100 * -dist) / CAR_H;
  let bottomPercent = (100 * (CAR_H - dist)) / CAR_H;

  let clampedTop = Math.max(0, Math.min(100, topPercent));
  let clampedBottom = Math.max(0, Math.min(100, bottomPercent));
  let heightPercent = clampedBottom - clampedTop;

  // If spotter is active but pill is tiny (iRacing lag/edge), show minimum pill at the edge
  if (heightPercent < MIN_PILL_PERCENT) {
    heightPercent = MIN_PILL_PERCENT;

    if (topPercent >= 100) clampedTop = 100 - MIN_PILL_PERCENT;
    if (bottomPercent <= 0) clampedTop = 0;
  }

  // Color based on how close centers are (closer to 0 = more danger)
  const absDist = Math.abs(dist);
  const color =
    absDist <= 1.0
      ? COLORS.danger
      : absDist <= 2.5
        ? COLORS.warning
        : COLORS.safe;

  const rotation = side === 'left' ? '-90deg' : '90deg';

  return (
    <div className={styles.bar}>
      <div
        className={styles.pill}
        style={{
          top: `${clampedTop}%`,
          height: `${heightPercent}%`,
          backgroundColor: color,
          boxShadow: `0 0 15px ${color}80, inset 0 0 8px rgba(255, 255, 255, 0.2)`,
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
