import { memo } from 'react';
import styles from './CarDot.module.scss';

interface CarDotProps {
  carNumber: string;
  carClassColor: string;
  isPlayer: boolean;
  /** Base radius in SVG user units. Parent sets this based on coordinate space. */
  radius?: number;
  showPing?: boolean;
  label?: string;
  labelIsPlayer?: boolean;
}

const CarDotBase = ({
  carNumber,
  carClassColor,
  isPlayer,
  radius = 10,
  showPing = true,
  label,
  labelIsPlayer,
}: CarDotProps) => {
  const r = isPlayer ? radius * 1.3 : radius;
  const fontSize = radius * 0.9;
  const labelFontSize = radius * 0.7;
  const labelW = radius * 4.5;
  const labelH = radius * 1.4;
  const labelY = -(r + radius * 0.5 + labelH);

  return (
    <g>
      {isPlayer && showPing && (
        <circle r={r} fill="white" className={styles.playerPing} />
      )}

      <circle
        r={r}
        fill="#18181b"
        stroke={carClassColor}
        strokeWidth={radius * 0.25}
      />

      <text
        textAnchor="middle"
        dy={fontSize * 0.4}
        fontSize={fontSize}
        className={styles.carNumber}
      >
        {carNumber}
      </text>

      {label && (
        <g transform={`translate(0, ${labelY + labelH / 2})`}>
          <rect
            x={-labelW / 2}
            y={-labelH / 2}
            width={labelW}
            height={labelH}
            rx={radius * 0.35}
            fill={labelIsPlayer ? 'white' : 'rgba(24,24,27,0.9)'}
            stroke={labelIsPlayer ? 'none' : 'rgba(255,255,255,0.15)'}
            strokeWidth="1"
          />
          <text
            textAnchor="middle"
            dy={labelFontSize * 0.35}
            fontSize={labelFontSize}
            className={labelIsPlayer ? styles.youTag : styles.p1Tag}
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
};

export const CarDot = memo(CarDotBase);
