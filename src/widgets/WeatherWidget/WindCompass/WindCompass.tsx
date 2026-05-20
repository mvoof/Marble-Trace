import { observer } from 'mobx-react-lite';

import CarIcon from '@assets/car-icon.svg?react';
import { telemetryStore } from '@store/iracing/telemetry.store';
import {
  bearingToCardinal,
  parseWeekendFloat,
  radsToBearing,
} from '@utils/widget/weather-utils';
import { RotatingRing } from './RotatingRing/RotatingRing';
import { WindArrow } from './WindArrow/WindArrow';

import styles from './WindCompass.module.scss';

export const WindCompass = observer(() => {
  const weekendInfo = telemetryStore.weekendInfo;
  const env = telemetryStore.environment;

  const windDirRad =
    env?.wind_dir ?? parseWeekendFloat(weekendInfo?.TrackWindDir);
  const windBearing = windDirRad !== null ? radsToBearing(windDirRad) : 0;
  const windCardinal = bearingToCardinal(windBearing);

  return (
    <div className={styles.compassWrapper}>
      <svg
        width="100%"
        height="100%"
        viewBox="-110 -110 220 220"
        className={styles.compassSvg}
      >
        <RotatingRing />

        <WindArrow />

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
});
