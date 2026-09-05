import { observer } from 'mobx-react-lite';

import styles from './RingGeometry.module.scss';

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

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * The compass ring's geometry: a circle, eight ticks and four labels, none of
 * which changes with the car's heading. Created by `WindCompass`, which does not
 * re-render while the heading does, and handed to `RotatingRing` as children —
 * so no part of it is rebuilt at 60 Hz. See `docs/rendering.md`.
 */
export const RingGeometry = observer(function RingGeometry() {
  return (
    <>
      <circle r={RING_RADIUS} fill="none" stroke={RING_COLOR} strokeWidth="2" />

      {CARDINAL_ANGLES.map(({ angle }) => {
        const angleRad = angle * DEGREES_TO_RADIANS;

        return (
          <line
            key={angle}
            x1={Math.sin(angleRad) * TICK_OUTER}
            y1={-Math.cos(angleRad) * TICK_OUTER}
            x2={Math.sin(angleRad) * TICK_INNER_MAJOR}
            y2={-Math.cos(angleRad) * TICK_INNER_MAJOR}
            stroke={RING_COLOR}
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}

      {MINOR_TICK_ANGLES.map((angle) => {
        const angleRad = angle * DEGREES_TO_RADIANS;

        return (
          <line
            key={angle}
            x1={Math.sin(angleRad) * TICK_OUTER}
            y1={-Math.cos(angleRad) * TICK_OUTER}
            x2={Math.sin(angleRad) * TICK_INNER_MINOR}
            y2={-Math.cos(angleRad) * TICK_INNER_MINOR}
            stroke={RING_COLOR}
            strokeWidth="1"
            strokeLinecap="round"
          />
        );
      })}

      {CARDINAL_ANGLES.map(({ label, angle }) => {
        const angleRad = angle * DEGREES_TO_RADIANS;
        const labelX = Math.sin(angleRad) * LABEL_RADIUS;
        const labelY = -Math.cos(angleRad) * LABEL_RADIUS;

        return (
          <g key={label} transform={`translate(${labelX}, ${labelY})`}>
            <text
              textAnchor="middle"
              dominantBaseline="central"
              className={styles.cardinalLabel}
            >
              {label}
            </text>
          </g>
        );
      })}
    </>
  );
});
