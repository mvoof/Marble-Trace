import { observer } from 'mobx-react-lite';

import { useProximityRadarData } from '@hooks/common/useProximityRadarData';
import {
  distanceUnit,
  formatDistance,
} from '@utils/formatters/telemetry-format';
import { CAR_LENGTH, getBarPillColor } from '@utils/constants/radar-constants';

import styles from './RadarBar.module.scss';
import { useUnitsStore } from '@store/root-store-context';

const MIN_PILL_PERCENT = 8;
const BAR_SEARCH_RADIUS = 10;

interface RadarBarProps {
  side: 'left' | 'right';
}

export const RadarBar = observer(({ side }: RadarBarProps) => {
  const units = useUnitsStore();

  const { proximity, visible, spotterLeft, spotterRight, radarSettings } =
    useProximityRadarData('radar-bar', BAR_SEARCH_RADIUS);
  const { unitSystem: system } = units;

  const spotterActive = side === 'left' ? spotterLeft : spotterRight;
  const activeOnly = radarSettings.barDisplayMode === 'active-only';
  const sideVisible = activeOnly ? spotterActive : true;

  if (!visible || !sideVisible || !proximity) {
    return null;
  }

  const rawDist =
    side === 'left'
      ? (proximity.radarDistances.leftDist ?? 0)
      : (proximity.radarDistances.rightDist ?? 0);

  const topPercent = (100 * -rawDist) / CAR_LENGTH;
  const bottomPercent = (100 * (CAR_LENGTH - rawDist)) / CAR_LENGTH;

  let clampedTop = Math.max(0, Math.min(100, topPercent));
  const clampedBottom = Math.max(0, Math.min(100, bottomPercent));
  let heightPercent = clampedBottom - clampedTop;

  if (heightPercent < MIN_PILL_PERCENT) {
    heightPercent = MIN_PILL_PERCENT;

    if (topPercent >= 100) {
      clampedTop = 100 - MIN_PILL_PERCENT;
    }

    if (bottomPercent <= 0) {
      clampedTop = 0;
    }
  }

  const absDist = Math.abs(rawDist);
  const color = getBarPillColor(absDist);
  const rotation = side === 'left' ? '-90deg' : '90deg';
  const formatDistanceFn = (meters: number) => formatDistance(meters, system);
  const distanceUnitLabel = distanceUnit(system);

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
          {rawDist > 0 ? '+' : rawDist < 0 ? '-' : ''}
          {formatDistanceFn(Math.abs(rawDist))}
          {distanceUnitLabel}
        </span>
      </div>
    </div>
  );
});
