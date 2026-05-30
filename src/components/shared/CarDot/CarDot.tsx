import { observer } from 'mobx-react-lite';
import styles from './CarDot.module.scss';
import { ChevronIcon, CrownIcon } from './MarkerIcons';

interface CarDotProps {
  carNumber: string;
  carClassColor: string;
  isPlayer: boolean;
  /** Base radius in SVG user units. Parent sets this based on coordinate space. */
  radius?: number;
  label?: string;
  labelIsPlayer?: boolean;
  playerColor?: string;
}

const PLAYER_RADIUS_SCALE = 1.3; // player dot is 30% larger than competitor dots
const STROKE_TO_RADIUS = 0.25; // class-color border thickness
const NUMBER_FONT_TO_RADIUS = 1.2; // car number font size inside the circle
const NUMBER_DY_TO_FONT = 0.4; // vertical nudge to visually center text (SVG dy is from baseline)

export const CarDot = observer(
  ({
    carNumber,
    carClassColor,
    isPlayer,
    radius = 10,
    label,
    playerColor = '#18181b',
  }: CarDotProps) => {
    const r = isPlayer ? radius * PLAYER_RADIUS_SCALE : radius;
    const fontSize = radius * NUMBER_FONT_TO_RADIUS;
    const scale = radius / 10;
    const markerY = -r - 8 * scale;

    return (
      <g
        style={{
          ['--car-dot-bg' as string]: isPlayer ? playerColor : '#18181b',
        }}
      >
        <circle
          r={r}
          className={styles.carCircle}
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

        {label === 'YOU' && (
          <g transform={`translate(0, ${markerY})`}>
            <ChevronIcon scale={scale} />
          </g>
        )}

        {label === 'P1' && (
          <g transform={`translate(0, ${markerY})`}>
            <CrownIcon scale={scale} color={carClassColor} />
          </g>
        )}
      </g>
    );
  }
);

CarDot.displayName = 'CarDot';
