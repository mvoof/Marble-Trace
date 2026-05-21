import { observer } from 'mobx-react-lite';

import WindArrowIcon from '@assets/wind-arrow.svg?react';
import { telemetryStore } from '@store/iracing/telemetry.store';
import {
  getWindColor,
  parseWeekendFloat,
  radsToBearing,
} from '@utils/widget/weather-utils';

// Re-renders at 60 Hz — driven by carDynamics.yaw updating at physics rate
export const WindArrow = observer(() => {
  const weekendInfo = telemetryStore.weekendInfo;
  const env = telemetryStore.environment;
  const carYawRad = telemetryStore.carDynamics?.yaw ?? 0;
  const carYawDeg = carYawRad * (180 / Math.PI);

  const windVelMps =
    env?.wind_vel ?? parseWeekendFloat(weekendInfo?.TrackWindVel);
  const windDirRad =
    env?.wind_dir ?? parseWeekendFloat(weekendInfo?.TrackWindDir);
  const windBearing = windDirRad !== null ? radsToBearing(windDirRad) : 0;
  const arrowColor = getWindColor(windVelMps);

  const relativeBearing = (((windBearing - carYawDeg) % 360) + 360) % 360;

  const arrowBaseRadius = 105;
  const arrowHeight = 55;

  return (
    <g
      style={{ transform: `rotate(${relativeBearing}deg)` }}
      pointerEvents="none"
    >
      <WindArrowIcon
        x="-14"
        y={-arrowBaseRadius}
        width="28"
        height={arrowHeight}
        style={{
          color: arrowColor,
          transform: 'rotate(180deg)',
          transformOrigin: `0px ${-arrowBaseRadius + arrowHeight / 2}px`,
        }}
      />
    </g>
  );
});
