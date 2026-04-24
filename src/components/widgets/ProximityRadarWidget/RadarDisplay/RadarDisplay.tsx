import { observer } from 'mobx-react-lite';

import { unitsStore } from '../../../../store/units.store';
import type { RadarDistances } from '../../../../types/bindings';
import {
  CAR_WIDTH,
  CAR_LENGTH,
  CAR_CORNER_RADIUS,
  SIDE_CAR_LATERAL_OFFSET,
  getCarColor,
  getSideCarColor,
} from '../../../../utils/radar-constants';

import styles from './RadarDisplay.module.scss';

const PX_PER_METER = 22;

interface CarIconProps {
  color?: string;
  opacity?: number;
}

const CarIcon = ({ color = 'currentColor', opacity = 1 }: CarIconProps) => (
  <rect
    x={-(CAR_WIDTH * PX_PER_METER) / 2}
    y={-(CAR_LENGTH * PX_PER_METER) / 2}
    width={CAR_WIDTH * PX_PER_METER}
    height={CAR_LENGTH * PX_PER_METER}
    rx={CAR_CORNER_RADIUS * PX_PER_METER}
    fill={color}
    opacity={opacity}
    className={styles.carIcon}
  />
);

interface RadarDisplayProps {
  radarDistances: RadarDistances;
  spotterLeft: boolean;
  spotterRight: boolean;
  renderRange: number;
}

export const RadarDisplay = observer(
  ({
    radarDistances,
    spotterLeft,
    spotterRight,
    renderRange,
  }: RadarDisplayProps) => {
    const { formatDistance, distanceUnit } = unitsStore;
    const { frontDist, rearDist, leftDist, rightDist } = radarDistances;

    const showFront = frontDist < renderRange;
    const showRear = rearDist < renderRange;

    const frontColor = showFront
      ? getCarColor(frontDist)
      : getCarColor(Infinity);
    const rearColor = showRear ? getCarColor(rearDist) : getCarColor(Infinity);

    const frontOpacity = showFront
      ? Math.max(0.01, 0.9 - frontDist / renderRange)
      : 0;
    const rearOpacity = showRear
      ? Math.max(0.01, 0.9 - rearDist / renderRange)
      : 0;

    const frontBumperY = -(CAR_LENGTH / 2) * PX_PER_METER;
    const rearBumperY = (CAR_LENGTH / 2) * PX_PER_METER;

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
            y={-(CAR_LENGTH * PX_PER_METER) / 2}
            width="240"
            height={CAR_LENGTH * PX_PER_METER}
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
              transform={`translate(0, ${-(frontDist * PX_PER_METER) - CAR_LENGTH * PX_PER_METER})`}
              className={styles.carTransition}
            >
              <CarIcon opacity={frontOpacity} color={frontColor} />
              <text y="-18" className={styles.radarMeasurementText}>
                {formatDistance(frontDist)}
                {distanceUnit}
              </text>
            </g>
          )}

          {showRear && (
            <g
              transform={`translate(0, ${rearDist * PX_PER_METER + CAR_LENGTH * PX_PER_METER})`}
              className={styles.carTransition}
            >
              <CarIcon opacity={rearOpacity} color={rearColor} />
              <text y="18" className={styles.radarMeasurementText}>
                {formatDistance(rearDist)}
                {distanceUnit}
              </text>
            </g>
          )}

          {spotterLeft && leftDist !== null && (
            <g
              transform={`translate(${-(SIDE_CAR_LATERAL_OFFSET * PX_PER_METER)}, ${-(leftDist * PX_PER_METER)})`}
              className={styles.carTransition}
            >
              <CarIcon opacity={0.8} color={getSideCarColor(leftDist)} />
              <text y="0" className={styles.radarMeasurementText}>
                {formatDistance(Math.abs(leftDist))}
                {distanceUnit}
              </text>
            </g>
          )}

          {spotterRight && rightDist !== null && (
            <g
              transform={`translate(${SIDE_CAR_LATERAL_OFFSET * PX_PER_METER}, ${-(rightDist * PX_PER_METER)})`}
              className={styles.carTransition}
            >
              <CarIcon opacity={0.8} color={getSideCarColor(rightDist)} />
              <text y="0" className={styles.radarMeasurementText}>
                {formatDistance(Math.abs(rightDist))}
                {distanceUnit}
              </text>
            </g>
          )}

          <CarIcon color="currentColor" />
        </svg>
      </div>
    );
  }
);
