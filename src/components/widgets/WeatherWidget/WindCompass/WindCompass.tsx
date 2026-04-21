import styles from './WindCompass.module.scss';

interface WindCompassProps {
  windBearing: number;
  carYawDeg: number;
  size?: number;
}

const CARDINALS = [
  { label: 'N', angle: 0 },
  { label: 'E', angle: 90 },
  { label: 'S', angle: 180 },
  { label: 'W', angle: 270 },
];

const TICK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const RADIUS = 46;
const TICK_OUTER = 50;
const TICK_INNER_MAJOR = 42;
const TICK_INNER_MINOR = 44;
const LABEL_RADIUS = 36;

const ARROW_COLOR = 'rgba(255,255,255,0.65)';

const PIXEL_TAIL = [
  { y: -28, size: 3, opacity: 1.0 },
  { y: -20, size: 2.8, opacity: 0.75 },
  { y: -13, size: 2.4, opacity: 0.55 },
  { y: -7, size: 1.8, opacity: 0.35 },
  { y: -1, size: 1.2, opacity: 0.18 },
];

export const WindCompass = ({
  windBearing,
  carYawDeg,
  size = 120,
}: WindCompassProps) => {
  const arrowRotation = windBearing - carYawDeg;

  return (
    <svg
      width={size}
      height={size}
      viewBox="-60 -60 120 120"
      className={styles.compass}
    >
      <g transform={`rotate(${-carYawDeg})`} className={styles.faceGroup}>
        <circle
          r={RADIUS + 4}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
          fill="none"
        />
        <circle
          r={RADIUS}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          fill="none"
        />

        {TICK_ANGLES.map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const isMajor = angle % 90 === 0;
          const inner = isMajor ? TICK_INNER_MAJOR : TICK_INNER_MINOR;
          const x1 = Math.sin(rad) * TICK_OUTER;
          const y1 = -Math.cos(rad) * TICK_OUTER;
          const x2 = Math.sin(rad) * inner;
          const y2 = -Math.cos(rad) * inner;
          return (
            <line
              key={angle}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={
                isMajor ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)'
              }
              strokeWidth={isMajor ? 1.5 : 1}
            />
          );
        })}

        {CARDINALS.map(({ label, angle }) => {
          const rad = (angle * Math.PI) / 180;
          const x = Math.sin(rad) * LABEL_RADIUS;
          const y = -Math.cos(rad) * LABEL_RADIUS;
          const isNorth = label === 'N';
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className={`${styles.cardinalLabel} ${isNorth ? styles.cardinalNorth : ''}`}
            >
              {label}
            </text>
          );
        })}
      </g>

      <g transform={`rotate(${arrowRotation})`} className={styles.arrowGroup}>
        <polygon points="0,-44 -5,-32 5,-32" fill={ARROW_COLOR} />

        {PIXEL_TAIL.map(({ y, size: s, opacity }) => (
          <rect
            key={y}
            x={-s / 2}
            y={y}
            width={s}
            height={s}
            fill={ARROW_COLOR}
            opacity={opacity}
          />
        ))}

        <polygon
          points="0,8 -3.5,18 3.5,18"
          fill={ARROW_COLOR}
          opacity={0.45}
        />
      </g>

      <circle r="2" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
};
