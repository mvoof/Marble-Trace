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
  playerColor?: string;
}

const PLAYER_RADIUS_SCALE = 1.3; // player dot is 30% larger than competitor dots
const STROKE_TO_RADIUS = 0.25; // class-color border thickness
const NUMBER_FONT_TO_RADIUS = 1.2; // car number font size inside the circle
const NUMBER_DY_TO_FONT = 0.4; // vertical nudge to visually center text (SVG dy is from baseline)
const LABEL_FONT_TO_RADIUS = 0.7; // "YOU" / "P1" tag font size
const LABEL_DY_TO_FONT = 0.35; // vertical nudge for tag text (same baseline offset as above)
const LABEL_WIDTH_TO_RADIUS = 4.5; // tag pill width
const LABEL_HEIGHT_TO_RADIUS = 1.4; // tag pill height
const LABEL_GAP_TO_RADIUS = 0.5; // gap between dot edge and tag pill
const LABEL_CORNER_TO_RADIUS = 0.35; // tag pill corner radius

const CarDotBase = ({
  carNumber,
  carClassColor,
  isPlayer,
  radius = 10,
  showPing = true,
  label,
  labelIsPlayer,
  playerColor = 'white',
}: CarDotProps) => {
  const r = isPlayer ? radius * PLAYER_RADIUS_SCALE : radius;
  const fontSize = radius * NUMBER_FONT_TO_RADIUS;
  const labelFontSize = radius * LABEL_FONT_TO_RADIUS;
  const labelW = radius * LABEL_WIDTH_TO_RADIUS;
  const labelH = radius * LABEL_HEIGHT_TO_RADIUS;
  const labelY = -(r + radius * LABEL_GAP_TO_RADIUS + labelH);

  return (
    <g>
      {isPlayer && showPing && (
        <circle r={r} fill={playerColor} className={styles.playerPing} />
      )}

      <circle
        r={r}
        fill={isPlayer ? playerColor : '#18181b'}
        stroke={carClassColor}
        strokeWidth={radius * STROKE_TO_RADIUS}
      />

      <text
        textAnchor="middle"
        dy={fontSize * NUMBER_DY_TO_FONT}
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
            rx={radius * LABEL_CORNER_TO_RADIUS}
            fill={labelIsPlayer ? 'white' : 'rgba(24,24,27,0.9)'}
            stroke={labelIsPlayer ? 'none' : 'rgba(255,255,255,0.15)'}
            strokeWidth="1"
          />
          <text
            textAnchor="middle"
            dy={labelFontSize * LABEL_DY_TO_FONT}
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
