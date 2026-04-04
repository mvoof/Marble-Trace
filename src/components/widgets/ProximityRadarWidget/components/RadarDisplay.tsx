import type { RadarDistances, SpotterState } from '../../../../utils/proximity';

import styles from './RadarDisplay.module.scss';

// === CONSTANTS ===
const SCALE = 22;
const CAR_W = 1.8;
const CAR_H = 4.4;
const CAR_R = 0.2;
const LATERAL_OFFSET = CAR_W + 0.6;

const COLORS = {
  danger: '#ff2a55', // Опасно (до 1м)
  warning: '#eab308', // Внимание (до 2м)
  safe: '#22c55e', // Безопасно (> 2м)
  grid: 'rgba(255, 255, 255, 0.1)',
};

const getCarColor = (dist: number): string => {
  if (dist <= 1.0) return COLORS.danger;
  if (dist <= 2.0) return COLORS.warning;
  return COLORS.safe;
};

const getSideCarColor = (dist: number): string => {
  const absDist = Math.abs(dist);
  if (absDist <= 0.5) return COLORS.danger;
  if (absDist <= 1.5) return COLORS.warning;
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
    className={styles.carIcon}
  />
);

interface RadarDisplayProps {
  radarDistances: RadarDistances;
  spotter: SpotterState;
}

export const RadarDisplay = ({
  radarDistances,
  spotter,
}: RadarDisplayProps) => {
  const { frontDist, rearDist, sideCars } = radarDistances;

  // For this high-zoom proximity radar, we use a smaller visual range
  const VISUAL_MAX_DIST = 10.0;

  const showFront = frontDist < VISUAL_MAX_DIST;
  const showRear = rearDist < VISUAL_MAX_DIST;

  const frontColor = showFront ? getCarColor(frontDist) : COLORS.safe;
  const rearColor = showRear ? getCarColor(rearDist) : COLORS.safe;

  const frontOpacity = showFront
    ? Math.max(0.2, 1 - frontDist / VISUAL_MAX_DIST)
    : 0;
  const rearOpacity = showRear
    ? Math.max(0.2, 1 - rearDist / VISUAL_MAX_DIST)
    : 0;

  const frontBumperY = -(CAR_H / 2) * SCALE;
  const rearBumperY = (CAR_H / 2) * SCALE;

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
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="2"
            />
          </pattern>
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

        {/* ОСИ (Крестовина) ДЛЯ ОРИЕНТИРОВАНИЯ */}
        <g
          stroke="#ffffff"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.15"
        >
          <line x1={-120} y1="0" x2={120} y2="0" />
          <line x1="0" y1={-240} x2="0" y2={240} />
        </g>

        {/* ЦЕНТРАЛЬНАЯ ЗАШТРИХОВАННАЯ ЗОНА (Бок-о-бок) */}
        <rect
          x="-120"
          y={-(CAR_H * SCALE) / 2}
          width="240"
          height={CAR_H * SCALE}
          fill="url(#hatch-pattern)"
        />

        {/* Spotter Glow Cones */}
        {spotter.left && sideCars.leftDist !== null && (
          <polygon
            points={`${-((CAR_W / 2) * SCALE)},${frontBumperY} -150,-180 -150,180 ${-((CAR_W / 2) * SCALE)},${rearBumperY}`}
            fill="url(#cone-left)"
            className={styles.carTransition}
          />
        )}
        {spotter.right && sideCars.rightDist !== null && (
          <polygon
            points={`${(CAR_W / 2) * SCALE},${frontBumperY} 150,-180 150,180 ${(CAR_W / 2) * SCALE},${rearBumperY}`}
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
            <text y="-18" className={styles.radarMeasurementText}>
              {frontDist.toFixed(1)}м
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
            <text y="18" className={styles.radarMeasurementText}>
              {rearDist.toFixed(1)}м
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
            <text y="0" className={styles.radarMeasurementText}>
              {Math.abs(sideCars.leftDist).toFixed(1)}м
            </text>
          </g>
        )}

        {/* Opponent RIGHT (spotter) */}
        {spotter.right && sideCars.rightDist !== null && (
          <g
            transform={`translate(${LATERAL_OFFSET * SCALE}, ${-(sideCars.rightDist * SCALE)})`}
            className={styles.carTransition}
          >
            <CarIcon opacity={0.8} fill={getSideCarColor(sideCars.rightDist)} />
            <text y="0" className={styles.radarMeasurementText}>
              {Math.abs(sideCars.rightDist).toFixed(1)}м
            </text>
          </g>
        )}

        {/* Player car (center) */}
        <CarIcon fill="currentColor" />
      </svg>
    </div>
  );
};
