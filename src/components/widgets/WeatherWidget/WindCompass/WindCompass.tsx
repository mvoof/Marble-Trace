import CarIcon from '../../../../assets/car-icon.svg?react';
import WindArrowIcon from '../../../../assets/wind-arrow.svg?react';
import styles from './WindCompass.module.scss';

interface WindCompassProps {
  windBearing: number;
  carYawDeg: number;
  windCardinal: string;
  arrowColor: string;
  size?: number;
}

const COMPASS_SIZE = 200;
const RING_RADIUS = 74;
const TICK_OUTER = 80;
const TICK_INNER_MAJOR = 70;
const TICK_INNER_MINOR = 76;
const LABEL_RADIUS = 58;

const CARDINAL_ANGLES = [
  { label: 'N', angle: 0 },
  { label: 'E', angle: 90 },
  { label: 'S', angle: 180 },
  { label: 'W', angle: 270 },
];

const MINOR_TICK_ANGLES = [45, 135, 225, 315];

const RING_COLOR = 'rgba(255,255,255,0.22)';

export const WindCompass = ({
  windBearing,
  carYawDeg,
  windCardinal,
  arrowColor,
  size = COMPASS_SIZE,
}: WindCompassProps) => {
  const ringRotation = -carYawDeg;
  const relativeBearing = (((windBearing - carYawDeg) % 360) + 360) % 360;

  const bearingFontPx = Math.round(13 * (size / COMPASS_SIZE));

  // RING_RADIUS is 74. Car radius ~40.
  // We want the arrow to cross the ring (start outside at ~95) and end near the car (~45).
  const arrowBaseRadius = 95;
  const arrowHeight = 50;

  return (
    <div
      className={styles.compassWrapper}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="-110 -110 220 220"
        className={styles.compassSvg}
      >
        {/* 1. Rotating Ring + Ticks + Labels */}
        <g
          transform={`rotate(${ringRotation})`}
          className={styles.rotatingGroup}
          pointerEvents="none"
        >
          <circle
            r={RING_RADIUS}
            fill="none"
            stroke={RING_COLOR}
            strokeWidth="2"
          />

          {CARDINAL_ANGLES.map(({ angle }) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={angle}
                x1={Math.sin(rad) * TICK_OUTER}
                y1={-Math.cos(rad) * TICK_OUTER}
                x2={Math.sin(rad) * TICK_INNER_MAJOR}
                y2={-Math.cos(rad) * TICK_INNER_MAJOR}
                stroke={RING_COLOR}
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}

          {MINOR_TICK_ANGLES.map((angle) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={angle}
                x1={Math.sin(rad) * TICK_OUTER}
                y1={-Math.cos(rad) * TICK_OUTER}
                x2={Math.sin(rad) * TICK_INNER_MINOR}
                y2={-Math.cos(rad) * TICK_INNER_MINOR}
                stroke={RING_COLOR}
                strokeWidth="1"
                strokeLinecap="round"
              />
            );
          })}

          {CARDINAL_ANGLES.map(({ label, angle }) => {
            const rad = (angle * Math.PI) / 180;
            const x = Math.sin(rad) * LABEL_RADIUS;
            const y = -Math.cos(rad) * LABEL_RADIUS;
            return (
              <g key={label} transform={`translate(${x}, ${y})`}>
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={styles.cardinalLabel}
                  transform={`rotate(${-ringRotation})`}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>

        {/* 2. Wind arrow — above ring, pointing from outside towards car */}
        <g transform={`rotate(${relativeBearing})`} pointerEvents="none">
          <WindArrowIcon
            x="-14"
            y={-arrowBaseRadius}
            width="28"
            height={arrowHeight}
            style={{
              color: arrowColor,
              transform: 'rotate(180deg)',
              transformOrigin: `0px ${-arrowBaseRadius + arrowHeight / 2}px`,
            }}
          />
        </g>

        {/* 3. Static Overlays */}
        <text
          x="-105"
          y="-88"
          textAnchor="start"
          dominantBaseline="central"
          className={styles.bearingText}
          style={{ fontSize: bearingFontPx }}
        >
          {Math.round(windBearing)}°
        </text>

        <text
          x="105"
          y="-88"
          textAnchor="end"
          dominantBaseline="central"
          className={styles.bearingText}
          style={{ fontSize: bearingFontPx }}
        >
          {windCardinal}
        </text>

        {/* 4. Car icon — centered, inside SVG for layering */}
        <g pointerEvents="none">
          <CarIcon
            x="-40"
            y="-40"
            width="80"
            height="80"
            style={{ color: 'rgba(255,255,255,0.88)' }}
          />
        </g>
      </svg>
    </div>
  );
};
