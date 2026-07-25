import { observer } from 'mobx-react-lite';

import { getContrastTextColor } from '@utils/formatters/color-utils';
import styles from './PaceCarMarker.module.scss';

interface PaceCarMarkerProps {
  /** Base radius in SVG user units — matches competitor dot radius. */
  radius: number;
  /** Class color of the pace car (one pace car per class in multiclass). */
  color: string;
}

const DIAMOND_RADIUS_SCALE = 1.4; // pace car reads slightly larger than dots
const STROKE_TO_RADIUS = 0.28;
const LABEL_FONT_TO_RADIUS = 1.05;
const LABEL_DY_TO_FONT = 0.35;
const LABEL_MIN_RADIUS_PX = 7; // below this the "SC" glyph is unreadable

export const PaceCarMarker = observer(
  ({ radius, color }: PaceCarMarkerProps) => {
    const half = radius * DIAMOND_RADIUS_SCALE;
    const points = `0,${-half} ${half},0 0,${half} ${-half},0`;
    const showLabel = radius >= LABEL_MIN_RADIUS_PX;
    const fontSize = radius * LABEL_FONT_TO_RADIUS;
    const inkColor = getContrastTextColor(color);

    return (
      <g>
        <polygon
          points={points}
          className={styles.diamond}
          style={{ fill: color, stroke: inkColor }}
          strokeWidth={radius * STROKE_TO_RADIUS}
        />

        {showLabel && (
          <text
            textAnchor="middle"
            dy={`${LABEL_DY_TO_FONT}em`}
            style={{
              fontSize: `calc(${fontSize}px * var(--font-scale, 1))`,
              fill: inkColor,
            }}
            className={styles.label}
          >
            SC
          </text>
        )}
      </g>
    );
  }
);

PaceCarMarker.displayName = 'PaceCarMarker';
