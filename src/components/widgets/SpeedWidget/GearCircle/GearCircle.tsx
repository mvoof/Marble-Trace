import type { CSSProperties } from 'react';
import { CIRCLE_R, CIRCUMFERENCE } from '../speed-utils';

import styles from './GearCircle.module.scss';

interface GearCircleProps {
  displayPct: number;
  zoneColor: string;
  isLimit: boolean;
  centerValue: string;
  rpmLimitColor: string;
}

export const GearCircle = ({
  displayPct,
  zoneColor,
  isLimit,
  centerValue,
  rpmLimitColor,
}: GearCircleProps) => {
  const offset = CIRCUMFERENCE - displayPct * CIRCUMFERENCE;

  return (
    <div className={styles.gearContainer}>
      <svg className={styles.gearSvg} viewBox="0 0 300 300">
        <circle
          className={styles.circleBg}
          cx="150"
          cy="150"
          r={CIRCLE_R}
          stroke="currentColor"
        />

        <circle
          className={`${styles.circleProgress} ${isLimit ? styles.blinkAlert : ''}`}
          cx="150"
          cy="150"
          r={CIRCLE_R}
          stroke="currentColor"
          style={
            {
              strokeDasharray: CIRCUMFERENCE,
              color: zoneColor,
              strokeDashoffset: offset,
              filter: isLimit
                ? `drop-shadow(0 0 15px ${rpmLimitColor})`
                : 'drop-shadow(0 0 0px transparent)',
            } as CSSProperties
          }
        />
      </svg>

      <div className={styles.gearValue}>{centerValue}</div>
    </div>
  );
};
