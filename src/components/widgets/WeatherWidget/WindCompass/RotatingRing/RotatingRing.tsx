import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../../../store/iracing/telemetry.store';

import styles from './RotatingRing.module.scss';

const RING_RADIUS = 82;
const TICK_OUTER = 88;
const TICK_INNER_MAJOR = 77;
const TICK_INNER_MINOR = 84;
const LABEL_RADIUS = 64;

const CARDINAL_ANGLES = [
  { label: 'N', angle: 0 },
  { label: 'E', angle: 90 },
  { label: 'S', angle: 180 },
  { label: 'W', angle: 270 },
];

const MINOR_TICK_ANGLES = [45, 135, 225, 315];

const RING_COLOR = 'rgba(255,255,255,0.22)';

// Re-renders at 60 Hz — driven by carDynamics.yaw updating at physics rate
export const RotatingRing = observer(() => {
  const carYawRad = telemetryStore.carDynamics?.yaw ?? 0;
  const carYawDeg = carYawRad * (180 / Math.PI);

  return (
    <g
      style={{ transform: `rotate(${-carYawDeg}deg)` }}
      className={styles.rotatingGroup}
      pointerEvents="none"
    >
      <circle r={RING_RADIUS} fill="none" stroke={RING_COLOR} strokeWidth="2" />

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
              style={{ transform: `rotate(${carYawDeg}deg)` }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
});
