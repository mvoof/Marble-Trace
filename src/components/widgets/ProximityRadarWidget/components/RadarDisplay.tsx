import type { RadarDistances, SpotterState } from '../../../../utils/proximity';

import styles from '../ProximityRadarWidget.module.scss';

// === CONSTANTS ===
const SCALE = 12;
const CAR_W = 1.8;
const CAR_H = 4.4;
const CAR_R = 0.8;
const LATERAL_OFFSET = CAR_W + 1.2;

const COLORS = {
  danger: '#ff2a55',
  warning: '#eab308',
  safe: '#22c55e',
  grid: 'rgba(255, 255, 255, 0.1)',
};

const getCarColor = (dist: number): string => {
  if (dist <= 5.0) return COLORS.danger;
  if (dist <= 15.0) return COLORS.warning;
  return COLORS.safe;
};

const getSideCarColor = (dist: number): string => {
  const absDist = Math.abs(dist);
  if (absDist <= 1.0) return COLORS.danger;
  if (absDist <= 2.5) return COLORS.warning;
  return COLORS.safe;
};

interface CarIconProps {
  fill?: string;
  opacity?: number;
}

const CarIcon = ({ fill = '#ffffff', opacity = 1 }: CarIconProps) => (
  <rect
    x={-(CAR_W * SCALE) / 2}
    y={-(CAR_H * SCALE) / 2}
    width={CAR_W * SCALE}
    height={CAR_H * SCALE}
    rx={CAR_R * SCALE}
    fill={fill}
    opacity={opacity}
  />
);

interface RadarDisplayProps {
  radarDistances: RadarDistances;
  spotter: SpotterState;
  maxDist: number;
}

