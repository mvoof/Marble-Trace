import { observer } from 'mobx-react-lite';

import { useProximityRadarData } from '@hooks/common/useProximityRadarData';
import {
  distanceUnit,
  formatDistance,
} from '@utils/formatters/telemetry-format';
import {
  CAR_WIDTH,
  CAR_CORNER_RADIUS,
  SIDE_CAR_LATERAL_OFFSET,
  getCarColor,
  getSideCarColor,
} from '@utils/constants/radar-constants';

import styles from './RadarDisplay.module.scss';
import { useUnitsStore } from '@store/root-store-context';

const RADAR_RENDER_RANGE = 10;
const PX_PER_METER = 22;
const RADAR_SEARCH_RADIUS = 30;

interface CarIconProps {
  color?: string;
  opacity?: number;
  carLength: number;
}

const CarIcon = observer(
  ({ color = 'currentColor', opacity = 1, carLength }: CarIconProps) => (
    <rect
      x={-(CAR_WIDTH * PX_PER_METER) / 2}
      y={-(carLength * PX_PER_METER) / 2}
      width={CAR_WIDTH * PX_PER_METER}
      height={carLength * PX_PER_METER}
      rx={CAR_CORNER_RADIUS * PX_PER_METER}
      fill={color}
      opacity={opacity}
      className={styles.carIcon}
    />
  )
);

export const RadarDisplay = observer(() => {
  const units = useUnitsStore();

  const { proximity, spotterLeft, spotterRight, visible, radarSettings } =
    useProximityRadarData('proximity-radar', RADAR_SEARCH_RADIUS);
  const { unitSystem: system } = units;

  if (!visible || !proximity) {
    return null;
  }

  const { radarDistances } = proximity;
  const { frontDist, rearDist, leftDist, rightDist } = radarDistances;
  const formatDistanceFn = (meters: number) => formatDistance(meters, system);
  const distanceUnitLabel = distanceUnit(system);

  const { carLength } = radarSettings;

  const showFront = frontDist < RADAR_RENDER_RANGE;
  const showRear = rearDist < RADAR_RENDER_RANGE;

  const frontColor = showFront ? getCarColor(frontDist) : getCarColor(Infinity);
  const rearColor = showRear ? getCarColor(rearDist) : getCarColor(Infinity);

  const frontOpacity = showFront
    ? Math.max(0.01, 0.9 - frontDist / RADAR_RENDER_RANGE)
    : 0;
  const rearOpacity = showRear
    ? Math.max(0.01, 0.9 - rearDist / RADAR_RENDER_RANGE)
    : 0;

  const frontBumperY = -(carLength / 2) * PX_PER_METER;
  const rearBumperY = (carLength / 2) * PX_PER_METER;

  return (
    <div className={styles.radarContainer}>
      <svg viewBox="-120 -240 240 480" className={styles.radarSvg}>
        <defs>
          <pattern
            id="hatch-pattern"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="currentColor"
              strokeWidth="2"
              className={styles.hatchLine}
            />
          </pattern>

          {spotterLeft && leftDist !== null && (
            <linearGradient id="cone-left" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop
                offset="0%"
                stopColor={getSideCarColor(leftDist)}
                stopOpacity="0.4"
              />
              <stop
                offset="100%"
                stopColor={getSideCarColor(leftDist)}
                stopOpacity="0"
              />
            </linearGradient>
          )}

          {spotterRight && rightDist !== null && (
            <linearGradient id="cone-right" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop
                offset="0%"
                stopColor={getSideCarColor(rightDist)}
                stopOpacity="0.4"
              />
              <stop
                offset="100%"
                stopColor={getSideCarColor(rightDist)}
                stopOpacity="0"
              />
            </linearGradient>
          )}
        </defs>

        <g
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 4"
          className={styles.gridLine}
        >
          <line x1={-120} y1="0" x2={120} y2="0" />
          <line x1="0" y1={-240} x2="0" y2={240} />
        </g>

        <rect
          x="-120"
          y={-(carLength * PX_PER_METER) / 2}
          width="240"
          height={carLength * PX_PER_METER}
          fill="url(#hatch-pattern)"
        />

        <polygon
          points={`${-((CAR_WIDTH / 2) * PX_PER_METER)},${frontBumperY} -150,-180 -150,180 ${-((CAR_WIDTH / 2) * PX_PER_METER)},${rearBumperY}`}
          fill="url(#cone-left)"
          className={styles.carTransition}
        />

        {spotterRight && rightDist !== null && (
          <polygon
            points={`${(CAR_WIDTH / 2) * PX_PER_METER},${frontBumperY} 150,-180 150,180 ${(CAR_WIDTH / 2) * PX_PER_METER},${rearBumperY}`}
            fill="url(#cone-right)"
            className={styles.carTransition}
          />
        )}

        {showFront && (
          <g
            transform={`translate(0, ${-(frontDist * PX_PER_METER) - carLength * PX_PER_METER})`}
            className={styles.carTransition}
          >
            <CarIcon
              opacity={frontOpacity}
              color={frontColor}
              carLength={carLength}
            />
            <text y="-18" className={styles.radarMeasurementText}>
              {formatDistanceFn(frontDist)}
              {distanceUnitLabel}
            </text>
          </g>
        )}

        {showRear && (
          <g
            transform={`translate(0, ${rearDist * PX_PER_METER + carLength * PX_PER_METER})`}
            className={styles.carTransition}
          >
            <CarIcon
              opacity={rearOpacity}
              color={rearColor}
              carLength={carLength}
            />
            <text y="18" className={styles.radarMeasurementText}>
              {formatDistanceFn(rearDist)}
              {distanceUnitLabel}
            </text>
          </g>
        )}

        {spotterLeft && leftDist !== null && (
          <g
            transform={`translate(${-(SIDE_CAR_LATERAL_OFFSET * PX_PER_METER)}, ${-(leftDist * PX_PER_METER)})`}
            className={styles.carTransition}
          >
            <CarIcon
              opacity={0.8}
              color={getSideCarColor(leftDist)}
              carLength={carLength}
            />
            <text y="0" className={styles.radarMeasurementText}>
              {formatDistanceFn(Math.abs(leftDist))}
              {distanceUnitLabel}
            </text>
          </g>
        )}

        {spotterRight && rightDist !== null && (
          <g
            transform={`translate(${SIDE_CAR_LATERAL_OFFSET * PX_PER_METER}, ${-(rightDist * PX_PER_METER)})`}
            className={styles.carTransition}
          >
            <CarIcon
              opacity={0.8}
              color={getSideCarColor(rightDist)}
              carLength={carLength}
            />
            <text y="0" className={styles.radarMeasurementText}>
              {formatDistanceFn(Math.abs(rightDist))}
              {distanceUnitLabel}
            </text>
          </g>
        )}

        <CarIcon color="currentColor" carLength={carLength} />
      </svg>
    </div>
  );
});
