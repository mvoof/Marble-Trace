import { observer } from 'mobx-react-lite';
import styles from './StartFinishMarker.module.scss';

interface StartFinishMarkerProps {
  x: number;
  y: number;
  angle: number;
  trackCenterX: number;
  trackCenterY: number;
}

export const StartFinishMarker = observer(
  ({ x, y, angle, trackCenterX, trackCenterY }: StartFinishMarkerProps) => {
    // Convert angle to radians to calculate the local Y-axis direction in global coordinates
    const rad = (angle * Math.PI) / 180;
    const lyx = -Math.sin(rad);
    const lyy = Math.cos(rad);

    // Calculate two perpendicular test points to see which goes towards the outside
    const testDist = 10;
    const pPlusX = x + lyx * testDist;
    const pPlusY = y + lyy * testDist;
    const pMinusX = x - lyx * testDist;
    const pMinusY = y - lyy * testDist;

    // Measure distance from both test points to the track's center of mass
    const distPlus =
      Math.pow(pPlusX - trackCenterX, 2) + Math.pow(pPlusY - trackCenterY, 2);
    const distMinus =
      Math.pow(pMinusX - trackCenterX, 2) + Math.pow(pMinusY - trackCenterY, 2);

    // The side further away from the track center is the "outside" of the loop
    const isPlusOutside = distPlus > distMinus;
    const calloutLength = 50; // Made even longer (50px) as requested
    const offset = isPlusOutside ? calloutLength : -calloutLength;

    return (
      <g transform={`translate(${x},${y}) rotate(${angle})`}>
        {/* Thin perpendicular technical callout line */}
        <line x1="0" y1="0" x2="0" y2={offset} className={styles.markerLine} />

        {/* Tiny anchor dot directly on the track line */}
        <circle cx="0" cy="0" r="2" className={styles.markerAnchor} />

        {/* Checkered flag HUD icon */}
        <g transform={`translate(0, ${offset})`}>
          {/* Counter-rotate by -angle to stay upright relative to screen */}
          <g
            transform={`rotate(${-angle})`}
            className="transition-transform duration-500 ease-in-out"
          >
            <g className={styles.flagContainer}>
              {/* 2x2 Chess cells (20x20px total size) */}
              <rect
                x="-10"
                y="-10"
                width="10"
                height="10"
                className={styles.flagWhite}
              />
              <rect
                x="0"
                y="-10"
                width="10"
                height="10"
                className={styles.flagDark}
              />
              <rect
                x="-10"
                y="0"
                width="10"
                height="10"
                className={styles.flagDark}
              />
              <rect
                x="0"
                y="0"
                width="10"
                height="10"
                className={styles.flagWhite}
              />

              {/* Outer rounded frame */}
              <rect
                x="-11"
                y="-11"
                width="22"
                height="22"
                className={styles.flagBorder}
                rx="2"
              />
            </g>
          </g>
        </g>
      </g>
    );
  }
);