export const RadarDisplay = ({
  radarDistances,
  spotter,
  maxDist,
}: RadarDisplayProps) => {
  const { frontDist, rearDist, sideCars } = radarDistances;

  const showFront = frontDist < maxDist;
  const showRear = rearDist < maxDist;

  const frontColor = showFront ? getCarColor(frontDist) : COLORS.safe;
  const rearColor = showRear ? getCarColor(rearDist) : COLORS.safe;

  const frontOpacity = showFront ? Math.max(0.2, 1 - frontDist / maxDist) : 0;
  const rearOpacity = showRear ? Math.max(0.2, 1 - rearDist / maxDist) : 0;

  const frontBumperY = -(CAR_H / 2) * SCALE;
  const rearBumperY = (CAR_H / 2) * SCALE;

  return (
    <div className={styles.radarContainer}>
      <svg viewBox="-100 -200 200 400" className={styles.radarSvg}>
        <defs>
          {spotter.left && sideCars.leftDist !== null && (
            <linearGradient id="cone-left" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop
                offset="0%"
                stopColor={getSideCarColor(sideCars.leftDist)}
                stopOpacity="0.4"
              />
              <stop
                offset="100%"
                stopColor={getSideCarColor(sideCars.leftDist)}
                stopOpacity="0"
              />
            </linearGradient>
          )}
          {spotter.right && sideCars.rightDist !== null && (
            <linearGradient id="cone-right" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop
                offset="0%"
                stopColor={getSideCarColor(sideCars.rightDist)}
                stopOpacity="0.4"
              />
              <stop
                offset="100%"
                stopColor={getSideCarColor(sideCars.rightDist)}
                stopOpacity="0"
              />
            </linearGradient>
          )}
        </defs>

        {/* Road lane markers */}
        <g stroke={COLORS.grid} strokeWidth="1.5" strokeDasharray="6 6">
          <line x1={-30} y1={-200} x2={-30} y2={200} opacity="0.3" />
          <line x1={30} y1={-200} x2={30} y2={200} opacity="0.3" />
        </g>

        {/* Distance markers */}
        <g stroke={COLORS.grid} strokeWidth="1" opacity="0.2">
          <line x1={-30} y1={-(10 * SCALE)} x2={30} y2={-(10 * SCALE)} />
          <text
            x="38"
            y={-(10 * SCALE)}
            fill="#fff"
            fontSize="8"
            alignmentBaseline="middle"
            fontFamily="Rajdhani, sans-serif"
          >
            10m
          </text>

          <line x1={-30} y1={-(20 * SCALE)} x2={30} y2={-(20 * SCALE)} />
          <text
            x="38"
            y={-(20 * SCALE)}
            fill="#fff"
            fontSize="8"
            alignmentBaseline="middle"
            fontFamily="Rajdhani, sans-serif"
          >
            20m
          </text>

          <line x1={-30} y1={10 * SCALE} x2={30} y2={10 * SCALE} />
          <text
            x="38"
            y={10 * SCALE}
            fill="#fff"
            fontSize="8"
            alignmentBaseline="middle"
            fontFamily="Rajdhani, sans-serif"
          >
            10m
          </text>

          <line x1={-30} y1={20 * SCALE} x2={30} y2={20 * SCALE} />
          <text
            x="38"
            y={20 * SCALE}
            fill="#fff"
            fontSize="8"
            alignmentBaseline="middle"
            fontFamily="Rajdhani, sans-serif"
          >
            20m
          </text>
        </g>

        {/* Spotter Glow Cones */}
        {spotter.left && sideCars.leftDist !== null && (
          <polygon
            points={`${-((CAR_W / 2) * SCALE)},${frontBumperY} -100,-180 -100,180 ${-((CAR_W / 2) * SCALE)},${rearBumperY}`}
            fill="url(#cone-left)"
            className={styles.carTransition}
          />
        )}
        {spotter.right && sideCars.rightDist !== null && (
          <polygon
            points={`${(CAR_W / 2) * SCALE},${frontBumperY} 100,-180 100,180 ${(CAR_W / 2) * SCALE},${rearBumperY}`}
            fill="url(#cone-right)"
            className={styles.carTransition}
          />
        )}

        {/* Opponent AHEAD */}
        {showFront && (
          <g
            transform={`translate(0, ${-(frontDist * SCALE) - CAR_H * SCALE})`}
            className={styles.carTransition}
          >
            <CarIcon opacity={frontOpacity} fill={frontColor} />
            <text
              y={(-CAR_H * SCALE) / 2 - 6}
              textAnchor="middle"
              dominantBaseline="auto"
              fill={frontColor}
              fontSize="14"
              fontWeight="bold"
              fontFamily="Rajdhani, sans-serif"
            >
              {frontDist.toFixed(1)}
            </text>
          </g>
        )}

        {/* Opponent BEHIND */}
        {showRear && (
          <g
            transform={`translate(0, ${rearDist * SCALE + CAR_H * SCALE})`}
            className={styles.carTransition}
          >
            <CarIcon opacity={rearOpacity} fill={rearColor} />
            <text
              y={(CAR_H * SCALE) / 2 + 14}
              textAnchor="middle"
              dominantBaseline="auto"
              fill={rearColor}
              fontSize="14"
              fontWeight="bold"
              fontFamily="Rajdhani, sans-serif"
            >
              {rearDist.toFixed(1)}
            </text>
          </g>
        )}

        {/* Opponent LEFT (spotter) */}
        {spotter.left && sideCars.leftDist !== null && (
          <g
            transform={`translate(${-(LATERAL_OFFSET * SCALE)}, ${-(sideCars.leftDist * SCALE)})`}
            className={styles.carTransition}
          >
            <CarIcon opacity={0.8} fill={getSideCarColor(sideCars.leftDist)} />
          </g>
        )}

        {/* Opponent RIGHT (spotter) */}
        {spotter.right && sideCars.rightDist !== null && (
          <g
            transform={`translate(${LATERAL_OFFSET * SCALE}, ${-(sideCars.rightDist * SCALE)})`}
            className={styles.carTransition}
          >
            <CarIcon opacity={0.8} fill={getSideCarColor(sideCars.rightDist)} />
          </g>
        )}

        {/* Player car (center) */}
        <CarIcon fill="#475569" />
      </svg>
    </div>
  );
};
