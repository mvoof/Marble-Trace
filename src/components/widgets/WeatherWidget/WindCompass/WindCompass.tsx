import CarIcon from '../../../../assets/car-icon.svg?react';
import { RotatingRing } from './RotatingRing/RotatingRing';
import { WindArrow } from './WindArrow/WindArrow';

import styles from './WindCompass.module.scss';

interface WindCompassProps {
  windBearing: number;
  windCardinal: string;
  arrowColor: string;
}

export const WindCompass = ({
  windBearing,
  windCardinal,
  arrowColor,
}: WindCompassProps) => {
  return (
    <div className={styles.compassWrapper}>
      <svg
        width="100%"
        height="100%"
        viewBox="-110 -110 220 220"
        className={styles.compassSvg}
      >
        <RotatingRing />

        <WindArrow windBearing={windBearing} arrowColor={arrowColor} />

        <text
          x="-105"
          y="-88"
          textAnchor="start"
          dominantBaseline="central"
          className={styles.bearingText}
        >
          {Math.round(windBearing)}°
        </text>

        <text
          x="105"
          y="-88"
          textAnchor="end"
          dominantBaseline="central"
          className={styles.bearingText}
        >
          {windCardinal}
        </text>

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
